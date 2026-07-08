from django.core.management.base import BaseCommand
from accounts.models import CustomUser, Position


class Command(BaseCommand):
    help = (
        "One-time fix for positions that got stuck showing is_occupied=False "
        "even though an approved executive already holds them. This happened "
        "for approvals that went through Django admin before the save_model "
        "override was added. Safe to re-run any time — it only ever sets "
        "is_occupied=True for positions with a genuinely approved holder, "
        "and never falsely marks a truly vacant position as occupied."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would change without saving anything.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Every position genuinely held by a currently-approved executive
        held_position_ids = set(
            CustomUser.objects.filter(
                account_status='approved',
                position__isnull=False
            ).values_list('position_id', flat=True)
        )

        fixed = []
        already_correct = []

        for position in Position.objects.all():
            should_be_occupied = position.id in held_position_ids

            if should_be_occupied and not position.is_occupied:
                fixed.append(position)
                if not dry_run:
                    position.is_occupied = True
                    position.save()
            elif not should_be_occupied and position.is_occupied:
                # A position marked occupied but with no approved holder —
                # flag this rather than silently changing it, since it's
                # worth a human double-check (e.g. was someone rejected
                # or removed after being approved?).
                self.stdout.write(self.style.WARNING(
                    f"NOTE: '{position.title}' is marked occupied but has no "
                    f"currently-approved holder. Not auto-changed — please "
                    f"verify manually whether this position should be freed."
                ))
            else:
                already_correct.append(position)

        if fixed:
            verb = "Would fix" if dry_run else "Fixed"
            self.stdout.write(self.style.SUCCESS(f"{verb} {len(fixed)} position(s):"))
            for p in fixed:
                self.stdout.write(f"  - {p.title}")
        else:
            self.stdout.write(self.style.SUCCESS("No positions needed fixing."))

        self.stdout.write(f"{len(already_correct)} position(s) were already correct.")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run only — no changes were saved. Re-run without --dry-run to apply."))