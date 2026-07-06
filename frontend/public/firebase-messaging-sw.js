// PWA manifest injection point - required by vite-plugin-pwa injectManifest
// This must be present for the PWA to work
self.__WB_MANIFEST

// Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Workbox for caching
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')

// Force this new service worker to activate immediately instead of waiting
// for every open tab/PWA instance to fully close first. Without this, a
// phone that keeps the PWA backgrounded (rather than fully killed) can be
// stuck on an old cached bundle indefinitely, even after new deploys.
self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Precache assets injected by vite-plugin-pwa
if (workbox) {
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || [])

  // Receipt PDFs: always go straight to network, never cached, never
  // touched by NetworkFirst. Registered BEFORE the general API route
  // below, since Workbox uses the first route that matches a request.
  workbox.routing.registerRoute(
    ({ url }) =>
      url.origin === 'https://communityyouthapp-production.up.railway.app' &&
      url.pathname.startsWith('/api/payments/receipt/'),
    new workbox.strategies.NetworkOnly()
  )

  // Cache other API calls with NetworkFirst strategy
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

// Handle background push notifications.
// IMPORTANT: the backend now sends DATA-ONLY messages (no 'notification'
// field), specifically so this handler is guaranteed to run every time
// instead of relying on Firebase's built-in auto-display behavior, which
// proved unreliable (FCM confirmed delivery but nothing ever appeared on
// the device). Because of that, title/body now come from payload.data
// instead of payload.notification.
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload)

  const data = payload.data || {}
  const notificationTitle = data.title || 'Umuagu Youth'
  const notificationOptions = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.type || 'general',
    data: data,
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