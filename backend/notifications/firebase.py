import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings
import os


# =============================================================
# FIREBASE INITIALIZATION
# Initializes Firebase Admin SDK using the credentials file
# Only initializes once to avoid duplicate app errors
# =============================================================
def initialize_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(
            os.path.join(settings.BASE_DIR, settings.FIREBASE_CREDENTIALS)
        )
        firebase_admin.initialize_app(cred)


# =============================================================
# SEND NOTIFICATION TO SINGLE DEVICE
# Sends a push notification to a specific device token
# =============================================================
def send_push_notification(token, title, body, data=None):
    initialize_firebase()
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=data or {},
            token=token
        )
        response = messaging.send(message)
        return {'success': True, 'response': response}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# =============================================================
# SEND NOTIFICATION TO MULTIPLE DEVICES
# Sends a push notification to multiple device tokens at once
# Used for announcements, meeting notices etc
# =============================================================
def send_bulk_notification(tokens, title, body, data=None):
    initialize_firebase()
    if not tokens:
        return {'success': False, 'error': 'No tokens provided'}
    try:
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=data or {},
            tokens=tokens
        )
        response = messaging.send_each_for_multicast(message)
        return {
            'success': True,
            'success_count': response.success_count,
            'failure_count': response.failure_count
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}