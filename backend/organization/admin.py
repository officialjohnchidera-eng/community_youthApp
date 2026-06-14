from django.contrib import admin
from .models import (
    Announcement, Document, MediaGallery,
    WelfareRecord, EmpowermentRecord,
    DisciplinaryRecord, Poll, PollOption, PollVote
)


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'created_by', 'created_at']
    list_filter = ['category']
    search_fields = ['title', 'content']


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'uploaded_by', 'created_at']
    search_fields = ['title']


@admin.register(MediaGallery)
class MediaGalleryAdmin(admin.ModelAdmin):
    list_display = ['title', 'media_type', 'uploaded_by', 'created_at']
    list_filter = ['media_type']
    search_fields = ['title']


@admin.register(WelfareRecord)
class WelfareRecordAdmin(admin.ModelAdmin):
    list_display = ['member', 'case_type', 'date', 'recorded_by']
    list_filter = ['case_type']
    search_fields = ['member__first_name', 'member__last_name']


@admin.register(EmpowermentRecord)
class EmpowermentRecordAdmin(admin.ModelAdmin):
    list_display = ['title', 'date', 'recorded_by', 'created_at']
    search_fields = ['title']


@admin.register(DisciplinaryRecord)
class DisciplinaryRecordAdmin(admin.ModelAdmin):
    list_display = ['member', 'offense', 'fine_amount', 'status', 'issued_by', 'issued_at']
    list_filter = ['status']
    search_fields = ['member__first_name', 'member__last_name']


@admin.register(Poll)
class PollAdmin(admin.ModelAdmin):
    list_display = ['question', 'status', 'deadline', 'created_by', 'created_at']
    list_filter = ['status']


@admin.register(PollOption)
class PollOptionAdmin(admin.ModelAdmin):
    list_display = ['poll', 'text']


@admin.register(PollVote)
class PollVoteAdmin(admin.ModelAdmin):
    list_display = ['member', 'poll', 'option', 'voted_at']
    readonly_fields = ['member', 'poll', 'option', 'voted_at']