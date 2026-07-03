// PWA manifest injection point - required by vite-plugin-pwa injectManifest
// This must be present for the PWA to work
self.__WB_MANIFEST

// Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Workbox for caching
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')

// Precache assets injected by vite-plugin-pwa
if (workbox) {
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || [])

  // Cache API calls with NetworkFirst strategy
  workbox.routing.registerRoute(
    ({ url }) => url.origin === 'https://communityyouthapp-production.up.railway.app',
    new workbox.strategies.NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 10,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
      ],
    })
  )
}

// Firebase initialization
firebase.initializeApp({
  apiKey: "AIzaSyANMesyk6r56pAjtXCbiDNM8qTXEHgO8xo",
  authDomain: "umuagu-youth.firebaseapp.com",
  projectId: "umuagu-youth",
  storageBucket: "umuagu-youth.firebasestorage.app",
  messagingSenderId: "1042805527645",
  appId: "1:1042805527645:web:d545a9e252550ee646a9b4"
})

const messaging = firebase.messaging()

// Handle background push notifications
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload)

  const notificationTitle = payload.notification?.title || 'Umuagu Youth'
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: payload.data?.type || 'general',
    data: payload.data || {},
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'close', title: 'Dismiss' }
    ]
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'close') return

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('umuaguyouthapp.vercel.app') && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('https://umuaguyouthapp.vercel.app/dashboard')
      }
    })
  )
})