from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    # Auth endpoints
    path('register/', views.register, name='register'),
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('logout/', views.logout, name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Profile endpoints
    path('profile/', views.get_profile, name='profile'),
    path('profile/update/', views.update_profile, name='update_profile'),
    path('profile/resubmit/', views.resubmit_account, name='resubmit_account'),

    # Villages and Positions
    path('villages/', views.get_villages, name='villages'),
    path('positions/', views.get_positions, name='positions'),

    # Account verification endpoints
    path('pending-accounts/', views.get_pending_accounts, name='pending_accounts'),
    path('verify/<str:user_id>/', views.approve_reject_account, name='approve_reject_account'),
    path('members/', views.get_members, name='get_members'),
    path('me/', views.get_me, name='get_me'),
    path('forgot-password/', views.forgot_password, name='forgot_password'),
    path('reset-password/', views.reset_password, name='reset_password'),
]
