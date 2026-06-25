from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from .models import CustomUser, Position, AccountVerificationLog
from .serializers import (
    RegisterSerializer,
    UserProfileSerializer,
    ApproveRejectSerializer,
    VillageSerializer,
    PositionSerializer
)
from django.conf import settings
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail


def send_via_sendgrid(to_email, subject, message_body):
    try:
        message = Mail(
            from_email=settings.DEFAULT_FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            plain_text_content=message_body
        )
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(message)
        print(f"SendGrid response: {response.status_code}")
        return True
    except Exception as e:
        print(f"SendGrid email error: {e}")
        return False


def send_registration_email(user):
    message_body = f'''Dear {user.first_name},

Your registration has been received successfully!

Your User ID is: {user.user_id}

Your account is currently pending approval from the President or Vice President. 
You will be notified once your account has been reviewed.

Thank you for joining Umuagu Youth Association.
'''
    send_via_sendgrid(
        to_email=user.email,
        subject='Registration Received — Umuagu Youth Association',
        message_body=message_body
    )


def send_approval_email(user):
    message_body = f'''Dear {user.first_name},

Congratulations! Your account has been approved by the President.

Your User ID is: {user.user_id}

You can now log in to the Umuagu Youth platform and access all features.

Welcome to the organization!
'''
    send_via_sendgrid(
        to_email=user.email,
        subject='Account Approved — Umuagu Youth',
        message_body=message_body
    )


def send_rejection_email(user, reason):
    message_body = f'''Dear {user.first_name},

Your registration has been reviewed and unfortunately was not approved at this time.

Reason: {reason}

You can update your information and resubmit your registration for review.

If you have any questions please contact the organization directly.
'''
    send_via_sendgrid(
        to_email=user.email,
        subject='Account Update — Umuagu Youth',
        message_body=message_body
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_villages(request):
    from .models import Village
    villages = Village.objects.all()
    serializer = VillageSerializer(villages, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_positions(request):
    positions = Position.objects.all()
    serializer = PositionSerializer(positions, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        send_registration_email(user)
        return Response({
            'message': 'Registration successful! Your account is pending approval from the President or Vice President. You will be notified once reviewed.',
            'user_id': user.user_id
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_profile(request):
    serializer = UserProfileSerializer(request.user, context={'request': request})
    return Response(serializer.data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    serializer = UserProfileSerializer(
        request.user,
        data=request.data,
        partial=True,
        context={'request': request}
    )
    if serializer.is_valid():
        serializer.save()
        return Response({
            'message': 'Profile updated successfully.',
            'data': serializer.data
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_pending_accounts(request):
    allowed_positions = ['General President', 'Vice President']
    if not request.user.position or request.user.position.title not in allowed_positions:
        return Response(
            {'error': 'You do not have permission to perform this action.'},
            status=status.HTTP_403_FORBIDDEN
        )

    pending_users = CustomUser.objects.filter(account_status='pending')
    for user in pending_users:
        if user.is_pending_expired():
            user.account_status = 'expired'
            user.save()

    pending_users = CustomUser.objects.filter(account_status='pending')
    serializer = UserProfileSerializer(pending_users, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_reject_account(request, user_id):
    allowed_positions = ['General President', 'Vice President']
    if not request.user.position or request.user.position.title not in allowed_positions:
        return Response(
            {'error': 'You do not have permission to perform this action.'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        member = CustomUser.objects.get(user_id=user_id, account_status='pending')
    except CustomUser.DoesNotExist:
        return Response(
            {'error': 'Pending account not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = ApproveRejectSerializer(data=request.data)
    if serializer.is_valid():
        decision = serializer.validated_data['decision']
        rejection_reason = serializer.validated_data.get('rejection_reason', '')

        member.account_status = decision
        if decision == 'rejected':
            member.rejection_reason = rejection_reason
        if decision == 'approved' and member.position:
            member.position.is_occupied = True
            member.position.save()

        member.save()

        if decision == 'approved':
            send_approval_email(member)
            try:
                from notifications.views import create_notification
                create_notification(
                    member=member,
                    title='Account Approved!',
                    body=f'Welcome {member.first_name}! Your account has been approved. You can now access all features.',
                    notification_type='approval'
                )
            except Exception as e:
                print(f"Notification error: {e}")

        elif decision == 'rejected':
            send_rejection_email(member, rejection_reason)
            try:
                from notifications.views import create_notification
                create_notification(
                    member=member,
                    title='Account Update',
                    body=f'Your account registration was not approved. Reason: {rejection_reason}',
                    notification_type='general'
                )
            except Exception as e:
                print(f"Notification error: {e}")

        AccountVerificationLog.objects.create(
            member=member,
            reviewed_by=request.user,
            decision=decision,
            rejection_reason=rejection_reason,
            submission_number=member.submission_count
        )

        return Response({
            'message': f'Account {decision} successfully.',
            'member': member.user_id
        })

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resubmit_account(request):
    user = request.user

    if user.account_status != 'rejected':
        return Response(
            {'error': 'Only rejected accounts can resubmit.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = RegisterSerializer(user, data=request.data, partial=True)
    if serializer.is_valid():
        user.account_status = 'pending'
        user.pending_since = timezone.now()
        user.resubmitted = True
        user.submission_count += 1
        user.rejection_reason = None
        serializer.save()
        return Response({
            'message': 'Account resubmitted successfully! Awaiting approval.'
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        refresh_token = request.data.get('refresh_token')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({'message': 'Logged out successfully. Token has been invalidated.'})
    except TokenError:
        return Response({'message': 'Logged out successfully.'})
    except Exception:
        return Response({'message': 'Logged out successfully.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_members(request):
    if request.user.account_status != 'approved':
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    members = CustomUser.objects.all().order_by('-date_joined')
    serializer = UserProfileSerializer(members, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_me(request):
    user = request.user
    return Response({
        'id': user.id,
        'user_id': user.user_id,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'village': user.village.name if user.village else None,
        'role': user.role,
        'position': user.position.title if user.position else None,
        'account_status': user.account_status,
        'profile_picture': request.build_absolute_uri(user.profile_picture.url) if user.profile_picture else None,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    email = request.data.get('email')
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = CustomUser.objects.get(email=email)
    except CustomUser.DoesNotExist:
        return Response({'message': 'If this email exists you will receive a reset link.'})
    
    import uuid
    from django.core.cache import cache
    token = str(uuid.uuid4())
    cache.set(f'password_reset_{token}', user.id, timeout=3600)

    reset_link = f'{settings.FRONTEND_URL}/reset-password?token={token}'

    message_body = f'''Dear {user.first_name},

You requested a password reset for your account.

Click the link below to reset your password:
{reset_link}

This link expires in 1 hour.

If you did not request this, please ignore this email.

Umuagu General Youth Association
'''
    sent = send_via_sendgrid(
        to_email=user.email,
        subject='Password Reset — Umuagu Youth Association',
        message_body=message_body
    )

    if not sent:
        return Response({'error': 'Failed to send email. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'message': 'Password reset link sent to your email.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    token = request.data.get('token')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')

    if not token or not new_password or not confirm_password:
        return Response({'error': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if new_password != confirm_password:
        return Response({'error': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 8:
        return Response({'error': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    from django.core.cache import cache
    user_id = cache.get(f'password_reset_{token}')

    if not user_id:
        return Response({'error': 'Reset link is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = CustomUser.objects.get(id=user_id)
        user.set_password(new_password)
        user.save()
        cache.delete(f'password_reset_{token}')
        return Response({'message': 'Password reset successful! You can now log in.'})
    except CustomUser.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')

    if not old_password or not new_password:
        return Response({'error': 'Both fields are required.'}, status=400)

    if not user.check_password(old_password):
        return Response({'error': 'Current password is incorrect.'}, status=400)

    if len(new_password) < 8:
        return Response({'error': 'Password must be at least 8 characters.'}, status=400)

    user.set_password(new_password)
    user.save()
    return Response({'message': 'Password changed successfully.'})