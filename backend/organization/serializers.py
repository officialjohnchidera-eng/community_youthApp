from rest_framework import serializers
from .models import (
    Announcement, Document, MediaGallery,
    WelfareRecord, EmpowermentRecord,
    DisciplinaryRecord, Poll, PollOption, PollVote
)


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Announcement
        fields = ['id', 'title', 'content', 'category', 'created_by', 'created_at']
        read_only_fields = ['created_by', 'created_at']


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.StringRelatedField()
    file_url = serializers.SerializerMethodField()

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file:
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return obj.file_url

    class Meta:
        model = Document
        fields = ['id', 'title', 'description', 'document_type', 'file_url', 'uploaded_by', 'created_at']


class MediaGallerySerializer(serializers.ModelSerializer):
    uploaded_by = serializers.StringRelatedField()

    class Meta:
        model = MediaGallery
        fields = ['id', 'title', 'description', 'media_type', 'file_url', 'is_public', 'uploaded_by', 'created_at']


class WelfareRecordSerializer(serializers.ModelSerializer):
    member = serializers.StringRelatedField(read_only=True)
    recorded_by = serializers.StringRelatedField(read_only=True)
    member_id = serializers.CharField(write_only=True)

    class Meta:
        model = WelfareRecord
        fields = ['id', 'member', 'member_id', 'case_type', 'description', 'support_given', 'date', 'recorded_by', 'created_at']
        read_only_fields = ['member', 'recorded_by', 'created_at']


class EmpowermentRecordSerializer(serializers.ModelSerializer):
    recorded_by = serializers.StringRelatedField(read_only=True)
    beneficiaries = serializers.StringRelatedField(many=True, read_only=True)
    beneficiary_ids = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = EmpowermentRecord
        fields = ['id', 'title', 'description', 'date', 'beneficiaries', 'beneficiary_ids', 'recorded_by', 'created_at']
        read_only_fields = ['recorded_by', 'created_at']


class DisciplinaryRecordSerializer(serializers.ModelSerializer):
    member = serializers.StringRelatedField(read_only=True)
    issued_by = serializers.StringRelatedField(read_only=True)
    member_id = serializers.CharField(write_only=True)

    class Meta:
        model = DisciplinaryRecord
        fields = ['id', 'member', 'member_id', 'offense', 'fine_amount', 'status', 'remarks', 'issued_by', 'issued_at']
        read_only_fields = ['member', 'issued_by', 'issued_at']


class PollOptionSerializer(serializers.ModelSerializer):
    vote_count = serializers.SerializerMethodField()

    class Meta:
        model = PollOption
        fields = ['id', 'text', 'vote_count']

    def get_vote_count(self, obj):
        return obj.votes.count()


class PollSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    options = PollOptionSerializer(many=True, read_only=True)
    total_votes = serializers.SerializerMethodField()

    class Meta:
        model = Poll
        fields = ['id', 'question', 'status', 'deadline', 'created_by', 'created_at', 'options', 'total_votes']
        read_only_fields = ['created_by', 'created_at']

    def get_total_votes(self, obj):
        return obj.votes.count()


class CreatePollSerializer(serializers.Serializer):
    question = serializers.CharField()
    deadline = serializers.DateTimeField(required=False)
    options = serializers.ListField(child=serializers.CharField())

    def validate_options(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("A poll must have at least 2 options.")
        return value


class VoteSerializer(serializers.Serializer):
    option_id = serializers.IntegerField()