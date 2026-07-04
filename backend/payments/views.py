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
import os


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
                        subject=f'New Payment Request - {payment_request.title}',
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

    active_requests = PaymentRequest.objects.filter(status='active').order_by('-created_at')

    already_paid_ids = set(
        PaymentTransaction.objects.filter(
            member=request.user,
            status='success'
        ).values_list('payment_request_id', flat=True)
    )

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

        # Cancel any existing pending attempt before starting a new one
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
                    body=f'NGN {payment_request.amount:,.0f} - Late payment window is now open. New deadline: {payment_request.deadline.strftime("%d %B %Y") if payment_request.deadline else "No deadline"}',
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

    members = list(
        CustomUser.objects.filter(account_status='approved')
        .select_related('village', 'position')
        .order_by('village__name', 'last_name')
    )

    paid_member_ids = set(
        PaymentTransaction.objects.filter(
            payment_request=payment_request,
            status='success'
        ).values_list('member_id', flat=True)
    )

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

    if request.user and request.user.is_authenticated:
        user = request.user
    else:
        token = request.query_params.get('token')
        if token:
            try:
                from rest_framework_simplejwt.tokens import AccessToken
                from rest_framework_simplejwt.exceptions import TokenError
                from accounts.models import CustomUser
                import urllib.parse
                decoded_token = urllib.parse.unquote(token)
                access_token = AccessToken(decoded_token)
                user = CustomUser.objects.get(id=access_token['user_id'])
            except Exception as e:
                print(f"Token error: {e}")
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

    # ─── PDF GENERATION ──────────────────────────────────────────
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.lib.utils import ImageReader
        from io import BytesIO
    except ImportError as e:
        print(f"ReportLab import error: {e}")
        return Response({'error': 'PDF generation library not available.'}, status=500)

    try:
        buffer = BytesIO()
        width, height = A4
        c = canvas.Canvas(buffer, pagesize=A4)

        # ─── CLEAN MODERN COLOR PALETTE ──────────────────────────
        # Simple, clean colors matching the screenshot
        white = colors.HexColor('#FFFFFF')
        black = colors.HexColor('#000000')
        dark = colors.HexColor('#1A1A2E')
        dark_gray = colors.HexColor('#2D2D44')
        gray = colors.HexColor('#6B6B8A')
        light_gray = colors.HexColor('#E8E8F0')
        gold = colors.HexColor('#C9A84C')
        gold_light = colors.HexColor('#F5E6C8')
        green = colors.HexColor('#10B981')
        green_light = colors.HexColor('#D1FAE5')

        # ─── WHITE BACKGROUND ─────────────────────────────────────
        c.setFillColor(white)
        c.rect(0, 0, width, height, fill=True, stroke=False)

        # ─── TOP ACCENT BAR ──────────────────────────────────────
        c.setFillColor(gold)
        c.rect(0, height - 3*mm, width, 3*mm, fill=True, stroke=False)

        # ─── HEADER SECTION ──────────────────────────────────────
        margin = 18*mm
        y = height - 20*mm

        # Try to load leopard logo
        logo_loaded = False
        logo_size = 14*mm
        logo_x = margin
        logo_y = y - logo_size/2

        possible_paths = [
            os.path.join(settings.BASE_DIR, 'frontend', 'public', 'leopard.jpg'),
            os.path.join(settings.BASE_DIR, 'frontend', 'public', 'images', 'leopard.jpg'),
            os.path.join(settings.BASE_DIR, 'static', 'leopard.jpg'),
            os.path.join(settings.BASE_DIR, 'static', 'images', 'leopard.jpg'),
            os.path.join(settings.BASE_DIR, 'media', 'leopard.jpg'),
        ]

        if hasattr(settings, 'FRONTEND_DIR'):
            possible_paths.insert(0, os.path.join(settings.FRONTEND_DIR, 'public', 'leopard.jpg'))

        for path in possible_paths:
            if path and os.path.exists(path):
                try:
                    logo = ImageReader(path)
                    c.drawImage(logo, logo_x, logo_y, width=logo_size, height=logo_size, mask='auto')
                    logo_loaded = True
                    print(f"Logo loaded from: {path}")
                    break
                except Exception as e:
                    print(f"Logo loading error from {path}: {e}")
                    continue

        if not logo_loaded:
            # Fallback: draw a simple circle with "U"
            cx = logo_x + logo_size/2
            cy = logo_y + logo_size/2
            c.setFillColor(gold_light)
            c.circle(cx, cy, logo_size/2, fill=True, stroke=False)
            c.setStrokeColor(gold)
            c.setLineWidth(1)
            c.circle(cx, cy, logo_size/2, fill=False, stroke=True)
            c.setFillColor(gold)
            c.setFont('Helvetica-Bold', 12)
            c.drawCentredString(cx, cy - 3, "U")

        # Organization name - centered
        org_y = height - 20*mm
        c.setFillColor(black)
        c.setFont('Helvetica-Bold', 18)
        c.drawCentredString(width/2, org_y + 8*mm, "UMUAGU GENERAL YOUTH ASSOCIATION")

        c.setFillColor(gray)
        c.setFont('Helvetica', 9)
        c.drawCentredString(width/2, org_y - 2*mm, "Umuagu, Ufuma • Orumba LGA, Anambra State")

        y = height - 40*mm

        # ─── SUCCESS MESSAGE ──────────────────────────────────────
        c.setFillColor(green)
        c.setFont('Helvetica-Bold', 24)
        c.drawCentredString(width/2, y, "PAYMENT SUCCESSFUL")

        y -= 10*mm

        # ─── DIVIDER ──────────────────────────────────────────────
        c.setStrokeColor(light_gray)
        c.setLineWidth(0.5)
        c.line(margin, y, width - margin, y)

        y -= 12*mm

        # ─── AMOUNT SECTION ───────────────────────────────────────
        c.setFillColor(gray)
        c.setFont('Helvetica', 10)
        c.drawCentredString(width/2, y + 10*mm, "Amount Paid")

        c.setFillColor(black)
        c.setFont('Helvetica-Bold', 32)
        amount_text = f"NGN {float(transaction.amount):,.2f}"
        c.drawCentredString(width/2, y)

        y -= 16*mm

        # ─── DETAILS TABLE ────────────────────────────────────────
        # Simple clean table with labels on left, values on right
        details = [
            ("Receipt No.", transaction.receipt_number if hasattr(transaction, 'receipt_number') and transaction.receipt_number else f"RCP-{reference[:8].upper()}"),
            ("Reference", transaction.paystack_reference or "N/A"),
            ("Received From", str(transaction.member) if transaction.member else "N/A"),
            ("Payment For", transaction.payment_request.title.upper() if transaction.payment_request else "N/A"),
            ("Village", str(transaction.village) if transaction.village else "N/A"),
            ("Date", transaction.paid_at.strftime("%d/%m/%Y") if transaction.paid_at else "N/A"),
            ("Paid At", transaction.paid_at.strftime("%d/%m/%Y") if transaction.paid_at else "N/A"),
            ("Transaction ID", transaction.paystack_reference or "N/A"),
        ]

        row_h = 8*mm
        table_y = y - 4*mm

        # Draw table rows
        for i, (label, value) in enumerate(details):
            row_y = table_y - i * row_h

            # Label
            c.setFillColor(gray)
            c.setFont('Helvetica', 9)
            c.drawString(margin, row_y, label)

            # Value
            c.setFillColor(black)
            c.setFont('Helvetica', 9)
            c.drawRightString(width - margin, row_y, value)

            # Separator line
            if i < len(details) - 1:
                c.setStrokeColor(light_gray)
                c.setLineWidth(0.3)
                c.line(margin, row_y - 2*mm, width - margin, row_y - 2*mm)

        y = table_y - (len(details) * row_h) - 8*mm

        # ─── FOOTER ────────────────────────────────────────────────
        c.setStrokeColor(light_gray)
        c.setLineWidth(0.5)
        c.line(margin, y, width - margin, y)

        y -= 8*mm

        c.setFillColor(gray)
        c.setFont('Helvetica', 8)
        c.drawCentredString(width/2, y, "This receipt is computer generated and valid without a physical signature.")

        y -= 5*mm
        c.drawCentredString(width/2, y, "Any alteration renders this document invalid.")

        # ─── BOTTOM ACCENT BAR ─────────────────────────────────────
        c.setFillColor(gold)
        c.rect(0, 0, width, 2*mm, fill=True, stroke=False)

        # ─── SAVE ──────────────────────────────────────────────────
        c.save()
        buffer.seek(0)

        from django.http import HttpResponse
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        filename = f"receipt-{transaction.receipt_number if hasattr(transaction, 'receipt_number') and transaction.receipt_number else reference[:8]}.pdf"
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({'error': f'Failed to generate receipt: {str(e)}'}, status=500)