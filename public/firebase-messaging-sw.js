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
    
    if (payload.notification) {
      const notificationTitle = payload.notification.title || "ProxNet Notification";
      const notificationOptions = {
        body: payload.notification.body || "",
        icon: '/logo.png',
        badge: '/logo.png',
        data: payload.data || {}
      };
      
      self.registration.showNotification(notificationTitle, notificationOptions);
    }
  });
} else {
  console.warn('[firebase-messaging-sw.js] Firebase config parameters are missing.');
}

// Background notification click actions
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickAction = event.notification.data?.click_action || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(clickAction) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});
