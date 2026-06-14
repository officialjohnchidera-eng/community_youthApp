from django.contrib import admin
from .models import DeviceToken, NotificationLog


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ['member', 'device_name', 'created_at']
    search_fields = ['member__first_name', 'member__last_name']


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ['title', 'sent_to', 'is_bulk', 'status', 'sent_at']
    list_filter = ['status', 'is_bulk']
    search_fields = ['title']
    readonly_fields = ['title', 'body', 'sent_to', 'is_bulk', 'status', 'sent_at']