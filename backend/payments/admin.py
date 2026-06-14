from django.contrib import admin
from .models import PaymentRequest, PaymentTransaction


@admin.register(PaymentRequest)
class PaymentRequestAdmin(admin.ModelAdmin):
    list_display = ['title', 'payment_type', 'amount', 'status', 'deadline', 'created_by', 'created_at']
    list_filter = ['payment_type', 'status']
    search_fields = ['title', 'description']


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ['receipt_number', 'payment_request', 'member', 'village', 'amount', 'status', 'paid_at']
    list_filter = ['status']
    search_fields = ['receipt_number', 'paystack_reference']
    readonly_fields = ['receipt_number', 'paystack_reference', 'paid_at']