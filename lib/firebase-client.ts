import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const isSupported = () => 
  typeof window !== "undefined" && 
  "serviceWorker" in navigator && 
  "PushManager" in window;

export async function getFcmRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const registrations = await navigator.serviceWorker.getRegistrations();
  let reg = registrations.find(r => r.active && r.active.scriptURL.includes("firebase-messaging-sw"));
  if (!reg) {
    try {
      reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    } catch (e) {
      console.error("FCM SW registration failed:", e);
      return null;
    }
  }
  return reg;
}

export { app, getMessaging, getToken };
