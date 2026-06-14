from django.urls import path
from . import views

urlpatterns = [
    path('register-token/', views.register_device_token, name='register_device_token'),
    path('send-all/', views.send_notification_to_all, name='send_notification_to_all'),
    path('send-member/', views.send_notification_to_member, name='send_notification_to_member'),
    path('logs/', views.get_notification_logs, name='notification_logs'),
    path('my-notifications/', views.get_my_notifications, name='my_notifications'),
    path('<int:notification_id>/read/', views.mark_notification_read, name='mark_notification_read'),
    path('mark-all-read/', views.mark_all_read, name='mark_all_read'),
]