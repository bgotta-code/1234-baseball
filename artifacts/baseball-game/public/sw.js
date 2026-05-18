self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? '⚾ Your turn!', {
      body: data.body ?? "It's your turn to play",
      icon: '/favicon.svg',
      tag: 'baseball-turn',
      renotify: true,
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow('/');
      })
  );
});
