from django.db import models
from accounts.models import CustomUser


# =============================================================
# ANNOUNCEMENT MODEL
# Created by Secretary or PRO.
# Visible to all approved members.
# =============================================================
class Announcement(models.Model):
    CATEGORY_CHOICES = [
        ('general', 'General'),
        ('urgent', 'Urgent'),
        ('event', 'Event'),
        ('payment', 'Payment'),
        ('meeting', 'Meeting'),
    ]

    title = models.CharField(max_length=200)
    content = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='general')
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='announcements_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.title} - {self.category}'


# =============================================================
# DOCUMENT MODEL
# Stores important organization documents.
# Managed by Secretary.
# Visible to all approved members.
# =============================================================
class Document(models.Model):
    DOCUMENT_TYPE_CHOICES = [
        ('minutes', 'Meeting Minutes'),
        ('constitution', 'Constitution'),
        ('financial', 'Financial Report'),
        ('notice', 'Notice'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPE_CHOICES, default='other')
    file = models.FileField(upload_to='documents/', null=True, blank=True)
    file_url = models.URLField(null=True, blank=True)
    uploaded_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='documents_uploaded'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def get_file_url(self):
        if self.file:
            return self.file.url
        return self.file_url

    def __str__(self):
        return self.title


# =============================================================
# MEDIA GALLERY MODEL
# Photos and videos from community events.
# Managed by PRO.
# Visible to all approved members.
# =============================================================
class MediaGallery(models.Model):
    MEDIA_TYPE_CHOICES = [
        ('photo', 'Photo'),
        ('video', 'Video'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    file_url = models.URLField()
    is_public = models.BooleanField(default=False)
    uploaded_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='media_uploaded'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.title} - {self.media_type}'


# =============================================================
# WELFARE RECORD MODEL
# Tracks member welfare cases and support given.
# Managed by Welfare Officer.
# =============================================================
class WelfareRecord(models.Model):
    CASE_TYPE_CHOICES = [
        ('illness', 'Illness'),
        ('bereavement', 'Bereavement'),
        ('hardship', 'Hardship'),
        ('other', 'Other'),
    ]

    member = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='welfare_records'
    )
    case_type = models.CharField(max_length=20, choices=CASE_TYPE_CHOICES)
    description = models.TextField()
    support_given = models.TextField(null=True, blank=True)
    date = models.DateField()
    recorded_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='welfare_records_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.member} - {self.case_type} - {self.date}'


# =============================================================
# EMPOWERMENT RECORD MODEL
# Tracks empowerment programs and history.
# Managed by Welfare Officer.
# =============================================================
class EmpowermentRecord(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    date = models.DateField()
    beneficiaries = models.ManyToManyField(
        CustomUser,
        related_name='empowerment_records',
        blank=True
    )
    recorded_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='empowerment_records_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.title} - {self.date}'


# =============================================================
# DISCIPLINARY RECORD MODEL
# Tracks fines and sanctions issued by Provost.
# Records refusal to pay cases formally.
# =============================================================
class DisciplinaryRecord(models.Model):
    STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('paid', 'Paid'),
        ('refused', 'Refused to Pay'),
        ('waived', 'Waived'),
    ]

    member = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='disciplinary_records'
    )
    offense = models.TextField()
    fine_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unpaid')
    remarks = models.TextField(null=True, blank=True)
    issued_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='disciplinary_records_issued'
    )
    issued_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.member} - {self.offense} - {self.status}'


# =============================================================
# POLL MODEL
# Created by executives for member voting.
# Members can vote on important decisions.
# =============================================================
class Poll(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('closed', 'Closed'),
    ]

    question = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    deadline = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='polls_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.question} - {self.status}'


# =============================================================
# POLL OPTION MODEL
# Each poll has multiple options for members to vote on.
# =============================================================
class PollOption(models.Model):
    poll = models.ForeignKey(
        Poll,
        on_delete=models.CASCADE,
        related_name='options'
    )
    text = models.CharField(max_length=200)

    def __str__(self):
        return f'{self.poll} - {self.text}'


# =============================================================
# POLL VOTE MODEL
# Records each member's vote on a poll.
# One vote per member per poll enforced.
# =============================================================
class PollVote(models.Model):
    poll = models.ForeignKey(
        Poll,
        on_delete=models.CASCADE,
        related_name='votes'
    )
    option = models.ForeignKey(
        PollOption,
        on_delete=models.CASCADE,
        related_name='votes'
    )
    member = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='poll_votes'
    )
    voted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # One vote per member per poll
        unique_together = [('poll', 'member')]

    def __str__(self):
        return f'{self.member} voted {self.option} on {self.poll}'