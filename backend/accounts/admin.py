from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Village, Position, AccountVerificationLog


@admin.register(Village)
class VillageAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_occupied', 'created_at']
    search_fields = ['title']
    list_filter = ['is_occupied']


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ['user_id', 'email', 'first_name', 'last_name', 'village', 'role', 'account_status']
    list_filter = ['account_status', 'role', 'village']
    search_fields = ['email', 'first_name', 'last_name', 'user_id']
    ordering = ['date_joined']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'phone', 'date_of_birth', 'profile_picture')}),
        ('Organization Info', {'fields': ('village', 'role', 'position')}),
        ('Account Status', {'fields': ('account_status', 'rejection_reason', 'resubmitted', 'submission_count')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'phone', 'date_of_birth', 'village', 'role', 'position', 'password1', 'password2'),
        }),
    )


@admin.register(AccountVerificationLog)
class AccountVerificationLogAdmin(admin.ModelAdmin):
    list_display = ['member', 'reviewed_by', 'decision', 'reviewed_at', 'submission_number']
    list_filter = ['decision']
    search_fields = ['member__email', 'reviewed_by__email']
    readonly_fields = ['member', 'reviewed_by', 'decision', 'rejection_reason', 'reviewed_at', 'submission_number']