importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Parse configuration from the URL query params to make the service worker fully dynamic
const urlParams = new URLSearchParams(location.search);

const firebaseConfig = {
  apiKey: urlParams.get('apiKey'),
  authDomain: urlParams.get('authDomain'),
  projectId: urlParams.get('projectId'),
  messagingSenderId: urlParams.get('messagingSenderId'),
  appId: urlParams.get('appId'),
};

if (firebaseConfig.messagingSenderId && firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Background message handler
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    if (payload.notification || payload.data) {
      const notificationTitle = payload.notification?.title || payload.data?.title || "ProxNet Notification";
      const notificationBody = payload.notification?.body || payload.data?.body || "";
      const data = payload.data || {};
      // Deduplicate messages per chat session or notification category to prevent clutter
      const tag = data.sessionId ? `chat-${data.sessionId}` : (data.type || "proxnet-general");
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || "");

      const notificationOptions = {
        body: notificationBody,
        icon: 'https://www.proxnet.in/logo.png',
        badge: 'https://www.proxnet.in/icons/icon-96.png',
        silent: false,
        tag: tag,
        data: data
      };

      // vibrate and renotify cause WebKit TypeError on iOS Safari
      if (!isIOS) {
        notificationOptions.vibrate = [200, 100, 200];
        notificationOptions.renotify = true;
      }
      
      try {
        self.registration.showNotification(notificationTitle, notificationOptions);
      } catch (err) {
        console.warn('[firebase-messaging-sw.js] showNotification standard failed, falling back to minimal:', err);
        self.registration.showNotification(notificationTitle, {
          body: notificationBody,
          data: data
        });
      }
    }
  });
} else {
  console.warn('[firebase-messaging-sw.js] Firebase config parameters are missing.');
}

// Background notification click actions
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const rawTarget = data.url || data.click_action || '/';
  
  const origin = self.location.origin;
  let targetUrl = origin;
  try {
    if (rawTarget.startsWith('http://') || rawTarget.startsWith('https://')) {
      targetUrl = rawTarget;
    } else {
      targetUrl = new URL(rawTarget.startsWith('/') ? rawTarget : `/${rawTarget}`, origin).href;
    }
  } catch (e) {
    targetUrl = origin;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      // 1. WhatsApp-style tab reuse: find existing open ProxNet tab, focus it, and navigate to the target URL
      for (const client of windowClients) {
        if (client.url && client.url.startsWith(origin)) {
          if ('focus' in client) {
            await client.focus();
          }
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      
      // 2. If no existing ProxNet window/tab is open, cold-open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
