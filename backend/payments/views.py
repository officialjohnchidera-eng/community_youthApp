from rest_framework import status
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
                # Email via SendGrid (HTTPS, won't hang like SMTP)
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

                # In-app notification
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

            # Push notification
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
            # Catch-all: even if the entire notification block fails,
            # the payment request itself was already saved successfully
            print(f"Notification block error: {e}")

        return Response({
            'message': 'Payment request created successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_payment_requests(request):
    # Auto close expired requests
    PaymentRequest.objects.filter(
        status='active',
        deadline__lt=timezone.now()
    ).update(status='closed')

    if request.user.account_status != 'approved':
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    payment_requests = PaymentRequest.objects.filter(status='active').order_by('-created_at')
    serializer = PaymentRequestSerializer(payment_requests, many=True)
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

        # Restrict monthly dues and levy to Village Presidents only
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

        # CRITICAL: wrap the entire Paystack call so ANY failure
        # (timeout, connection error, bad JSON) marks the transaction failed
        # instead of leaving it stuck as pending forever
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
            # Network error, timeout, connection refused, etc.
            transaction.status = 'failed'
            transaction.save()
            print(f"Paystack request error: {e}")
            return Response(
                {'error': 'Could not reach payment provider. Please try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except (KeyError, ValueError) as e:
            # Unexpected response format
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
        # Don't change status on network error during verification -
        # let the periodic cleanup handle it if it truly is stale

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

    # Auto-expire stale pending transactions before returning history
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
            except Exception:
                pass

        return Response({'message': 'Payment request reactivated successfully.'})
    except PaymentRequest.DoesNotExist:
        return Response({'error': 'Payment request not found.'}, status=status.HTTP_404_NOT_FOUND)