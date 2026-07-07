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

    def save_model(self, request, obj, form, change):
        """
        Mirrors the logic in accounts.views.approve_reject_account so that
        approving/rejecting a member through Django admin (a fallback path
        while the in-app Approvals page is broken) behaves consistently
        with the real approval flow instead of silently skipping:
          - marking the assigned Position as occupied on approval
          - sending the approval/rejection email
          - creating the in-app notification
          - recording an AccountVerificationLog entry
        Only fires when account_status actually CHANGES via this save,
        not on every unrelated edit.
        """
        status_changed = change and 'account_status' in form.changed_data

        super().save_model(request, obj, form, change)

        if not status_changed:
            return

        from .models import AccountVerificationLog

        if obj.account_status == 'approved':
            if obj.position and not obj.position.is_occupied:
                obj.position.is_occupied = True
                obj.position.save()

            try:
                from .views import send_approval_email
                send_approval_email(obj)
            except Exception as e:
                print(f"Admin approval email error: {e}")

            try:
                from notifications.views import create_notification
                create_notification(
                    member=obj,
                    title='Account Approved!',
                    body=f'Welcome {obj.first_name}! Your account has been approved. You can now access all features.',
                    notification_type='approval'
                )
            except Exception as e:
                print(f"Admin approval notification error: {e}")

            reviewer = request.user if isinstance(request.user, CustomUser) else None
            AccountVerificationLog.objects.create(
                member=obj,
                reviewed_by=reviewer,
                decision='approved',
                rejection_reason='',
                submission_number=obj.submission_count
            )

        elif obj.account_status == 'rejected':
            try:
                from .views import send_rejection_email
                send_rejection_email(obj, obj.rejection_reason or 'No reason provided.')
            except Exception as e:
                print(f"Admin rejection email error: {e}")

            try:
                from notifications.views import create_notification
                create_notification(
                    member=obj,
                    title='Account Update',
                    body=f'Your account registration was not approved. Reason: {obj.rejection_reason or "No reason provided."}',
                    notification_type='general'
                )
            except Exception as e:
                print(f"Admin rejection notification error: {e}")

            reviewer = request.user if isinstance(request.user, CustomUser) else None
            AccountVerificationLog.objects.create(
                member=obj,
                reviewed_by=reviewer,
                decision='rejected',
                rejection_reason=obj.rejection_reason or '',
                submission_number=obj.submission_count
            )


@admin.register(AccountVerificationLog)
class AccountVerificationLogAdmin(admin.ModelAdmin):
    list_display = ['member', 'reviewed_by', 'decision', 'reviewed_at', 'submission_number']
    list_filter = ['decision']
    search_fields = ['member__email', 'reviewed_by__email']
    readonly_fields = ['member', 'reviewed_by', 'decision', 'rejection_reason', 'reviewed_at', 'submission_number']