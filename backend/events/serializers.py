from rest_framework import serializers
from .models import Meeting, WorkActivity, Attendance, Expenditure
from accounts.models import CustomUser


class ExpenditureSerializer(serializers.ModelSerializer):
    logged_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Expenditure
        fields = ['id', 'item', 'amount', 'logged_by', 'created_at']
        read_only_fields = ['logged_by', 'created_at']


class AttendanceSerializer(serializers.ModelSerializer):
    member = serializers.StringRelatedField(read_only=True)
    marked_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Attendance
        fields = ['id', 'member', 'status', 'marked_by', 'marked_at']
        read_only_fields = ['marked_by', 'marked_at']


class MeetingSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    attendances = AttendanceSerializer(many=True, read_only=True)
    expenditures = ExpenditureSerializer(many=True, read_only=True)
    total_expenditure = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = [
            'id', 'title', 'date', 'time', 'venue',
            'agenda', 'minutes', 'status', 'created_by',
            'created_at', 'attendances', 'expenditures',
            'total_expenditure'
        ]
        read_only_fields = ['created_by', 'created_at']

    def get_total_expenditure(self, obj):
        total = sum(e.amount for e in obj.expenditures.all())
        return total


class WorkActivitySerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    attendances = AttendanceSerializer(many=True, read_only=True)
    expenditures = ExpenditureSerializer(many=True, read_only=True)
    total_expenditure = serializers.SerializerMethodField()

    class Meta:
        model = WorkActivity
        fields = [
            'id', 'title', 'description', 'date', 'time',
            'location', 'status', 'outcome', 'created_by',
            'created_at', 'attendances', 'expenditures',
            'total_expenditure'
        ]
        read_only_fields = ['created_by', 'created_at']

    def get_total_expenditure(self, obj):
        total = sum(e.amount for e in obj.expenditures.all())
        return total


class MarkAttendanceSerializer(serializers.Serializer):
    attendances = serializers.ListField(
        child=serializers.DictField()
    )

    def validate_attendances(self, value):
        for item in value:
            if 'member_id' not in item or 'status' not in item:
                raise serializers.ValidationError(
                    "Each attendance record must have member_id and status."
                )
            if item['status'] not in ['present', 'absent']:
                raise serializers.ValidationError(
                    "Status must be either present or absent."
                )
        return value