from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
import uuid


# =============================================================
# VILLAGE MODEL
# Stores the 4 village units that members belong to.
# Each member must select one village during registration.
# =============================================================
class Village(models.Model):
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# =============================================================
# POSITION MODEL
# Stores all 13 executive positions available in the organization.
# Each position can only be held by ONE verified member at a time.
# The is_occupied field automatically prevents double assignment.
# =============================================================
class Position(models.Model):
    title = models.CharField(max_length=100)
    is_occupied = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.title} - {"Occupied" if self.is_occupied else "Vacant"}'


# =============================================================
# CUSTOM USER MANAGER
# This is the helper class that tells Django how to create
# regular users and superusers for our custom user model.
# It handles email normalization and password hashing.
# =============================================================
class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('account_status', 'approved')
        return self.create_user(email, password, **extra_fields)


# =============================================================
# CUSTOM USER MODEL
# This is the main member model. It replaces Django's default
# user model with our own that includes all the fields we need.
#
# Key features:
# - Unique User ID (e.g. UMY0001) auto-generated on registration
# - Age verification (must be 18 or older)
# - Village unit selection
# - Role assignment (floor member or executive)
# - Position selection for executives
# - Profile picture upload
# - Account status (pending, approved, rejected)
# - Rejection reason stored so member knows why they were rejected
# - Members can resubmit after rejection
# - Pending accounts expire after 7 days automatically
# =============================================================
class CustomUser(AbstractBaseUser, PermissionsMixin):

    ROLE_CHOICES = [
        ('floor_member', 'Floor Member'),
        ('executive', 'Executive'),
    ]

    ACCOUNT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('expired', 'Expired'),
    ]

    # Unique ID auto-generated e.g UMY0001
    user_id = models.CharField(max_length=10, unique=True, editable=False)

    # Personal Information
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    date_of_birth = models.DateField()
    profile_picture = models.ImageField(
        upload_to='profile_pictures/',
        null=True,
        blank=True
    )

    # Organization Information
    village = models.ForeignKey(
        Village,
        on_delete=models.SET_NULL,
        null=True
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='floor_member'
    )
    position = models.OneToOneField(
        Position,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # Account Status & Verification
    account_status = models.CharField(
        max_length=20,
        choices=ACCOUNT_STATUS_CHOICES,
        default='pending'
    )
    rejection_reason = models.TextField(null=True, blank=True)
    resubmitted = models.BooleanField(default=False)
    submission_count = models.IntegerField(default=1)

    # Django Required Fields
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    pending_since = models.DateTimeField(null=True, blank=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name', 'date_of_birth']

    def save(self, *args, **kwargs):
        # Auto-generate unique User ID on first save
        if not self.user_id:
            last_user = CustomUser.objects.order_by('-id').first()
            next_number = (last_user.id + 1) if last_user else 1
            self.user_id = f'UMY{next_number:04d}'

        # Set pending_since timestamp when account is first created
        if not self.pending_since and self.account_status == 'pending':
            self.pending_since = timezone.now()

        super().save(*args, **kwargs)

    def get_age(self):
        # Calculates member's current age from date of birth
        today = timezone.now().date()
        age = today.year - self.date_of_birth.year
        if (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day):
            age -= 1
        return age

    def is_underage(self):
        # Returns True if member is below 18 years
        return self.get_age() < 18

    def is_pending_expired(self):
        # Returns True if account has been pending for more than 7 days
        if self.pending_since and self.account_status == 'pending':
            return (timezone.now() - self.pending_since).days > 7
        return False

    def __str__(self):
        return f'{self.first_name} {self.last_name} ({self.user_id})'


# =============================================================
# ACCOUNT VERIFICATION LOG MODEL
# Every approval or rejection action by the President or Vice
# President is recorded here for full audit trail and accountability.
# Stores who reviewed the account, when, what decision was made
# and the reason if rejected. This cannot be edited or deleted.
# =============================================================
class AccountVerificationLog(models.Model):
    DECISION_CHOICES = [
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    member = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='verification_logs'
    )
    reviewed_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='reviews_made'
    )
    decision = models.CharField(max_length=20, choices=DECISION_CHOICES)
    rejection_reason = models.TextField(null=True, blank=True)
    reviewed_at = models.DateTimeField(auto_now_add=True)
    submission_number = models.IntegerField(default=1)

    def __str__(self):
        return f'{self.member} - {self.decision} by {self.reviewed_by} on {self.reviewed_at}'