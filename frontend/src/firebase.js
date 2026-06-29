import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: "AIzaSyANMesyk6r56pAjtXCbiDNM8qTXEHgO8xo",
  authDomain: "umuagu-youth.firebaseapp.com",
  projectId: "umuagu-youth",
  storageBucket: "umuagu-youth.firebasestorage.app",
  messagingSenderId: "1042805527645",
  appId: "1:1042805527645:web:d545a9e252550ee646a9b4"
}

const VAPID_KEY = "BIZwzysVMm8FiXYE3hF4GbUp2C4G9zPjqcywxoJOlCA70A-QJrkNxTtfJeAQc24yZ5wwZ0LElEz_maYtLo5ViN0"

const app = initializeApp(firebaseConfig)

let messaging = null
try {
  messaging = getMessaging(app)
} catch (err) {
  console.log('Firebase messaging not supported in this browser:', err)
}

export const requestNotificationPermission = async () => {
  if (!messaging) return null

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('Notification permission not granted')
      return null
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    return token
  } catch (error) {
    console.log('Error getting notification token:', error)
    return null
  }
}

export const onForegroundMessage = (callback) => {
  if (!messaging) return
  onMessage(messaging, (payload) => {
    callback(payload)
  })
}

export default app