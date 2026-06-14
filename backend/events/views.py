from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Meeting, WorkActivity, Attendance, Expenditure
from .serializers import (
    MeetingSerializer,
    WorkActivitySerializer,
    AttendanceSerializer,
    ExpenditureSerializer,
    MarkAttendanceSerializer
)
from accounts.models import CustomUser


def is_secretary(user):
    allowed_positions = [
        'General Secretary',
        'Assistant Secretary',
        'General President',
        'Vice President'
    ]
    return user.position and user.position.title in allowed_positions


def is_treasurer(user):
    allowed_positions = [
        'General Treasurer',
        'Assistant Treasurer',
        'General President',
        'Vice President'
    ]
    return user.position and user.position.title in allowed_positions


def is_approved(user):
    return user.account_status == 'approved'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_meeting(request):
    if not is_secretary(request.user):
        return Response(
            {'error': 'Only the Secretary or President can create meetings.'},
            status=status.HTTP_403_FORBIDDEN
        )
    serializer = MeetingSerializer(data=request.data)
    if serializer.is_valid():
        meeting = serializer.save(created_by=request.user)

        # Notify all approved members
        approved_members = CustomUser.objects.filter(account_status='approved')
        for member in approved_members:
            try:
                from notifications.views import create_notification
                create_notification(
                    member=member,
                    title=f'New Meeting: {meeting.title}',
                    body=f'Scheduled for {meeting.date} at {meeting.time}. Venue: {meeting.venue}',
                    notification_type='meeting'
                )
            except Exception as e:
                print(f"Notification error: {e}")

        return Response({
            'message': 'Meeting created successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_meetings(request):
    if not is_approved(request.user):
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    # Auto-update past meetings to completed
    from django.utils import timezone
    Meeting.objects.filter(
        status='upcoming',
        date__lt=timezone.now().date()
    ).update(status='completed')

    meetings = Meeting.objects.all().order_by('-date')
    serializer = MeetingSerializer(meetings, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_meeting_detail(request, meeting_id):
    if not is_approved(request.user):
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        meeting = Meeting.objects.get(id=meeting_id)
        serializer = MeetingSerializer(meeting)
        return Response(serializer.data)
    except Meeting.DoesNotExist:
        return Response(
            {'error': 'Meeting not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_meeting(request, meeting_id):
    if not is_secretary(request.user):
        return Response(
            {'error': 'Only the Secretary or President can update meetings.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        meeting = Meeting.objects.get(id=meeting_id)
        serializer = MeetingSerializer(meeting, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Meeting updated successfully.',
                'data': serializer.data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Meeting.DoesNotExist:
        return Response(
            {'error': 'Meeting not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_work_activity(request):
    if not is_secretary(request.user):
        return Response(
            {'error': 'Only the Secretary or President can create work activities.'},
            status=status.HTTP_403_FORBIDDEN
        )
    serializer = WorkActivitySerializer(data=request.data)
    if serializer.is_valid():
        activity = serializer.save(created_by=request.user)

        # Notify all approved members
        approved_members = CustomUser.objects.filter(account_status='approved')
        for member in approved_members:
            try:
                from notifications.views import create_notification
                create_notification(
                    member=member,
                    title=f'New Activity: {activity.title}',
                    body=f'A new work activity has been scheduled for {activity.date}.',
                    notification_type='meeting'
                )
            except Exception as e:
                print(f"Notification error: {e}")

        return Response({
            'message': 'Work activity created successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_work_activities(request):
    if not is_approved(request.user):
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    activities = WorkActivity.objects.all().order_by('-date')
    serializer = WorkActivitySerializer(activities, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_work_activity_detail(request, activity_id):
    if not is_approved(request.user):
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        activity = WorkActivity.objects.get(id=activity_id)
        serializer = WorkActivitySerializer(activity)
        return Response(serializer.data)
    except WorkActivity.DoesNotExist:
        return Response(
            {'error': 'Work activity not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_work_activity(request, activity_id):
    if not is_secretary(request.user):
        return Response(
            {'error': 'Only the Secretary or President can update work activities.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        activity = WorkActivity.objects.get(id=activity_id)
        serializer = WorkActivitySerializer(activity, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Work activity updated successfully.',
                'data': serializer.data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except WorkActivity.DoesNotExist:
        return Response(
            {'error': 'Work activity not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_meeting_attendance(request, meeting_id):
    if not is_secretary(request.user):
        return Response(
            {'error': 'Only the Secretary or President can mark attendance.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        meeting = Meeting.objects.get(id=meeting_id)
    except Meeting.DoesNotExist:
        return Response(
            {'error': 'Meeting not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = MarkAttendanceSerializer(data=request.data)
    if serializer.is_valid():
        attendances = serializer.validated_data['attendances']
        for record in attendances:
            try:
                member = CustomUser.objects.get(
                    user_id=record['member_id'],
                    account_status='approved'
                )
                Attendance.objects.update_or_create(
                    member=member,
                    meeting=meeting,
                    defaults={
                        'status': record['status'],
                        'marked_by': request.user
                    }
                )
            except CustomUser.DoesNotExist:
                pass
        return Response({'message': 'Attendance marked successfully.'})
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_activity_attendance(request, activity_id):
    if not is_secretary(request.user):
        return Response(
            {'error': 'Only the Secretary or President can mark attendance.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        activity = WorkActivity.objects.get(id=activity_id)
    except WorkActivity.DoesNotExist:
        return Response(
            {'error': 'Work activity not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = MarkAttendanceSerializer(data=request.data)
    if serializer.is_valid():
        attendances = serializer.validated_data['attendances']
        for record in attendances:
            try:
                member = CustomUser.objects.get(
                    user_id=record['member_id'],
                    account_status='approved'
                )
                Attendance.objects.update_or_create(
                    member=member,
                    work_activity=activity,
                    defaults={
                        'status': record['status'],
                        'marked_by': request.user
                    }
                )
            except CustomUser.DoesNotExist:
                pass
        return Response({'message': 'Attendance marked successfully.'})
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_meeting_expenditure(request, meeting_id):
    if not is_treasurer(request.user):
        return Response(
            {'error': 'Only the Treasurer or President can log expenditures.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        meeting = Meeting.objects.get(id=meeting_id)
        serializer = ExpenditureSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(meeting=meeting, logged_by=request.user)
            return Response({
                'message': 'Expenditure logged successfully.',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Meeting.DoesNotExist:
        return Response(
            {'error': 'Meeting not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_activity_expenditure(request, activity_id):
    if not is_treasurer(request.user):
        return Response(
            {'error': 'Only the Treasurer or President can log expenditures.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        activity = WorkActivity.objects.get(id=activity_id)
        serializer = ExpenditureSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(work_activity=activity, logged_by=request.user)
            return Response({
                'message': 'Expenditure logged successfully.',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except WorkActivity.DoesNotExist:
        return Response(
            {'error': 'Work activity not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_meeting_minutes(request, meeting_id):
    try:
        meeting = Meeting.objects.get(id=meeting_id)
    except Meeting.DoesNotExist:
        return Response({'error': 'Meeting not found'}, status=404)

    user = request.user
    allowed = ['General Secretary', 'Assistant Secretary', 'General President', 'Vice President']
    if not user.position or user.position.title not in allowed:
        return Response({'error': 'Permission denied'}, status=403)

    minutes = request.data.get('minutes', '').strip()
    if not minutes:
        return Response({'error': 'Minutes cannot be empty'}, status=400)

    meeting.minutes = minutes
    meeting.save()

    # Auto-create or update document record
    from organization.models import Document
    from django.core.files.base import ContentFile

    doc_title = f"Minutes - {meeting.title} ({meeting.date})"
    minutes_content = f"MEETING MINUTES\n{'='*50}\n\nMeeting: {meeting.title}\nDate: {meeting.date}\nVenue: {meeting.venue}\nTime: {meeting.time}\n\n{'='*50}\n\nAGENDA:\n{meeting.agenda}\n\n{'='*50}\n\nMINUTES:\n{minutes}"

    existing = Document.objects.filter(title=doc_title).first()
    if existing:
        existing.file.save(f"minutes_{meeting.id}.txt", ContentFile(minutes_content.encode()), save=True)
        existing.uploaded_by = user
        existing.save()
    else:
        doc = Document(
            title=doc_title,
            description=f"Auto-generated minutes for {meeting.title}",
            document_type='minutes',
            uploaded_by=user,
        )
        doc.save()
        doc.file.save(f"minutes_{meeting.id}.txt", ContentFile(minutes_content.encode()), save=True)

    return Response({'message': 'Minutes saved and document updated successfully'})