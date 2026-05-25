const CACHE_NAME = 'spotit-shell-v2'
const APP_SHELL = ['/', '/map', '/manifest.webmanifest', '/logo.png', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') {
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone))
        }

        return response
      })
      .catch(() =>
        caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse
          }

          if (request.mode === 'navigate') {
            return caches.match('/')
          }

          return Response.error()
        }),
      ),
  )
})

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  const data = payload.data || payload.notification?.data || {}
  const title = data.title || payload.notification?.title || '스팟잇'
  const body = data.body || payload.notification?.body || ''
  const href = data.href || payload.fcmOptions?.link || '/notifications'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.notificationId ? `spotit-${data.notificationId}` : 'spotit-notification',
      data: { href },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = new URL(event.notification.data?.href || '/notifications', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const sameOriginClient = clientList.find((client) => new URL(client.url).origin === self.location.origin)

      if (sameOriginClient) {
        if ('navigate' in sameOriginClient) {
          return sameOriginClient.navigate(targetUrl).then((client) => client?.focus())
        }

        return sameOriginClient.focus()
      }

      return self.clients.openWindow(targetUrl)
    }),
  )
})
