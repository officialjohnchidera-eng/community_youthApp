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
@permission_classes([IsAuthenticated])
def download_receipt(request, reference):
    try:
        transaction = PaymentTransaction.objects.get(
            paystack_reference=reference,
            status='success'
        )
    except PaymentTransaction.DoesNotExist:
        return Response({'error': 'Receipt not found.'}, status=404)

    if transaction.member != request.user and not is_financial_executive(request.user):
        return Response({'error': 'Permission denied.'}, status=403)

    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from io import BytesIO
    import math

    buffer = BytesIO()
    width, height = A4
    c = canvas.Canvas(buffer, pagesize=A4)

    # ─── COLOR PALETTE ────────────────────────────────────────────
    dark_navy    = colors.HexColor('#0a0f1e')
    navy         = colors.HexColor('#0f172a')
    card_dark    = colors.HexColor('#1e293b')
    card_light   = colors.HexColor('#243044')
    emerald      = colors.HexColor('#10b981')
    emerald_dark = colors.HexColor('#059669')
    emerald_glow = colors.HexColor('#d1fae5')
    gold         = colors.HexColor('#f59e0b')
    white        = colors.white
    light_gray   = colors.HexColor('#e2e8f0')
    mid_gray     = colors.HexColor('#94a3b8')
    dark_gray    = colors.HexColor('#475569')
    border_color = colors.HexColor('#1e3a5f')

    # ─── DARK BACKGROUND ──────────────────────────────────────────
    c.setFillColor(dark_navy)
    c.rect(0, 0, width, height, fill=True, stroke=False)

    # ─── SUBTLE GRID PATTERN ──────────────────────────────────────
    c.setStrokeColor(colors.HexColor('#0d1528'))
    c.setLineWidth(0.3)
    for x in range(0, int(width), 20):
        c.line(x, 0, x, height)
    for y in range(0, int(height), 20):
        c.line(0, y, width, y)

    # ─── WATERMARK ────────────────────────────────────────────────
    c.saveState()
    c.setFont('Helvetica-Bold', 52)
    c.setFillColor(colors.HexColor('#0d1a2e'))
    c.translate(width / 2, height / 2)
    c.rotate(35)
    c.drawCentredString(0, 40, "UMUAGU YOUTH")
    c.drawCentredString(0, -40, "UMUAGU YOUTH")
    c.drawCentredString(0, 120, "UMUAGU YOUTH")
    c.drawCentredString(0, -120, "UMUAGU YOUTH")
    c.restoreState()

    # ─── TOP ACCENT BAR ───────────────────────────────────────────
    c.setFillColor(emerald)
    c.rect(0, height - 6*mm, width, 6*mm, fill=True, stroke=False)

    # Gold accent line
    c.setFillColor(gold)
    c.rect(0, height - 8*mm, width, 2*mm, fill=True, stroke=False)

    # ─── HEADER SECTION ───────────────────────────────────────────
    header_y = height - 45*mm

    # Organization name
    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 18)
    c.drawCentredString(width / 2, height - 22*mm, "UMUAGU GENERAL YOUTH ASSOCIATION")

    # Tagline
    c.setFillColor(mid_gray)
    c.setFont('Helvetica', 9)
    c.drawCentredString(width / 2, height - 29*mm, "Umuagu, Ufuma Orumba LGA, Anambra State, Nigeria")

    # Divider line with emerald glow
    c.setStrokeColor(emerald)
    c.setLineWidth(1.5)
    c.line(20*mm, height - 34*mm, width - 20*mm, height - 34*mm)

    # PAYMENT RECEIPT label
    c.setFillColor(mid_gray)
    c.setFont('Helvetica', 8)
    c.drawCentredString(width / 2, height - 39*mm, "OFFICIAL PAYMENT RECEIPT")

    # Receipt number
    c.setFillColor(emerald)
    c.setFont('Helvetica-Bold', 8)
    receipt_num = transaction.receipt_number or reference[:12].upper()
    c.drawCentredString(width / 2, height - 44*mm, f"#{receipt_num}")

    # ─── SUCCESS BADGE ────────────────────────────────────────────
    badge_y = height - 65*mm
    badge_w = 70*mm
    badge_x = (width - badge_w) / 2

    # Badge glow effect (multiple layers)
    for i, alpha in enumerate([0.08, 0.12, 0.18]):
        glow_color = colors.HexColor('#10b981')
        c.setFillColor(colors.HexColor('#0d2e20'))
        c.roundRect(badge_x - (i*2), badge_y - (i*2), badge_w + (i*4), 10*mm + (i*4), 5*mm, fill=True, stroke=False)

    c.setFillColor(emerald)
    c.roundRect(badge_x, badge_y, badge_w, 10*mm, 5*mm, fill=True, stroke=False)

    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 11)
    c.drawCentredString(width / 2, badge_y + 3.5*mm, "✓  PAYMENT CONFIRMED")

    # ─── AMOUNT SECTION ───────────────────────────────────────────
    amount_y = height - 90*mm

    c.setFillColor(mid_gray)
    c.setFont('Helvetica', 9)
    c.drawCentredString(width / 2, amount_y + 12*mm, "AMOUNT PAID")

    c.setFillColor(emerald)
    c.setFont('Helvetica-Bold', 36)
    amount_text = f"NGN {float(transaction.amount):,.2f}"
    c.drawCentredString(width / 2, amount_y, amount_text)

    # Underline for amount
    c.setStrokeColor(emerald_dark)
    c.setLineWidth(0.8)
    amount_width = c.stringWidth(amount_text, 'Helvetica-Bold', 36)
    c.line(
        width/2 - amount_width/2,
        amount_y - 2*mm,
        width/2 + amount_width/2,
        amount_y - 2*mm
    )

    # ─── DETAILS CARD ─────────────────────────────────────────────
    card_x = 15*mm
    card_y = 65*mm
    card_w = width - 30*mm
    card_h = height - 110*mm - 65*mm

    # Card shadow
    c.setFillColor(colors.HexColor('#060b15'))
    c.roundRect(card_x + 1.5, card_y - 1.5, card_w, card_h, 4*mm, fill=True, stroke=False)

    # Card background
    c.setFillColor(card_dark)
    c.roundRect(card_x, card_y, card_w, card_h, 4*mm, fill=True, stroke=False)

    # Card border
    c.setStrokeColor(border_color)
    c.setLineWidth(0.8)
    c.roundRect(card_x, card_y, card_w, card_h, 4*mm, fill=False, stroke=True)

    # Card header strip
    c.setFillColor(card_light)
    c.roundRect(card_x, card_y + card_h - 10*mm, card_w, 10*mm, 4*mm, fill=True, stroke=False)
    c.rect(card_x, card_y + card_h - 10*mm, card_w, 5*mm, fill=True, stroke=False)

    c.setFillColor(emerald)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(card_x + 8*mm, card_y + card_h - 6*mm, "TRANSACTION DETAILS")

    # Detail rows
    details = [
        ("Receipt Number", transaction.receipt_number or "N/A"),
        ("Paystack Reference", transaction.paystack_reference or "N/A"),
        ("Member Name", str(transaction.member) if transaction.member else "N/A"),
        ("Member ID", transaction.member.user_id if transaction.member else "N/A"),
        ("Payment For", transaction.payment_request.title if transaction.payment_request else "N/A"),
        ("Payment Type", (transaction.payment_request.payment_type or "N/A").replace("_", " ").title() if transaction.payment_request else "N/A"),
        ("Village", str(transaction.village) if transaction.village else "N/A"),
        ("Date Initiated", transaction.created_at.strftime("%d %B %Y, %I:%M %p") if transaction.created_at else "N/A"),
        ("Date Confirmed", transaction.paid_at.strftime("%d %B %Y, %I:%M %p") if transaction.paid_at else "N/A"),
        ("Status", "SUCCESSFUL ✓"),
    ]

    row_h = (card_h - 12*mm) / len(details)
    for i, (label, value) in enumerate(details):
        row_y = card_y + card_h - 12*mm - (i + 1) * row_h

        # Alternating row background
        if i % 2 == 0:
            c.setFillColor(colors.HexColor('#1a2844'))
            c.rect(card_x + 1, row_y, card_w - 2, row_h, fill=True, stroke=False)

        # Separator line
        if i > 0:
            c.setStrokeColor(colors.HexColor('#1e3a5f'))
            c.setLineWidth(0.3)
            c.line(card_x + 5*mm, row_y + row_h, card_x + card_w - 5*mm, row_y + row_h)

        # Label
        c.setFillColor(mid_gray)
        c.setFont('Helvetica', 7.5)
        c.drawString(card_x + 6*mm, row_y + row_h/2 - 2, label)

        # Value
        if label == "Status":
            c.setFillColor(emerald)
        else:
            c.setFillColor(light_gray)
        c.setFont('Helvetica-Bold', 8)

        # Truncate long values
        max_val_width = card_w - 70*mm
        val_text = str(value)
        while c.stringWidth(val_text, 'Helvetica-Bold', 8) > max_val_width and len(val_text) > 10:
            val_text = val_text[:-4] + '...'

        c.drawRightString(card_x + card_w - 6*mm, row_y + row_h/2 - 2, val_text)

    # ─── TRANSACTION ID BOX ───────────────────────────────────────
    txn_box_y = 45*mm
    txn_box_x = 15*mm
    txn_box_w = width - 30*mm

    c.setFillColor(colors.HexColor('#0d1f35'))
    c.roundRect(txn_box_x, txn_box_y, txn_box_w, 14*mm, 3*mm, fill=True, stroke=False)
    c.setStrokeColor(emerald)
    c.setLineWidth(0.8)
    c.roundRect(txn_box_x, txn_box_y, txn_box_w, 14*mm, 3*mm, fill=False, stroke=True)

    c.setFillColor(mid_gray)
    c.setFont('Helvetica', 7)
    c.drawCentredString(width / 2, txn_box_y + 9*mm, "TRANSACTION ID")

    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 9)
    c.drawCentredString(width / 2, txn_box_y + 4*mm, transaction.paystack_reference or "N/A")

    # ─── BOTTOM ACCENT BAR ────────────────────────────────────────
    c.setFillColor(card_dark)
    c.rect(0, 0, width, 35*mm, fill=True, stroke=False)

    c.setStrokeColor(border_color)
    c.setLineWidth(0.5)
    c.line(0, 35*mm, width, 35*mm)

    # Footer text
    c.setFillColor(dark_gray)
    c.setFont('Helvetica-Oblique', 7)
    c.drawCentredString(width / 2, 25*mm, "This receipt is computer generated and valid without a physical signature.")
    c.drawCentredString(width / 2, 20*mm, "Any alteration renders this document invalid.")

    c.setFillColor(mid_gray)
    c.setFont('Helvetica', 7)
    c.drawCentredString(width / 2, 13*mm, "Umuagu General Youth Association  •  Ufuma Orumba LGA, Anambra State")

    # Gold bottom bar
    c.setFillColor(gold)
    c.rect(0, 0, width, 3*mm, fill=True, stroke=False)

    c.setFillColor(emerald)
    c.rect(0, 3*mm, width, 2*mm, fill=True, stroke=False)

    # ─── SEAL / STAMP ─────────────────────────────────────────────
    seal_x = width - 38*mm
    seal_y = 15*mm

    c.setStrokeColor(emerald)
    c.setFillColor(colors.HexColor('#0d2e20'))
    c.setLineWidth(1.5)
    c.circle(seal_x, seal_y, 12*mm, fill=True, stroke=True)

    c.setStrokeColor(emerald_dark)
    c.setLineWidth(0.8)
    c.circle(seal_x, seal_y, 10*mm, fill=False, stroke=True)

    c.setFillColor(emerald)
    c.setFont('Helvetica-Bold', 6)
    c.drawCentredString(seal_x, seal_y + 3*mm, "VERIFIED")
    c.setFont('Helvetica-Bold', 14)
    c.drawCentredString(seal_x, seal_y - 2*mm, "✓")
    c.setFont('Helvetica', 5)
    c.setFillColor(mid_gray)
    c.drawCentredString(seal_x, seal_y - 6*mm, "OFFICIAL")

    c.save()
    buffer.seek(0)

    from django.http import HttpResponse
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    filename = f"receipt-{transaction.receipt_number or reference}.pdf"
    response['Content-Disposition'] = f'inline; filename="{filename}"'
    return response