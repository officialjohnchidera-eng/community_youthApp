from django.urls import path
from . import views

urlpatterns = [
    # Announcements
    path('announcements/', views.get_announcements, name='get_announcements'),
    path('announcements/create/', views.create_announcement, name='create_announcement'),

    # Documents
    path('documents/', views.get_documents, name='get_documents'),
    path('documents/upload/', views.upload_document, name='upload_document'),

    # Media Gallery
    path('media/', views.get_media, name='get_media'),
    path('media/public/', views.get_public_media, name='get_public_media'),
    path('media/upload/', views.upload_media, name='upload_media'),
    path('media/<int:media_id>/delete/', views.delete_media, name='delete_media'),

    # Welfare Records
    path('welfare/', views.get_welfare_records, name='get_welfare_records'),
    path('welfare/create/', views.create_welfare_record, name='create_welfare_record'),

    # Empowerment Records
    path('empowerment/', views.get_empowerment_records, name='get_empowerment_records'),
    path('empowerment/create/', views.create_empowerment_record, name='create_empowerment_record'),

    # Disciplinary Records
    path('disciplinary/', views.get_disciplinary_records, name='get_disciplinary_records'),
    path('disciplinary/create/', views.create_disciplinary_record, name='create_disciplinary_record'),
    path('disciplinary/<int:record_id>/update/', views.update_disciplinary_status, name='update_disciplinary_status'),

    # Polls
    path('polls/', views.get_polls, name='get_polls'),
    path('polls/create/', views.create_poll, name='create_poll'),
    path('polls/<int:poll_id>/vote/', views.vote_on_poll, name='vote_poll'),
    
]