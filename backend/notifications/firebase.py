import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings
import os
import json


# =============================================================
# FIREBASE INITIALIZATION
# Initializes Firebase Admin SDK using credentials.
#
# On Railway (or any environment where committing the raw
# credentials JSON file to the repo is a security risk), the
# full service account JSON is stored in the FIREBASE_CREDENTIALS_JSON
# environment variable and parsed directly from memory.
#
# For local development, falls back to a credentials file on disk
# (settings.FIREBASE_CREDENTIALS) if the env var isn't set.
#
# Only initializes once to avoid duplicate app errors.
# =============================================================
def initialize_firebase():
    if firebase_admin._apps:
        return

    firebase_json = os.environ.get('FIREBASE_CREDENTIALS_JSON')

    if firebase_json:
        try:
            cred_dict = json.loads(firebase_json)
        except json.JSONDecodeError as e:
            raise RuntimeError(
                f"FIREBASE_CREDENTIALS_JSON env var is set but is not valid JSON: {e}"
            )
        cred = credentials.Certificate(cred_dict)
    else:
        cred_path = os.path.join(settings.BASE_DIR, settings.FIREBASE_CREDENTIALS)
        if not os.path.exists(cred_path):
            raise RuntimeError(
                f"No FIREBASE_CREDENTIALS_JSON env var set, and no credentials "
                f"file found at {cred_path}. Set FIREBASE_CREDENTIALS_JSON in "
                f"Railway variables, or place the credentials file locally."
            )
        cred = credentials.Certificate(cred_path)

    firebase_admin.initialize_app(cred)


# =============================================================
# SEND NOTIFICATION TO SINGLE DEVICE
#
# IMPORTANT: sent as a DATA-ONLY message (no 'notification' field).
# Web push has an ambiguous, SDK-version-dependent auto-display
# behavior when a 'notification' payload is present: Firebase may
# try to display it automatically WITHOUT invoking our own
# onBackgroundMessage() handler in the service worker, and that
# automatic path silently failed in testing (FCM reported successful
# delivery, but no notification ever appeared on the device).
#
# Sending data-only reliably forces onBackgroundMessage() in
# firebase-messaging-sw.js to run every time, giving us full control
# and a guaranteed call to self.registration.showNotification().
# =============================================================
def send_push_notification(token, title, body, data=None):
    initialize_firebase()
    try:
        payload_data = {
            'title': title,
            'body': body,
        }
        if data:
            payload_data.update({k: str(v) for k, v in data.items()})

        message = messaging.Message(
            data=payload_data,
            token=token
        )
        response = messaging.send(message)
        return {'success': True, 'response': response}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# =============================================================
# SEND NOTIFICATION TO MULTIPLE DEVICES
# Same data-only approach as above, for bulk sends.
# =============================================================
def send_bulk_notification(tokens, title, body, data=None):
    initialize_firebase()
    if not tokens:
        return {'success': False, 'error': 'No tokens provided'}
    try:
        payload_data = {
            'title': title,
            'body': body,
        }
        if data:
            payload_data.update({k: str(v) for k, v in data.items()})

        message = messaging.MulticastMessage(
            data=payload_data,
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
