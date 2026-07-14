import { NextResponse } from "next/server";

export async function GET() {
  const script = `
    importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

    firebase.initializeApp({
      apiKey: "${process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''}",
      authDomain: "${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || ''}",
      projectId: "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''}",
      messagingSenderId: "${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || ''}",
      appId: "${process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''}"
    });

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      const data = payload.data || {};
      const link = data.url || '/';

      self.registration.showNotification(title || 'ProxNet', {
        body: body || '',
        icon: '/logo.png',
        badge: '/icons/icon-96.png',
        data: { url: link, ...data },
        actions: [
          { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a reply...' }
        ],
      });
    });

    self.addEventListener('notificationclick', (event) => {
      event.notification.close();

      // Quick reply
      if (event.action === "reply") {
        const replyText = event.reply;
        const data = event.notification.data || {};
        
        if (replyText) {
          let url = "/api/admin/feedback";
          let bodyData = { body: replyText };

          if (data.sessionId) {
            url = "/api/chat/" + data.sessionId;
          }

          event.waitUntil(
            fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(bodyData)
            })
          );
          return;
        }
      }

      const urlToOpen = event.notification.data?.url || '/';

      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          for (const client of windowClients) {
            if (client.url.includes(urlToOpen) && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
      );
    });
  `;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
