from django.db import models
from django.utils import timezone
from accounts.models import CustomUser, Village
import uuid


class PaymentRequest(models.Model):
    PAYMENT_TYPE_CHOICES = [
        ('monthly_dues', 'Monthly Dues'),
        ('event', 'Event Contribution'),
        ('levy', 'Levy'),
        ('fine', 'Fine'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('closed', 'Closed'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    deadline = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='payment_requests_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.title} - {self.payment_type} - {self.status}'

    def is_expired(self):
        if self.deadline:
            return timezone.now() > self.deadline
        return False


class PaymentTransaction(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]

    payment_request = models.ForeignKey(
        PaymentRequest,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    member = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_transactions'
    )
    village = models.ForeignKey(
        Village,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_transactions'
    )
    paid_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments_made'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    paystack_reference = models.CharField(max_length=200, unique=True)
    receipt_number = models.CharField(max_length=50, unique=True, editable=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            self.receipt_number = f'RCP-{uuid.uuid4().hex[:8].upper()}'
        super().save(*args, **kwargs)

    def __str__(self):
        payer = self.member or self.village
        return f'{payer} - {self.payment_request.title} - {self.status}'


class VillagePaymentStatus(models.Model):
    STATUS_CHOICES = [
        ('paid', 'Paid'),
        ('unpaid', 'Unpaid'),
    ]

    payment_request = models.ForeignKey(
        PaymentRequest,
        on_delete=models.CASCADE,
        related_name='village_statuses'
    )
    village = models.ForeignKey(
        Village,
        on_delete=models.CASCADE,
        related_name='payment_statuses'
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='unpaid')
    paid_at = models.DateTimeField(null=True, blank=True)
    paid_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='village_payments_made'
    )

    class Meta:
        unique_together = ['payment_request', 'village']

    def __str__(self):
        return f'{self.village} - {self.payment_request} - {self.status}'

