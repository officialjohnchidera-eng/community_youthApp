from django.db import models
from accounts.models import CustomUser


# =============================================================
# MEETING MODEL
# Created by the Secretary in advance.
# Contains all meeting details, agenda and minutes.
# Attendance and expenditures are tied to each meeting.
# =============================================================
class Meeting(models.Model):
    STATUS_CHOICES = [
        ('upcoming', 'Upcoming'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    title = models.CharField(max_length=200)
    date = models.DateField()
    time = models.TimeField()
    venue = models.CharField(max_length=200)
    agenda = models.TextField()
    minutes = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='upcoming')
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='meetings_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.title} - {self.date} - {self.status}'


# =============================================================
# WORK ACTIVITY MODEL
# Created by the Secretary in advance.
# Contains work description, status and outcome.
# Attendance and expenditures are tied to each activity.
# =============================================================
class WorkActivity(models.Model):
    STATUS_CHOICES = [
        ('upcoming', 'Upcoming'),
        ('ongoing', 'Ongoing'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    date = models.DateField()
    time = models.TimeField()
    location = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='upcoming')
    outcome = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='work_activities_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.title} - {self.date} - {self.status}'


# =============================================================
# ATTENDANCE MODEL
# Records attendance for both meetings and work activities.
# Secretary marks each member as present or absent.
# Full member list is available from the registered members.
# =============================================================
class Attendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
    ]

    member = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='attendances'
    )
    meeting = models.ForeignKey(
        Meeting,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attendances'
    )
    work_activity = models.ForeignKey(
        WorkActivity,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attendances'
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='absent')
    marked_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='attendance_marked'
    )
    marked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Prevent duplicate attendance records
        unique_together = [
            ('member', 'meeting'),
            ('member', 'work_activity')
        ]

    def __str__(self):
        event = self.meeting or self.work_activity
        return f'{self.member} - {event} - {self.status}'


# =============================================================
# EXPENDITURE MODEL
# Records all expenses made during a meeting or work activity.
# Logged by the Treasurer after or during the event.
# Tied directly to the specific meeting or work activity.
# =============================================================
class Expenditure(models.Model):
    meeting = models.ForeignKey(
        Meeting,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='expenditures'
    )
    work_activity = models.ForeignKey(
        WorkActivity,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='expenditures'
    )
    item = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    logged_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='expenditures_logged'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        event = self.meeting or self.work_activity
        return f'{self.item} - NGN {self.amount} - {event}'