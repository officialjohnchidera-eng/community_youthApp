from rest_framework import status
from accounts.models import Village, CustomUser
from django.db import models
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from .models import PaymentRequest, PaymentTransaction, VillagePaymentStatus
from .serializers import (
    PaymentRequestSerializer,
    PaymentTransactionSerializer,
    InitiatePaymentSerializer
)
from accounts.models import Village
import requests
import hashlib
import hmac
import json
import uuid


def is_financial_executive(user):
    allowed_positions = [
        'General President',
        'Vice President',
        'General Treasurer',
        'Assistant Treasurer'
    ]
    return user.position and user.position.title in allowed_positions


def expire_stale_pending_transactions():
    """
    Auto-mark pending transactions older than 15 minutes as failed.
    A legitimate payment completes within minutes - anything pending
    longer than that was abandoned, timed out, or never reached Paystack.
    """
    cutoff = timezone.now() - timedelta(minutes=15)
    PaymentTransaction.objects.filter(
        status='pending',
        created_at__lt=cutoff
    ).update(status='failed')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_payment_request(request):
    if not is_financial_executive(request.user):
        return Response(
            {'error': 'You do not have permission to create payment requests.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = PaymentRequestSerializer(data=request.data)
    if serializer.is_valid():
        payment_request = serializer.save(created_by=request.user)

        # Notify members - wrapped so notification failures NEVER fail the request
        try:
            from accounts.models import CustomUser
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            approved_members = CustomUser.objects.filter(account_status='approved')

            for member in approved_members:
                try:
                    message = Mail(
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        to_emails=member.email,
                        subject=f'New Payment Request — {payment_request.title}',
                        plain_text_content=f'''Dear {member.first_name},

A new payment request has been created by the Treasurer.

Title: {payment_request.title}
Description: {payment_request.description}
Amount: NGN {payment_request.amount:,.2f}
Payment Type: {payment_request.payment_type.replace("_", " ").title()}
Deadline: {payment_request.deadline.strftime("%d %B %Y") if payment_request.deadline else "No deadline"}

Please log in to your dashboard to make your payment before the deadline.

Umuagu General Youth Association
'''
                    )
                    sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
                    sg.send(message)
                except Exception as e:
                    print(f"Email error for {member.email}: {e}")

                try:
                    from notifications.views import create_notification
                    create_notification(
                        member=member,
                        title=f'New Payment: {payment_request.title}',
                        body=f'NGN {payment_request.amount:,.0f} due before {payment_request.deadline.strftime("%d %B %Y") if payment_request.deadline else "no deadline"}. Log in to pay now.',
                        notification_type='payment'
                    )
                except Exception as e:
                    print(f"Notification error: {e}")

            try:
                from notifications.firebase import send_bulk_notification
                from notifications.models import DeviceToken
                all_tokens = list(
                    DeviceToken.objects.filter(
                        member__account_status='approved'
                    ).values_list('token', flat=True)
                )
                if all_tokens:
                    send_bulk_notification(
                        tokens=all_tokens,
                        title=f'New Payment: {payment_request.title}',
                        body=f'NGN {payment_request.amount:,.2f} due. Login to pay now.',
                    )
            except Exception as e:
                print(f"Push notification error: {e}")

        except Exception as e:
            print(f"Notification block error: {e}")

        return Response({
            'message': 'Payment request created successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_payment_requests(request):
    PaymentRequest.objects.filter(
        status='active',
        deadline__lt=timezone.now()
    ).update(status='closed')

    if request.user.account_status != 'approved':
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get all active payment requests
    active_requests = PaymentRequest.objects.filter(status='active').order_by('-created_at')

    # Filter out requests this member has already successfully paid
    already_paid_ids = set(
        PaymentTransaction.objects.filter(
            member=request.user,
            status='success'
        ).values_list('payment_request_id', flat=True)
    )

    # Only return requests the member hasn't paid yet
    unpaid_requests = [r for r in active_requests if r.id not in already_paid_ids]

    serializer = PaymentRequestSerializer(unpaid_requests, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_payment(request):
    if request.user.account_status != 'approved':
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = InitiatePaymentSerializer(data=request.data)
    if serializer.is_valid():
        payment_request = serializer.validated_data['payment_request']
        village_id = serializer.validated_data.get('village_id')

        if payment_request.payment_type in ['monthly_dues', 'levy']:
            if not request.user.position:
                return Response(
                    {'error': 'Only the Village Youth President can initiate this payment on behalf of their village.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if 'Youth President' not in request.user.position.title:
                return Response(
                    {'error': 'Only the Village Youth President can initiate this payment on behalf of their village.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if village_id and request.user.village_id != int(village_id):
                return Response(
                    {'error': 'You can only initiate payment for your own village.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Prevent paying twice for the same request
        already_paid = PaymentTransaction.objects.filter(
            payment_request=payment_request,
            member=request.user,
            status='success'
        ).exists()
        if already_paid:
            return Response(
                {'error': 'You have already paid for this request.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # CRITICAL FIX: close out any existing pending attempt for this
        # member+request before starting a new one, so retries never
        # accumulate phantom pending transactions
        PaymentTransaction.objects.filter(
            payment_request=payment_request,
            member=request.user,
            status='pending'
        ).update(status='failed')

        reference = f'UMY-{uuid.uuid4().hex[:12].upper()}'

        transaction = PaymentTransaction.objects.create(
            payment_request=payment_request,
            member=request.user,
            village=Village.objects.get(id=village_id) if village_id else None,
            amount=payment_request.amount,
            status='pending',
            paystack_reference=reference
        )

        paystack_url = 'https://api.paystack.co/transaction/initialize'
        headers = {
            'Authorization': f'Bearer {settings.PAYSTACK_SECRET_KEY}',
            'Content-Type': 'application/json'
        }
        payload = {
            'email': request.user.email,
            'amount': int(payment_request.amount * 100),
            'reference': reference,
            'callback_url': f'{settings.FRONTEND_URL}/dashboard/payment-callback',
            'metadata': {
                'transaction_id': transaction.id,
                'payment_type': payment_request.payment_type,
                'member_id': request.user.user_id
            }
        }

        try:
            response = requests.post(paystack_url, json=payload, headers=headers, timeout=15)
            response_data = response.json()

            if response.status_code == 200 and response_data.get('status'):
                return Response({
                    'message': 'Payment initiated successfully.',
                    'payment_url': response_data['data']['authorization_url'],
                    'reference': reference,
                    'receipt_number': transaction.receipt_number
                })
            else:
                transaction.status = 'failed'
                transaction.save()
                return Response(
                    {'error': response_data.get('message', 'Failed to initiate payment. Please try again.')},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except requests.exceptions.RequestException as e:
            transaction.status = 'failed'
            transaction.save()
            print(f"Paystack request error: {e}")
            return Response(
                {'error': 'Could not reach payment provider. Please try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except (KeyError, ValueError) as e:
            transaction.status = 'failed'
            transaction.save()
            print(f"Paystack response parse error: {e}")
            return Response(
                {'error': 'Unexpected error from payment provider. Please try again.'},
                status=status.HTTP_502_BAD_GATEWAY
            )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def paystack_webhook(request):
    paystack_signature = request.headers.get('x-paystack-signature')
    computed_signature = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode('utf-8'),
        request.body,
        hashlib.sha512
    ).hexdigest()

    if paystack_signature != computed_signature:
        return Response(
            {'error': 'Invalid signature.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    payload = json.loads(request.body)
    event = payload.get('event')

    if event == 'charge.success':
        reference = payload['data']['reference']
        try:
            transaction = PaymentTransaction.objects.get(
                paystack_reference=reference,
                status='pending'
            )
            transaction.status = 'success'
            transaction.paid_at = timezone.now()
            transaction.save()

            if transaction.village:
                VillagePaymentStatus.objects.update_or_create(
                    payment_request=transaction.payment_request,
                    village=transaction.village,
                    defaults={
                        'status': 'paid',
                        'paid_at': timezone.now(),
                        'paid_by': transaction.member
                    }
                )

            if transaction.member:
                try:
                    from notifications.views import create_notification
                    create_notification(
                        member=transaction.member,
                        title='Payment Successful!',
                        body=f'Your payment of NGN {transaction.amount:,.0f} was successful. Reference: {reference}',
                        notification_type='payment'
                    )
                except Exception as e:
                    print(f"Notification error: {e}")

        except PaymentTransaction.DoesNotExist:
            pass

    elif event == 'charge.failed':
        reference = payload['data']['reference']
        try:
            transaction = PaymentTransaction.objects.get(
                paystack_reference=reference,
                status='pending'
            )
            transaction.status = 'failed'
            transaction.save()
        except PaymentTransaction.DoesNotExist:
            pass

    return Response({'status': 'ok'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verify_payment(request, reference):
    try:
        transaction = PaymentTransaction.objects.get(
            paystack_reference=reference
        )
    except PaymentTransaction.DoesNotExist:
        return Response(
            {'error': 'Transaction not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if transaction.status == 'success':
        serializer = PaymentTransactionSerializer(transaction)
        return Response(serializer.data)

    try:
        paystack_url = f'https://api.paystack.co/transaction/verify/{reference}'
        headers = {'Authorization': f'Bearer {settings.PAYSTACK_SECRET_KEY}'}
        response = requests.get(paystack_url, headers=headers, timeout=15)
        response_data = response.json()

        if response_data.get('status') and response_data['data']['status'] == 'success':
            transaction.status = 'success'
            transaction.paid_at = timezone.now()
            transaction.save()

            if transaction.village:
                VillagePaymentStatus.objects.update_or_create(
                    payment_request=transaction.payment_request,
                    village=transaction.village,
                    defaults={
                        'status': 'paid',
                        'paid_at': timezone.now(),
                        'paid_by': transaction.member
                    }
                )
        elif response_data.get('data', {}).get('status') in ['failed', 'abandoned']:
            transaction.status = 'failed'
            transaction.save()

    except requests.exceptions.RequestException as e:
        print(f"Verify payment error: {e}")

    serializer = PaymentTransactionSerializer(transaction)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_payment_history(request):
    if request.user.account_status != 'approved':
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )

    expire_stale_pending_transactions()

    if is_financial_executive(request.user):
        transactions = PaymentTransaction.objects.all().order_by('-created_at')
    else:
        all_transactions = PaymentTransaction.objects.filter(
            member=request.user
        ).order_by('-created_at')

        seen_pending = set()
        filtered = []
        for t in all_transactions:
            if t.status == 'pending':
                if t.payment_request_id not in seen_pending:
                    seen_pending.add(t.payment_request_id)
                    filtered.append(t)
            else:
                filtered.append(t)

        serializer = PaymentTransactionSerializer(filtered, many=True)
        return Response(serializer.data)

    serializer = PaymentTransactionSerializer(transactions, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def close_payment_request(request, payment_id):
    if not is_financial_executive(request.user):
        return Response(
            {'error': 'You do not have permission to close payment requests.'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        payment_request = PaymentRequest.objects.get(id=payment_id)
        payment_request.status = 'closed'
        payment_request.save()
        return Response({'message': 'Payment request closed successfully.'})
    except PaymentRequest.DoesNotExist:
        return Response(
            {'error': 'Payment request not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_village_payment_status(request):
    if request.user.account_status != 'approved':
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )

    payment_request_id = request.query_params.get('payment_request_id')
    villages = Village.objects.all()

    result = []
    for village in villages:
        village_status = None
        if payment_request_id:
            village_status = VillagePaymentStatus.objects.filter(
                payment_request_id=payment_request_id,
                village=village
            ).first()

        result.append({
            'village': village.name,
            'village_id': village.id,
            'status': village_status.status if village_status else 'unpaid',
            'paid_at': village_status.paid_at if village_status else None,
            'paid_by': str(village_status.paid_by) if village_status and village_status.paid_by else None,
        })

    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_closed_requests(request):
    closed = PaymentRequest.objects.filter(
        models.Q(status='closed') | models.Q(deadline__lt=timezone.now())
    ).order_by('-created_at')
    serializer = PaymentRequestSerializer(closed, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reactivate_payment_request(request, payment_id):
    if not is_financial_executive(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        payment_request = PaymentRequest.objects.get(id=payment_id)
        deadline = request.data.get('deadline')
        payment_request.status = 'active'
        if deadline:
            from django.utils.dateparse import parse_datetime
            payment_request.deadline = parse_datetime(deadline)
        payment_request.save()

        from accounts.models import CustomUser
        from notifications.views import create_notification
        approved_members = CustomUser.objects.filter(account_status='approved')
        for member in approved_members:
            try:
                create_notification(
                    member=member,
                    title=f'Payment Reactivated: {payment_request.title}',
                    body=f'NGN {payment_request.amount:,.0f} — Late payment window is now open. New deadline: {payment_request.deadline.strftime("%d %B %Y") if payment_request.deadline else "No deadline"}',
                    notification_type='payment'
                )
            except Exception as e:
                print(f"Notification error during reactivation: {e}")

        return Response({'message': 'Payment request reactivated successfully.'})
    except PaymentRequest.DoesNotExist:
        return Response({'error': 'Payment request not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_payment_request_audit(request, payment_id):
    if not is_financial_executive(request.user):
        return Response(
            {'error': 'Permission denied.'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        payment_request = PaymentRequest.objects.get(id=payment_id)
    except PaymentRequest.DoesNotExist:
        return Response({'error': 'Payment request not found.'}, status=404)

    # Query 1: All approved members with their village
    members = list(
        CustomUser.objects.filter(account_status='approved')
        .select_related('village', 'position')
        .order_by('village__name', 'last_name')
    )

    # Query 2: IDs of members who have paid successfully
    paid_member_ids = set(
        PaymentTransaction.objects.filter(
            payment_request=payment_request,
            status='success'
        ).values_list('member_id', flat=True)
    )

    # In-memory O(1) status mapping
    checklist = []
    paid_count = 0
    unpaid_count = 0

    for member in members:
        is_paid = member.id in paid_member_ids
        if is_paid:
            paid_count += 1
        else:
            unpaid_count += 1

        checklist.append({
            'user_id': member.user_id,
            'name': f'{member.first_name} {member.last_name}',
            'village': member.village.name if member.village else 'N/A',
            'position': member.position.title if member.position else 'Floor Member',
            'role': member.role,
            'status': 'paid' if is_paid else 'unpaid',
        })

    return Response({
        'payment_request': {
            'id': payment_request.id,
            'title': payment_request.title,
            'description': payment_request.description,
            'amount': str(payment_request.amount),
            'payment_type': payment_request.payment_type,
            'deadline': payment_request.deadline,
            'status': payment_request.status,
        },
        'summary': {
            'total_members': len(members),
            'paid_count': paid_count,
            'unpaid_count': unpaid_count,
            'compliance_rate': round((paid_count / len(members) * 100), 1) if members else 0,
        },
        'checklist': checklist,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def download_receipt(request, reference):
    # Support both JWT header auth AND token query param (for mobile direct URL)
    user = None

    # Try header auth first
    if request.user and request.user.is_authenticated:
        user = request.user
    else:
        # Try token query param
        token = request.query_params.get('token')
        if token:
            try:
                from rest_framework_simplejwt.tokens import AccessToken
                from accounts.models import CustomUser
                access_token = AccessToken(token)
                user = CustomUser.objects.get(id=access_token['user_id'])
            except Exception:
                return Response({'error': 'Invalid token.'}, status=401)

    if not user:
        return Response({'error': 'Authentication required.'}, status=401)

    try:
        transaction = PaymentTransaction.objects.get(
            paystack_reference=reference,
            status='success'
        )
    except PaymentTransaction.DoesNotExist:
        return Response({'error': 'Receipt not found.'}, status=404)

    if transaction.member != user and not is_financial_executive(user):
        return Response({'error': 'Permission denied.'}, status=403)

    # ─── PDF GENERATION IMPORTS ──────────────────────────────────
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from io import BytesIO

    buffer = BytesIO()
    width, height = A4
    c = canvas.Canvas(buffer, pagesize=A4)

    # ─── MODERN FINTECH COLOR PALETTE ────────────────────────────
    # Clean, premium, trust-inducing colors
    primary = colors.HexColor('#0A0A0F')        # Almost black
    secondary = colors.HexColor('#1A1A2E')      # Dark navy
    text_primary = colors.HexColor('#0F172A')   # Slate 900
    text_secondary = colors.HexColor('#334155') # Slate 700
    text_muted = colors.HexColor('#64748B')     # Slate 500
    text_light = colors.HexColor('#94A3B8')     # Slate 400
    
    accent = colors.HexColor('#0EA5E9')         # Sky Blue 500 (trustworthy)
    accent_dark = colors.HexColor('#0284C7')    # Sky Blue 600
    accent_light = colors.HexColor('#E0F2FE')   # Sky Blue 50
    
    success = colors.HexColor('#10B981')        # Emerald 500
    success_dark = colors.HexColor('#059669')   # Emerald 600
    success_bg = colors.HexColor('#D1FAE5')     # Emerald 100
    success_text = colors.HexColor('#065F46')   # Emerald 800
    
    gold = colors.HexColor('#F59E0B')           # Amber 500
    gold_light = colors.HexColor('#FEF3C7')     # Amber 100
    
    border = colors.HexColor('#E2E8F0')         # Slate 200
    border_light = colors.HexColor('#F1F5F9')   # Slate 50
    card_bg = colors.white
    
    # ─── CLEAN WHITE CANVAS ────────────────────────────────────────
    c.setFillColor(colors.white)
    c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # Top accent bar - gradient effect with two colors
    c.setFillColor(accent)
    c.rect(0, height - 4*mm, width, 4*mm, fill=True, stroke=False)
    c.setFillColor(accent_dark)
    c.rect(0, height - 4*mm, width * 0.3, 4*mm, fill=True, stroke=False)
    
    # Bottom accent bar
    c.setFillColor(accent)
    c.rect(0, 0, width, 2.5*mm, fill=True, stroke=False)

    # ─── HEADER SECTION ────────────────────────────────────────────
    margin = 18*mm
    content_w = width - 2*margin
    y = height - 4*mm - 16*mm
    
    # Logo placeholder with modern design
    logo_size = 8*mm
    logo_x = margin
    logo_y = y
    
    # Outer circle with gradient effect
    c.setFillColor(accent_light)
    c.circle(logo_x, logo_y, logo_size, fill=True, stroke=False)
    c.setStrokeColor(accent)
    c.setLineWidth(1.5)
    c.circle(logo_x, logo_y, logo_size, fill=False, stroke=True)
    
    # Inner circle
    c.setStrokeColor(accent_dark)
    c.setLineWidth(0.8)
    c.circle(logo_x, logo_y, logo_size - 2*mm, fill=False, stroke=True)
    
    # Brand initial
    c.setFillColor(accent)
    c.setFont('Helvetica-Bold', 14)
    c.drawCentredString(logo_x, logo_y - 3*mm, "U")
    
    # Organization name
    org_x = logo_x + logo_size + 5*mm
    c.setFillColor(primary)
    c.setFont('Helvetica-Bold', 14)
    c.drawString(org_x, y + 2*mm, "Umuagu General Youth")
    c.setFont('Helvetica-Bold', 11)
    c.drawString(org_x, y - 4.5*mm, "Association")
    
    # Tagline
    c.setFillColor(text_muted)
    c.setFont('Helvetica', 6.5)
    c.drawString(org_x, y - 9*mm, "Umuagu, Ufuma • Orumba LGA, Anambra State")
    
    # Receipt badge on the right
    badge_w = 35*mm
    badge_h = 14*mm
    badge_x = width - margin - badge_w
    
    # Badge background with subtle gradient
    c.setFillColor(accent_light)
    c.roundRect(badge_x, y - 4*mm, badge_w, badge_h, 3*mm, fill=True, stroke=False)
    c.setStrokeColor(accent)
    c.setLineWidth(0.8)
    c.roundRect(badge_x, y - 4*mm, badge_w, badge_h, 3*mm, fill=False, stroke=True)
    
    c.setFillColor(accent)
    c.setFont('Helvetica-Bold', 6)
    c.drawCentredString(badge_x + badge_w/2, y - 1*mm, "RECEIPT")
    receipt_num = transaction.receipt_number or reference[:12].upper()
    c.setFont('Helvetica-Bold', 8)
    c.drawCentredString(badge_x + badge_w/2, y - 6.5*mm, f"#{receipt_num}")
    
    y -= 18*mm
    
    # ─── DIVIDER ────────────────────────────────────────────────────
    c.setStrokeColor(border)
    c.setLineWidth(0.8)
    c.line(margin, y, width - margin, y)
    
    y -= 12*mm

    # ─── SUCCESS BADGE ─────────────────────────────────────────────
    badge_icon_size = 10*mm
    badge_icon_x = width/2
    badge_icon_y = y
    
    # Glow effect (multiple layers)
    for i, alpha in enumerate([0.05, 0.08, 0.12]):
        c.setFillColor(colors.HexColor('#10B981'))
        c.circle(badge_icon_x, badge_icon_y, badge_icon_size + i*2*mm, fill=True, stroke=False)
    
    # Main circle
    c.setFillColor(success_bg)
    c.circle(badge_icon_x, badge_icon_y, badge_icon_size, fill=True, stroke=False)
    c.setStrokeColor(success)
    c.setLineWidth(1.5)
    c.circle(badge_icon_x, badge_icon_y, badge_icon_size, fill=False, stroke=True)
    
    # Checkmark
    c.setFillColor(success)
    c.setFont('Helvetica-Bold', 16)
    c.drawCentredString(badge_icon_x, badge_icon_y - 4*mm, "✓")
    
    y -= badge_icon_size + 10*mm
    
    # Status text
    c.setFillColor(text_primary)
    c.setFont('Helvetica-Bold', 14)
    c.drawCentredString(width/2, y, "Payment Confirmed")
    
    y -= 6*mm
    c.setFillColor(text_muted)
    c.setFont('Helvetica', 8)
    c.drawCentredString(width/2, y, "Your transaction has been successfully verified")
    
    y -= 12*mm

    # ─── AMOUNT CARD ───────────────────────────────────────────────
    amount_card_h = 25*mm
    amount_card_y = y - amount_card_h
    
    # Card shadow
    c.setFillColor(colors.HexColor('#F8FAFC'))
    c.roundRect(margin + 1*mm, amount_card_y - 1*mm, content_w, amount_card_h, 4*mm, fill=True, stroke=False)
    
    # Card background
    c.setFillColor(accent_light)
    c.roundRect(margin, amount_card_y, content_w, amount_card_h, 4*mm, fill=True, stroke=False)
    c.setStrokeColor(accent)
    c.setLineWidth(0.8)
    c.roundRect(margin, amount_card_y, content_w, amount_card_h, 4*mm, fill=False, stroke=True)
    
    # Amount label
    c.setFillColor(text_muted)
    c.setFont('Helvetica-Bold', 7)
    c.drawCentredString(width/2, amount_card_y + 14*mm, "AMOUNT PAID")
    
    # Amount value
    amount_text = f"₦{float(transaction.amount):,.2f}"
    c.setFillColor(text_primary)
    c.setFont('Helvetica-Bold', 28)
    c.drawCentredString(width/2, amount_card_y + 4*mm, amount_text)
    
    y = amount_card_y - 14*mm

    # ─── DETAILS TABLE ─────────────────────────────────────────────
    details = [
        ("Receipt Number", transaction.receipt_number or "N/A"),
        ("Paystack Reference", transaction.paystack_reference or "N/A"),
        ("Member Name", str(transaction.member) if transaction.member else "N/A"),
        ("Member ID", transaction.member.user_id if transaction.member else "N/A"),
        ("Payment For", transaction.payment_request.title if transaction.payment_request else "N/A"),
        ("Payment Type", (transaction.payment_request.payment_type or "N/A").replace("_", " ").title() if transaction.payment_request else "N/A"),
        ("Village", str(transaction.village) if transaction.village else "N/A"),
        ("Date Initiated", transaction.created_at.strftime("%d %b %Y, %I:%M %p") if transaction.created_at else "N/A"),
        ("Date Confirmed", transaction.paid_at.strftime("%d %b %Y, %I:%M %p") if transaction.paid_at else "N/A"),
        ("Status", None),  # Special handling
    ]
    
    row_h = 9*mm
    table_h = row_h * len(details) + 4*mm
    table_y = y - table_h
    
    # Table background
    c.setFillColor(colors.white)
    c.roundRect(margin, table_y, content_w, table_h, 4*mm, fill=True, stroke=False)
    c.setStrokeColor(border)
    c.setLineWidth(0.8)
    c.roundRect(margin, table_y, content_w, table_h, 4*mm, fill=False, stroke=True)
    
    # Table header row
    header_y = y - 2*mm
    c.setFillColor(border_light)
    c.rect(margin, header_y - row_h, content_w, row_h, fill=True, stroke=False)
    c.setStrokeColor(border)
    c.setLineWidth(0.5)
    c.line(margin, header_y - row_h, width - margin, header_y - row_h)
    
    c.setFillColor(text_muted)
    c.setFont('Helvetica-Bold', 6.5)
    c.drawString(margin + 7*mm, header_y - row_h/2 - 2, "FIELD")
    c.drawRightString(width - margin - 7*mm, header_y - row_h/2 - 2, "VALUE")
    
    # Detail rows
    for i, (label, value) in enumerate(details):
        row_y = header_y - (i + 1) * row_h
        
        # Alternating row backgrounds
        if i % 2 == 0:
            c.setFillColor(border_light)
            c.rect(margin, row_y, content_w, row_h, fill=True, stroke=False)
        
        # Row separator
        if i < len(details) - 1:
            c.setStrokeColor(border)
            c.setLineWidth(0.5)
            c.line(margin + 5*mm, row_y, width - margin - 5*mm, row_y)
        
        text_y = row_y + row_h/2 - 2
        
        # Label
        c.setFillColor(text_secondary)
        c.setFont('Helvetica', 7)
        c.drawString(margin + 7*mm, text_y, label)
        
        # Value
        if label == "Status":
            # Pill for status
            pill_text = "SUCCESSFUL"
            c.setFont('Helvetica-Bold', 6.5)
            pill_w = c.stringWidth(pill_text, 'Helvetica-Bold', 6.5) + 8*mm
            pill_x = width - margin - 7*mm - pill_w
            pill_y = text_y - 1.8*mm
            c.setFillColor(success_bg)
            c.roundRect(pill_x, pill_y, pill_w, 5*mm, 2.5*mm, fill=True, stroke=False)
            c.setFillColor(success_text)
            c.drawCentredString(pill_x + pill_w/2, text_y, pill_text)
        else:
            c.setFillColor(text_primary)
            c.setFont('Helvetica', 7)
            max_width = content_w - 80*mm
            val_text = str(value)
            while c.stringWidth(val_text, 'Helvetica', 7) > max_width and len(val_text) > 6:
                val_text = val_text[:-3] + '...'
            c.drawRightString(width - margin - 7*mm, text_y, val_text)
    
    y = table_y - 12*mm

    # ─── FOOTER SECTION ────────────────────────────────────────────
    # Divider
    c.setStrokeColor(border)
    c.setLineWidth(0.5)
    c.line(margin, y, width - margin, y)
    
    y -= 8*mm
    
    # Footer text
    c.setFillColor(text_muted)
    c.setFont('Helvetica', 6.5)
    c.drawCentredString(width/2, y, "This receipt is electronically generated and requires no physical signature")
    
    y -= 5*mm
    c.setFont('Helvetica', 6)
    c.drawCentredString(width/2, y, "Any unauthorized alteration renders this document invalid")
    
    y -= 7*mm
    
    # Transaction ID reference
    c.setFillColor(text_light)
    c.setFont('Helvetica', 5.5)
    c.drawCentredString(width/2, y, f"Transaction Reference: {transaction.paystack_reference or 'N/A'}")
    
    # ─── QR CODE PLACEHOLDER ───────────────────────────────────────
    # (Optional - adds a modern touch)
    qr_size = 12*mm
    qr_x = width - margin - qr_size
    qr_y = y - qr_size - 3*mm
    
    # QR placeholder box
    c.setFillColor(border_light)
    c.rect(qr_x, qr_y, qr_size, qr_size, fill=True, stroke=False)
    c.setStrokeColor(border)
    c.setLineWidth(0.5)
    c.rect(qr_x, qr_y, qr_size, qr_size, fill=False, stroke=True)
    
    # QR pattern simulation (dots)
    c.setFillColor(text_light)
    dot_size = 1*mm
    for i in range(5):
        for j in range(5):
            if (i + j) % 2 == 0:
                c.rect(
                    qr_x + 1.5*mm + i*2*mm,
                    qr_y + 1.5*mm + j*2*mm,
                    dot_size, dot_size,
                    fill=True, stroke=False
                )
    
    c.setFillColor(text_light)
    c.setFont('Helvetica', 4.5)
    c.drawCentredString(qr_x + qr_size/2, qr_y - 2.5*mm, "SCAN TO VERIFY")
    
    # ─── ORGANIZATION DETAILS ──────────────────────────────────────
    org_details_y = qr_y - 8*mm
    c.setFillColor(text_muted)
    c.setFont('Helvetica', 5.5)
    c.drawString(margin, org_details_y, "Umuagu General Youth Association")
    c.drawString(margin, org_details_y - 3.5*mm, "Umuagu, Ufuma")
    c.drawString(margin, org_details_y - 7*mm, "Orumba LGA, Anambra State, Nigeria")
    
    # ─── SAVE AND RETURN ──────────────────────────────────────────
    c.save()
    buffer.seek(0)

    from django.http import HttpResponse
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    filename = f"receipt-{transaction.receipt_number or reference}.pdf"
    response['Content-Disposition'] = f'inline; filename="{filename}"'
    return response