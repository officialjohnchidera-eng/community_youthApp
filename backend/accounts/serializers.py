from rest_framework import serializers
from django.utils import timezone
from .models import CustomUser, Village, Position, AccountVerificationLog


class VillageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Village
        fields = ['id', 'name']


class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = ['id', 'title', 'is_occupied']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'email', 'first_name', 'last_name', 'phone',
            'date_of_birth', 'village', 'role', 'position',
            'profile_picture', 'password', 'confirm_password'
        ]

    def validate(self, data):
        # Check passwords match
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")

        # Check age is 18 or above
        today = timezone.now().date()
        dob = data['date_of_birth']
        age = today.year - dob.year
        if (today.month, today.day) < (dob.month, dob.day):
            age -= 1
        if age < 18:
            raise serializers.ValidationError("You must be 18 years or older to register.")

        # Check position is not already occupied
        position = data.get('position')
        if position and position.is_occupied:
            raise serializers.ValidationError(f"The position '{position.title}' is already occupied.")

        # Check floor members don't select a position
        if data.get('role') == 'floor_member' and position:
            raise serializers.ValidationError("Floor members cannot select an executive position.")

        # Check executives select a position
        if data.get('role') == 'executive' and not position:
            raise serializers.ValidationError("Executives must select a position.")

        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.account_status = 'pending'
        user.pending_since = timezone.now()
        user.save()
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    village = VillageSerializer(read_only=True)
    position = serializers.SerializerMethodField()

    def get_position(self, obj):
        return obj.position.title if obj.position else None

    class Meta:
        model = CustomUser
        fields = [
            'user_id', 'email', 'first_name', 'last_name',
            'phone', 'date_of_birth', 'village', 'role',
            'position', 'profile_picture', 'account_status',
            'date_joined'
        ]


class AccountVerificationSerializer(serializers.ModelSerializer):
    member = UserProfileSerializer(read_only=True)
    reviewed_by = UserProfileSerializer(read_only=True)

    class Meta:
        model = AccountVerificationLog
        fields = '__all__'


class ApproveRejectSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['approved', 'rejected'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['decision'] == 'rejected' and not data.get('rejection_reason'):
            raise serializers.ValidationError("A rejection reason is required when rejecting an account.")
        return data