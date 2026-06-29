importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyANMesyk6r56pAjtXCbiDNM8qTXEHgO8xo",
  authDomain: "umuagu-youth.firebaseapp.com",
  projectId: "umuagu-youth",
  storageBucket: "umuagu-youth.firebasestorage.app",
  messagingSenderId: "1042805527645",
  appId: "1:1042805527645:web:d545a9e252550ee646a9b4"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'Umuagu Youth'
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})