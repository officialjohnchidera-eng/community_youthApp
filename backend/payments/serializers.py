from rest_framework import serializers
from .models import PaymentRequest, PaymentTransaction
from accounts.models import Village


class PaymentRequestSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = PaymentRequest
        fields = [
            'id', 'title', 'description', 'amount',
            'payment_type', 'status', 'deadline',
            'created_by', 'created_at', 'is_expired'
        ]
        read_only_fields = ['created_by', 'created_at']

    def get_is_expired(self, obj):
        return obj.is_expired()


class PaymentTransactionSerializer(serializers.ModelSerializer):
    member = serializers.StringRelatedField(read_only=True)
    village = serializers.StringRelatedField(read_only=True)
    payment_request = PaymentRequestSerializer(read_only=True)

    class Meta:
        model = PaymentTransaction
        fields = [
            'id', 'payment_request', 'member', 'village',
            'amount', 'status', 'paystack_reference',
            'receipt_number', 'paid_at', 'created_at'
        ]
        read_only_fields = [
            'paystack_reference', 'receipt_number',
            'paid_at', 'created_at', 'status'
        ]


class InitiatePaymentSerializer(serializers.Serializer):
    payment_request_id = serializers.IntegerField()
    village_id = serializers.IntegerField(required=False)

    def validate(self, data):
        try:
            payment_request = PaymentRequest.objects.get(
                id=data['payment_request_id'],
                status='active'
            )
        except PaymentRequest.DoesNotExist:
            raise serializers.ValidationError("Payment request not found or is no longer active.")

        if payment_request.is_expired() and payment_request.status != 'active':
            raise serializers.ValidationError("This payment request has expired.")

        if payment_request.payment_type == 'monthly_dues' and not data.get('village_id'):
            raise serializers.ValidationError("Village ID is required for monthly dues payment.")

        data['payment_request'] = payment_request
        return data