from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import cloudinary.uploader
from .models import (
    Announcement, Document, MediaGallery,
    WelfareRecord, EmpowermentRecord,
    DisciplinaryRecord, Poll, PollOption, PollVote
)
from .serializers import (
    AnnouncementSerializer, DocumentSerializer, MediaGallerySerializer,
    WelfareRecordSerializer, EmpowermentRecordSerializer,
    DisciplinaryRecordSerializer, PollSerializer,
    CreatePollSerializer, VoteSerializer
)
from accounts.models import CustomUser


# =============================================================
# HELPER FUNCTIONS
# =============================================================
def is_approved(user):
    return user.account_status == 'approved'

def has_position(user, positions):
    return user.position and user.position.title in positions

def is_secretary(user):
    return has_position(user, ['General Secretary', 'Assistant Secretary', 'General President', 'Vice President'])

def is_pro(user):
    return has_position(user, ['Public Relation Officer', 'General President', 'Vice President'])

def is_welfare_officer(user):
    return has_position(user, ['Welfare Officer', 'General President', 'Vice President'])

def is_provost(user):
    return has_position(user, ['Provost', 'Assistant Provost', 'General President', 'Vice President'])

def is_executive(user):
    return user.role == 'executive' and is_approved(user)


# =============================================================
# ANNOUNCEMENT VIEWS
# =============================================================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_announcement(request):
    if not is_secretary(request.user) and not is_pro(request.user):
        return Response(
            {'error': 'You do not have permission to create announcements.'},
            status=status.HTTP_403_FORBIDDEN
        )
    serializer = AnnouncementSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(created_by=request.user)
        return Response({
            'message': 'Announcement created successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_announcements(request):
    if not is_approved(request.user):
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    announcements = Announcement.objects.all().order_by('-created_at')
    serializer = AnnouncementSerializer(announcements, many=True)
    return Response(serializer.data)


# =============================================================
# DOCUMENT VIEWS
# =============================================================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_document(request):
    user = request.user
    allowed = ['General Secretary', 'Assistant Secretary', 'General President', 'Vice President']
    if not user.position or user.position.title not in allowed:
        return Response({'error': 'Permission denied'}, status=403)

    title = request.data.get('title', '').strip()
    description = request.data.get('description', '')
    document_type = request.data.get('document_type', 'other')
    file = request.FILES.get('file')

    if not title:
        return Response({'error': 'Title is required'}, status=400)
    if not file:
        return Response({'error': 'File is required'}, status=400)

    doc = Document.objects.create(
        title=title,
        description=description,
        document_type=document_type,
        file=file,
        uploaded_by=user,
    )
    return Response({'message': 'Document uploaded successfully', 'id': doc.id}, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_documents(request):
    if not is_approved(request.user):
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    documents = Document.objects.all().order_by('-created_at')
    serializer = DocumentSerializer(documents, many=True)
    return Response(serializer.data)




# =============================================================
# UPLOAD MEDIA
# Only PRO can upload media
# Handles actual file upload to Cloudinary
# is_public controls visibility on landing page
# =============================================================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_media(request):
    if not is_approved(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    if not is_pro(request.user):
        return Response({'error': 'Only PRO can upload media.'}, status=status.HTTP_403_FORBIDDEN)

    title = request.data.get('title')
    description = request.data.get('description', '')
    media_type = request.data.get('media_type')
    is_public_raw = request.data.get('is_public', 'false')
    is_public = is_public_raw in ['true', 'True', '1', True]
    file = request.FILES.get('file')

    if not all([title, media_type, file]):
        return Response({'error': 'title, media_type and file are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Upload to Cloudinary
        resource_type = 'video' if media_type == 'video' else 'image'
        upload_result = cloudinary.uploader.upload(
            file,
            resource_type=resource_type,
            folder='umuagu_youth'
        )
        file_url = upload_result.get('secure_url')

        media = MediaGallery.objects.create(
            title=title,
            description=description,
            media_type=media_type,
            file_url=file_url,
            is_public=is_public,
            uploaded_by=request.user
        )
        serializer = MediaGallerySerializer(media)
        return Response({'message': 'Media uploaded successfully.', 'data': serializer.data}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': f'Upload failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        


# =============================================================
# GET ALL MEDIA
# Approved members see all media including private
# =============================================================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_media(request):
    if not is_approved(request.user):
        return Response({'error': 'Your account is not approved yet.'}, status=status.HTTP_403_FORBIDDEN)
    media = MediaGallery.objects.all().order_by('-created_at')
    serializer = MediaGallerySerializer(media, many=True)
    return Response(serializer.data)


# =============================================================
# GET PUBLIC MEDIA
# No authentication required — used for landing page
# Only returns media where is_public=True
# =============================================================
@api_view(['GET'])
@permission_classes([])
def get_public_media(request):
    media = MediaGallery.objects.filter(is_public=True).order_by('-created_at')
    serializer = MediaGallerySerializer(media, many=True)
    return Response(serializer.data)


# =============================================================
# DELETE MEDIA
# Only PRO can delete media
# =============================================================
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_media(request, media_id):
    if not is_approved(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    if not is_pro(request.user):
        return Response({'error': 'Only PRO can delete media.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        media = MediaGallery.objects.get(id=media_id)
    except MediaGallery.DoesNotExist:
        return Response({'error': 'Media not found.'}, status=status.HTTP_404_NOT_FOUND)
    media.delete()
    return Response({'message': 'Media deleted successfully.'})

# =============================================================
# WELFARE RECORD VIEWS
# =============================================================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_welfare_record(request):
    if not is_welfare_officer(request.user):
        return Response(
            {'error': 'Only the Welfare Officer or President can create welfare records.'},
            status=status.HTTP_403_FORBIDDEN
        )
    serializer = WelfareRecordSerializer(data=request.data)
    if serializer.is_valid():
        member_id = serializer.validated_data.pop('member_id')
        try:
            member = CustomUser.objects.get(user_id=member_id)
            welfare_record = WelfareRecord.objects.create(
                member=member,
                recorded_by=request.user,
                **serializer.validated_data
            )
            return Response({
                'message': 'Welfare record created successfully.',
                'data': WelfareRecordSerializer(welfare_record).data
            }, status=status.HTTP_201_CREATED)
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'Member not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_welfare_records(request):
    if not is_approved(request.user):
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    records = WelfareRecord.objects.all().order_by('-created_at')
    serializer = WelfareRecordSerializer(records, many=True)
    return Response(serializer.data)


# =============================================================
# EMPOWERMENT RECORD VIEWS
# =============================================================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_empowerment_record(request):
    if not is_welfare_officer(request.user):
        return Response(
            {'error': 'Only the Welfare Officer or President can create empowerment records.'},
            status=status.HTTP_403_FORBIDDEN
        )
    serializer = EmpowermentRecordSerializer(data=request.data)
    if serializer.is_valid():
        beneficiary_ids = serializer.validated_data.pop('beneficiary_ids', [])
        record = EmpowermentRecord.objects.create(
            recorded_by=request.user,
            **serializer.validated_data
        )
        for uid in beneficiary_ids:
            try:
                member = CustomUser.objects.get(user_id=uid)
                record.beneficiaries.add(member)
            except CustomUser.DoesNotExist:
                pass
        record.save()
        return Response({
            'message': 'Empowerment record created successfully.',
            'data': EmpowermentRecordSerializer(record).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_empowerment_records(request):
    if not is_approved(request.user):
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    records = EmpowermentRecord.objects.all().order_by('-created_at')
    serializer = EmpowermentRecordSerializer(records, many=True)
    return Response(serializer.data)


# =============================================================
# DISCIPLINARY RECORD VIEWS
# =============================================================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_disciplinary_record(request):
    if not is_provost(request.user):
        return Response(
            {'error': 'Only the Provost or President can create disciplinary records.'},
            status=status.HTTP_403_FORBIDDEN
        )
    serializer = DisciplinaryRecordSerializer(data=request.data)
    if serializer.is_valid():
        member_id = serializer.validated_data.pop('member_id')
        try:
            member = CustomUser.objects.get(user_id=member_id)
            record = DisciplinaryRecord.objects.create(
                member=member,
                issued_by=request.user,
                **serializer.validated_data
            )
            return Response({
                'message': 'Disciplinary record created successfully.',
                'data': DisciplinaryRecordSerializer(record).data
            }, status=status.HTTP_201_CREATED)
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'Member not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_disciplinary_records(request):
    if not is_approved(request.user):
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    records = DisciplinaryRecord.objects.all().order_by('-issued_at')
    serializer = DisciplinaryRecordSerializer(records, many=True)
    return Response(serializer.data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_disciplinary_status(request, record_id):
    if not is_provost(request.user):
        return Response(
            {'error': 'Only the Provost or President can update disciplinary records.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        record = DisciplinaryRecord.objects.get(id=record_id)
        serializer = DisciplinaryRecordSerializer(record, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Disciplinary record updated successfully.',
                'data': serializer.data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except DisciplinaryRecord.DoesNotExist:
        return Response(
            {'error': 'Disciplinary record not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


# =============================================================
# POLL VIEWS
# =============================================================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_poll(request):
    if not is_executive(request.user):
        return Response(
            {'error': 'Only executives can create polls.'},
            status=status.HTTP_403_FORBIDDEN
        )
    serializer = CreatePollSerializer(data=request.data)
    if serializer.is_valid():
        poll = Poll.objects.create(
            question=serializer.validated_data['question'],
            deadline=serializer.validated_data.get('deadline'),
            created_by=request.user
        )
        for option_text in serializer.validated_data['options']:
            PollOption.objects.create(poll=poll, text=option_text)
        return Response({
            'message': 'Poll created successfully.',
            'data': PollSerializer(poll).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_polls(request):
    if not is_approved(request.user):
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    polls = Poll.objects.all().order_by('-created_at')
    serializer = PollSerializer(polls, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def vote_on_poll(request, poll_id):
    if not is_approved(request.user):
        return Response(
            {'error': 'Your account is not approved yet.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        poll = Poll.objects.get(id=poll_id, status='active')
    except Poll.DoesNotExist:
        return Response(
            {'error': 'Poll not found or is no longer active.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if PollVote.objects.filter(poll=poll, member=request.user).exists():
        return Response(
            {'error': 'You have already voted on this poll.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = VoteSerializer(data=request.data)
    if serializer.is_valid():
        try:
            option = PollOption.objects.get(id=serializer.validated_data['option_id'], poll=poll)
            PollVote.objects.create(poll=poll, option=option, member=request.user)
            return Response({'message': 'Vote recorded successfully.'})
        except PollOption.DoesNotExist:
            return Response(
                {'error': 'Invalid option selected.'},
                status=status.HTTP_400_BAD_REQUEST
            )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)