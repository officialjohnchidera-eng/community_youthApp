from django.urls import path
from . import views

urlpatterns = [
    # Meeting URLs
    path('meetings/', views.get_meetings, name='get_meetings'),
    path('meetings/create/', views.create_meeting, name='create_meeting'),
    path('meetings/<int:meeting_id>/', views.get_meeting_detail, name='get_meeting_detail'),
    path('meetings/<int:meeting_id>/update/', views.update_meeting, name='update_meeting'),
    path('meetings/<int:meeting_id>/attendance/', views.mark_meeting_attendance, name='mark_meeting_attendance'),
    path('meetings/<int:meeting_id>/expenditure/', views.log_meeting_expenditure, name='log_meeting_expenditure'),

    # Work Activity URLs
    path('activities/', views.get_work_activities, name='get_work_activities'),
    path('activities/create/', views.create_work_activity, name='create_work_activity'),
    path('activities/<int:activity_id>/', views.get_work_activity_detail, name='get_work_activity_detail'),
    path('activities/<int:activity_id>/update/', views.update_work_activity, name='update_work_activity'),
    path('activities/<int:activity_id>/attendance/', views.mark_activity_attendance, name='mark_activity_attendance'),
    path('activities/<int:activity_id>/expenditure/', views.log_activity_expenditure, name='log_activity_expenditure'),
    path('meetings/<int:meeting_id>/minutes/', views.update_meeting_minutes, name='update_meeting_minutes'),
]