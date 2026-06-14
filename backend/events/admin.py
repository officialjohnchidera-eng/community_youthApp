from django.contrib import admin
from .models import Meeting, WorkActivity, Attendance, Expenditure


@admin.register(Meeting)
class MeetingAdmin(admin.ModelAdmin):
    list_display = ['title', 'date', 'time', 'venue', 'status', 'created_by', 'created_at']
    list_filter = ['status']
    search_fields = ['title', 'venue']


@admin.register(WorkActivity)
class WorkActivityAdmin(admin.ModelAdmin):
    list_display = ['title', 'date', 'time', 'location', 'status', 'created_by', 'created_at']
    list_filter = ['status']
    search_fields = ['title', 'location']


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['member', 'meeting', 'work_activity', 'status', 'marked_by', 'marked_at']
    list_filter = ['status']
    search_fields = ['member__first_name', 'member__last_name']


@admin.register(Expenditure)
class ExpenditureAdmin(admin.ModelAdmin):
    list_display = ['item', 'amount', 'meeting', 'work_activity', 'logged_by', 'created_at']
    search_fields = ['item']