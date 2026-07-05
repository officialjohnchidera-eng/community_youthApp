from django.urls import path
from . import views

urlpatterns = [
    # Payment requests
    path('requests/', views.get_payment_requests, name='get_payment_requests'),
    path('requests/create/', views.create_payment_request, name='create_payment_request'),
    path('requests/close/<int:payment_id>/', views.close_payment_request, name='close_payment_request'),

    # Payment transactions
    path('initiate/', views.initiate_payment, name='initiate_payment'),
    path('verify/<str:reference>/', views.verify_payment, name='verify_payment'),
    path('history/', views.get_payment_history, name='payment_history'),

    # Paystack webhook
    path('webhook/', views.paystack_webhook, name='paystack_webhook'),

    # Village payment status
    path('village-status/', views.get_village_payment_status, name='village_payment_status'),
    path('requests/closed/', views.get_closed_requests, name='closed_requests'),
    path('requests/reactivate/<int:payment_id>/', views.reactivate_payment_request, name='reactivate_request'),
    path('requests/<int:payment_id>/audit/', views.get_payment_request_audit, name='payment_audit'),
    path('receipt/<str:reference>/', views.download_receipt, name='download_receipt'),
    path('verify-receipt/<str:receipt_number>/', views.verify_receipt, name='verify_receipt'),
]