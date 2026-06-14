from django.core.management.base import BaseCommand
from django.utils import timezone
from accounts.models import CustomUser


# =============================================================
# EXPIRE PENDING ACCOUNTS MANAGEMENT COMMAND
# Run manually: py manage.py expire_pending_accounts
# On PythonAnywhere: schedule to run daily via their scheduler
# Finds all accounts pending more than 7 days and expires them
# =============================================================
class Command(BaseCommand):
    help = 'Expires all pending accounts older than 7 days'

    def handle(self, *args, **kwargs):
        pending_users = CustomUser.objects.filter(account_status='pending')
        expired_count = 0

        for user in pending_users:
            if user.is_pending_expired():
                user.account_status = 'expired'
                user.save()
                expired_count += 1
                self.stdout.write(
                    f'Expired: {user.user_id} - {user.email}'
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Done! {expired_count} accounts expired.'
            )
        )

