from django.db import models
from accounts.models import CustomUser


# =============================================================
# DEVICE TOKEN MODEL
# Stores Firebase device tokens for each member.
# Each member can have multiple devices (phone, tablet etc).
# Tokens are used to send push notifications to specific members.
# =============================================================
class DeviceToken(models.Model):
    member = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='device_tokens'
    )
    token = models.TextField(unique=True)
    device_name = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.member} - {self.device_name}'


# =============================================================
# NOTIFICATION LOG MODEL
# Records every notification sent for audit purposes.
# Tracks who received it, what was sent and when.
# =============================================================
class NotificationLog(models.Model):
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    ]

    NOTIFICATION_TYPES = [
        ('payment', 'Payment'),
        ('meeting', 'Meeting'),
        ('announcement', 'Announcement'),
        ('approval', 'Approval'),
        ('general', 'General'),
    ]

    title = models.CharField(max_length=200)
    body = models.TextField()
    message = models.TextField(null=True, blank=True)
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='general')
    sent_to = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications_received'
    )
    is_bulk = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    sent_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.title} - {self.status} - {self.sent_at}'