from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import DeviceToken, NotificationLog
from .firebase import send_push_notification, send_bulk_notification
from accounts.models import CustomUser


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_device_token(request):
    token = request.data.get('token')
    device_name = request.data.get('device_name', 'Unknown Device')

    if not token:
        return Response(
            {'error': 'Device token is required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    DeviceToken.objects.update_or_create(
        token=token,
        defaults={
            'member': request.user,
            'device_name': device_name
        }
    )

    return Response({'message': 'Device token registered successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_notification_to_all(request):
    if request.user.role != 'executive':
        return Response(
            {'error': 'Only executives can send notifications.'},
            status=status.HTTP_403_FORBIDDEN
        )

    title = request.data.get('title')
    body = request.data.get('body')

    if not title or not body:
        return Response(
            {'error': 'Title and body are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    tokens = list(
        DeviceToken.objects.filter(
            member__account_status='approved'
        ).values_list('token', flat=True)
    )

    if not tokens:
        return Response(
            {'error': 'No registered devices found.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    result = send_bulk_notification(tokens, title, body)

    NotificationLog.objects.create(
        title=title,
        body=body,
        is_bulk=True,
        status='sent' if result['success'] else 'failed'
    )

    if result['success']:
        return Response({
            'message': 'Notification sent successfully.',
            'success_count': result['success_count'],
            'failure_count': result['failure_count']
        })
    return Response(
        {'error': 'Failed to send notification.'},
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_notification_to_member(request):
    if request.user.role != 'executive':
        return Response(
            {'error': 'Only executives can send notifications.'},
            status=status.HTTP_403_FORBIDDEN
        )

    member_id = request.data.get('member_id')
    title = request.data.get('title')
    body = request.data.get('body')

    if not all([member_id, title, body]):
        return Response(
            {'error': 'member_id, title and body are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        member = CustomUser.objects.get(user_id=member_id)
    except CustomUser.DoesNotExist:
        return Response(
            {'error': 'Member not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    tokens = list(
        DeviceToken.objects.filter(member=member).values_list('token', flat=True)
    )

    if not tokens:
        return Response(
            {'error': 'No registered devices found for this member.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    results = []
    for token in tokens:
        result = send_push_notification(token, title, body)
        results.append(result)

    NotificationLog.objects.create(
        title=title,
        body=body,
        sent_to=member,
        is_bulk=False,
        status='sent' if any(r['success'] for r in results) else 'failed'
    )

    return Response({'message': f'Notification sent to {member.first_name} successfully.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notification_logs(request):
    if request.user.role != 'executive':
        return Response(
            {'error': 'Only executives can view notification logs.'},
            status=status.HTTP_403_FORBIDDEN
        )

    logs = NotificationLog.objects.all().order_by('-sent_at')
    data = [
        {
            'id': log.id,
            'title': log.title,
            'body': log.body,
            'sent_to': str(log.sent_to) if log.sent_to else 'All Members',
            'is_bulk': log.is_bulk,
            'status': log.status,
            'sent_at': log.sent_at
        }
        for log in logs
    ]
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_notifications(request):
    notifications = NotificationLog.objects.filter(
        sent_to=request.user
    ).order_by('-sent_at')
    data = [
        {
            'id': n.id,
            'title': n.title,
            'message': n.body,
            'notification_type': n.notification_type if hasattr(n, 'notification_type') else 'general',
            'is_read': n.is_read if hasattr(n, 'is_read') else False,
            'created_at': n.sent_at,
        }
        for n in notifications
    ]
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    try:
        notification = NotificationLog.objects.get(
            id=notification_id,
            sent_to=request.user
        )
        if hasattr(notification, 'is_read'):
            notification.is_read = True
            notification.save()
        return Response({'message': 'Notification marked as read.'})
    except NotificationLog.DoesNotExist:
        return Response({'error': 'Notification not found.'}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    if hasattr(NotificationLog, 'is_read'):
        NotificationLog.objects.filter(
            sent_to=request.user,
            is_read=False
        ).update(is_read=True)
    return Response({'message': 'All notifications marked as read.'})


def create_notification(member, title, body, notification_type='general'):
    try:
        NotificationLog.objects.create(
            title=title,
            body=body,
            sent_to=member,
            is_bulk=False,
            notification_type=notification_type,
            status='sent'
        )
    except Exception as e:
        print(f"Notification creation error: {e}")