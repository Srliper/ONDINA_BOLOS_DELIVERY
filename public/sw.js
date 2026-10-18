/*
 * Service worker do painel da Ondina Bolos: só mostra as notificações push da equipe
 * (pedido novo, pagamento aprovado, mensagem, bolo esgotado). Não guarda páginas em cache.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Ondina Bolos'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Novidade no painel.',
      icon: '/icon-192.png',
      badge: '/favicon.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/admin' },
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/admin', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const open = windows.find(client => client.url.startsWith(url))
      if (open) return open.focus()
      return self.clients.openWindow(url)
    }),
  )
})
