"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTheme } from "./ThemeProvider";
import { signOutAction } from "@/app/actions";
import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { isProfileIncomplete } from "@/lib/profile-validation";

interface NavClientProps {
  session: boolean;
  userName: string;
  userId?: string;
}



export function NavClient({ session, userName, userId }: NavClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isChatRoom = pathname.startsWith("/chat/") || pathname === "/proxnet-ai";
  const { theme, resolved, setTheme } = useTheme();
  const isIosUser = typeof window !== "undefined" && (/iphone|ipad|ipod/i.test(window.navigator.userAgent) || (window.navigator.userAgent.includes("Mac") && window.navigator.maxTouchPoints > 0));

  const isDark = resolved === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const navLinks = [
    { href: "/proximity", label: "Proximity", icon: MapPinIcon },
    { href: "/qa", label: "Chats", icon: ChatIcon },
    { href: "/forum", label: "Forum", icon: ForumIcon },
    { href: "/grow", label: "Grow", icon: GrowIcon },
  ];

  // Web Push & In-App Toast States
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; title: string; body: string; url: string }[]>([]);
  const [hasIncomingOpen, setHasIncomingOpen] = useState(false);
  const [hasCarpoolNotification, setHasCarpoolNotification] = useState(false);
  const [hasJobsNotification, setHasJobsNotification] = useState(false);
  // Per-toast swipe state
  const [swipeDelta, setSwipeDelta] = useState<Record<string, number>>({});
  const swipeStart = useRef<Record<string, number>>({});

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Dropdown States & Refs
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  // Profile completion state
  const [showProfileReminder, setShowProfileReminder] = useState(false);

  // Login Modal State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPwaInstallModal, setShowPwaInstallModal] = useState(false);
  const [deviceOs, setDeviceOs] = useState<"ios" | "android" | null>(null);

  // Wallet State
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Register native Google sign-in global receiver on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).onGoogleSignInSuccess = async (idToken: string) => {
        try {
          await signIn("google-native", { idToken, callbackUrl: "/profile" });
        } catch (e) {
          console.error("Native Google sign-in verification failed:", e);
        }
      };
      (window as any).onGoogleSignInError = (message: string) => {
        console.error("Native Google sign-in failed:", message);
        alert("Google Sign-in failed: " + message);
      };
    }
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).onGoogleSignInSuccess;
        delete (window as any).onGoogleSignInError;
      }
    };
  }, []);

  // Register custom event listener for Login Modal
  useEffect(() => {
    const handler = () => setShowLoginModal(true);
    window.addEventListener("openLoginModal", handler);
    return () => window.removeEventListener("openLoginModal", handler);
  }, []);

  // Detect if running on mobile browser (not standalone PWA and not native app)
  useEffect(() => {
    if (typeof window !== "undefined" && session && searchParams.get("fresh_login") === "true") {
      const isStandalone = 
        (window.navigator as any).standalone === true || 
        window.matchMedia("(display-mode: standalone)").matches;

      if (!isStandalone) {
        const ua = window.navigator.userAgent.toLowerCase();
        const isIpad = ua.includes("ipad");
        const isIphone = ua.includes("iphone") && !ua.includes("like iphone");
        const isMacintosh = ua.includes("macintosh") && typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
        
        const isIosDevice = isIphone || isIpad || isMacintosh;
        const isAndroidDevice = ua.includes("android");
        const isNativeApp = !!(window as any).AndroidBridge;

        if (!isNativeApp) {
          if (isIosDevice) {
            setDeviceOs("ios");
            setShowPwaInstallModal(true);
          } else if (isAndroidDevice) {
            setDeviceOs("android");
            setShowPwaInstallModal(true);
          }
        }
      }
      
      // Strip fresh_login from URL without triggering a reload
      const newUrl = window.location.pathname + window.location.search.replace(/([?&])fresh_login=true&?/, '$1').replace(/[?&]$/, '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [session, searchParams]);

  // Auto-trigger Login Modal inside native Android app if user is not authenticated
  useEffect(() => {
    if (typeof window !== "undefined" && !session) {
      const isNativeApp = !!(window as any).AndroidBridge;
      if (isNativeApp) {
        setShowLoginModal(true);
      }
    }
  }, [session]);

  // In-App Notification Center
  const [inAppNotifications, setInAppNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [expandedNotifs, setExpandedNotifs] = useState<Record<string, boolean>>({});
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        desktopDropdownRef.current &&
        !desktopDropdownRef.current.contains(event.target as Node)
      ) {
        setDesktopMenuOpen(false);
      }
      if (
        mobileDropdownRef.current &&
        !mobileDropdownRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    }
    if (desktopMenuOpen || mobileMenuOpen || notificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [desktopMenuOpen, mobileMenuOpen, notificationsOpen]);

  const fetchInAppNotifications = () => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (data.notifications) setInAppNotifications(data.notifications);
      })
      .catch(() => {});
  };

  const handleNotificationClick = (id: string, url: string) => {
    setNotificationsOpen(false);
    
    // Optimistic update - set is_read to true
    setInAppNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    
    // Fire and forget the database update
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    }).catch(e => console.error("Failed to mark notification as read", e));

    if (url) {
      router.push(url);
    }
  };

  const triggerToast = (toast: { title: string; body: string; url: string }) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, ...toast }]);

    fetchInAppNotifications();

    try {
      const audio = document.getElementById('honk-audio') as HTMLAudioElement;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch((e) => console.log('Audio play failed:', e));
      }
    } catch (e) {}

    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Register SW and check permission on mount
  useEffect(() => {
    if (!session || typeof window === "undefined") {
      return;
    }

    // 1. Check if running inside the native Android app (via bridge)
    if ((window as any).AndroidBridge) {
      const registerNativeToken = async (token: string) => {
        try {
          await fetch("/api/fcm/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, platform: "android" }),
          });
          console.log("FCM token registered natively for Android");
        } catch (e) {
          console.error("Native JS Bridge token registration failed:", e);
        }
      };

      // Expose callback for when Android loads the token asynchronously
      (window as any).onAndroidFCMTokenReady = (token: string) => {
        if (token) {
          registerNativeToken(token);
        }
      };

      // Check if it is already available on the bridge immediately
      const currentToken = (window as any).AndroidBridge.getFCMToken();
      if (currentToken) {
        registerNativeToken(currentToken);
      }
      return; // Skip normal PWA service worker setup
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    // Register static sw.js and dynamic firebase-messaging-sw.js
    navigator.serviceWorker.register("/sw.js").catch(err => console.error("SW sw.js registration failed:", err));
    
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "";
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
    const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "";
    const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "";
    const query = `?apiKey=${encodeURIComponent(apiKey)}&authDomain=${encodeURIComponent(authDomain)}&projectId=${encodeURIComponent(projectId)}&messagingSenderId=${encodeURIComponent(messagingSenderId)}&appId=${encodeURIComponent(appId)}`;
    
    navigator.serviceWorker.register(`/firebase-messaging-sw.js${query}`, { scope: "/" }).catch(err => console.error("SW FCM registration failed:", err));

    const checkPermission = async () => {
      const permission = Notification.permission;
      const dismissed = localStorage.getItem("dismissed_push_prompt") === "true";
      const fcmVapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

      // Only show prompt if permission is default, not dismissed, and FCM VAPID key is configured
      if (permission === "default" && !dismissed && fcmVapidKey) {
        setShowPushPrompt(true);
      } else if (permission === "granted") {
        try {
          const { getMessaging, getToken, getFcmRegistration } = await import("@/lib/firebase-client");
          const messaging = getMessaging();
          const registration = await getFcmRegistration();
          if (!registration) {
            throw new Error("Could not find FCM service worker registration.");
          }
          const token = await getToken(messaging, {
            vapidKey: fcmVapidKey,
            serviceWorkerRegistration: registration
          });
          if (token) {
            await fetch("/api/fcm/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, platform: "web" }),
            });
          }
        } catch (e) {
          console.error("Failed to sync FCM token on mount:", e);
        }
      }
    };

    checkPermission();

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show the prompt if they haven't dismissed it
      if (localStorage.getItem("dismissed_install_prompt") !== "true") {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [session]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setShowInstallPrompt(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
  };

  const dismissInstallPrompt = () => {
    localStorage.setItem("dismissed_install_prompt", "true");
    setShowInstallPrompt(false);
  };

  // Handle FCM Push Subscription
  const subscribeToPush = async () => {
    // Dismiss the prompt banner and save state immediately on click
    setShowPushPrompt(false);
    localStorage.setItem("dismissed_push_prompt", "true");

    if (isIosUser) {
      router.push("/profile#notifications");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return;
      }

      const fcmVapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!fcmVapidKey) {
        console.error("Firebase VAPID key not set in environment.");
        return;
      }

      const { getMessaging, getToken, getFcmRegistration } = await import("@/lib/firebase-client");
      const messaging = getMessaging();
      const registration = await getFcmRegistration();
      if (!registration) {
        throw new Error("Could not find FCM service worker registration.");
      }
      const token = await getToken(messaging, {
        vapidKey: fcmVapidKey,
        serviceWorkerRegistration: registration
      });

      if (token) {
        await fetch("/api/fcm/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, platform: "web" }),
        });
      }
    } catch (error) {
      console.error("Failed to subscribe to FCM push:", error);
    }
  };

  const dismissPrompt = () => {
    localStorage.setItem("dismissed_push_prompt", "true");
    setShowPushPrompt(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Empty body updates all for the user
      });
      setInAppNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error("Failed to mark all as read", e);
    }
  };

  const handleTabClick = async (e: React.MouseEvent, tabHref: string) => {
    const tabPaths = ["/proximity", "/qa", "/forum", "/grow"];
    const isOnTabRoute = tabPaths.includes(pathname);

    if (isOnTabRoute && tabPaths.includes(tabHref)) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("tabchange", { detail: tabHref }));
      window.history.pushState(null, "", tabHref);
    }

    let targetNotifs = [];
    if (tabHref === "/qa") {
      targetNotifs = inAppNotifications.filter(
        (n) => !n.is_read && (n.url?.includes("/chat") || n.url === "/qa" || n.url === "/proxnet-ai")
      );
    } else if (tabHref === "/forum") {
      targetNotifs = inAppNotifications.filter(
        (n) => !n.is_read && n.url?.includes("/forum")
      );
    }

    if (targetNotifs.length > 0) {
      const ids = targetNotifs.map((n) => n.id);
      setInAppNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
      );
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
      } catch (err) {
        console.error("Failed to mark notifications as read", err);
      }
    }
  };

  // Fetch initial incoming open count
  useEffect(() => {
    if (!session) return;
    fetch("/api/questions")
      .then((r) => r.json())
      .then((data) => {
        const openCount = (data.incoming ?? []).filter((q: any) => q.status !== "responded").length;
        setHasIncomingOpen(openCount > 0);
      })
      .catch(() => {});
      
    // Fetch carpool notifications
    const fetchCarpoolNotifications = () => {
      fetch("/api/carpool/notifications")
        .then((r) => r.json())
        .then((data) => {
          setHasCarpoolNotification(data.unreadCount > 0 || data.newMatches > 0);
        })
        .catch(() => {});
    };

    // Fetch jobs notifications
    const fetchJobsNotifications = () => {
      fetch("/api/jobs/notifications")
        .then((r) => r.json())
        .then((data) => {
          setHasJobsNotification(data.unreadCount > 0 || data.newMatches > 0);
        })
        .catch(() => {});
    };
    
    fetchCarpoolNotifications();
    fetchJobsNotifications();
    fetchInAppNotifications();
    
    // Poll every 30s as a fallback
    const interval = setInterval(() => {
      fetchCarpoolNotifications();
      fetchJobsNotifications();
      fetchInAppNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [session]);

  // Profile Completion & Geolocation
  useEffect(() => {
    if (!session) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then(async (user) => {
        if (!user || user.error) return;

        if (user.wallet !== undefined) {
          setWalletBalance(user.wallet);
        }
        
        let hasHomeLocation = !!user.home_lat;
        let isProfileComplete = !isProfileIncomplete(user);

        const dismissed = sessionStorage.getItem("dismissed_profile_reminder");

        if (!hasHomeLocation) {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                const data = await res.json();
                let name = "Current Location";
                if (data && data.address) {
                  name = data.address.suburb || data.address.neighbourhood || data.address.city || data.address.town || data.address.village || data.address.county || "Current Location";
                }
                await fetch("/api/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ home_lat: lat, home_lng: lng, home_name: name })
                });
                
                isProfileComplete = !isProfileIncomplete({ ...user, home_lat: lat, home_lng: lng });
                if (!isProfileComplete && !dismissed) setShowProfileReminder(true);
              } catch (e) {
                console.error("Failed to reverse geocode and save location", e);
                if (!isProfileComplete && !dismissed) setShowProfileReminder(true);
              }
            }, (err) => {
              console.warn("Geolocation denied or failed", err);
              if (!isProfileComplete && !dismissed) setShowProfileReminder(true);
            });
          } else {
             if (!isProfileComplete && !dismissed) setShowProfileReminder(true);
          }
        } else {
          if (!isProfileComplete && !dismissed) setShowProfileReminder(true);
        }
      })
      .catch(() => {});
  }, [session]);

  // Realtime In-App Toasts Subscription
  useEffect(() => {
    if (!session || !userId) return;

    const supabase = createBrowserClient();

    // 1. Listen to question targets targeting this professional
    const targetChannel = supabase
      .channel("my-question-targets")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "question_targets",
          filter: `professional_id=eq.${userId}`,
        },
        async (payload) => {
          console.log("Realtime incoming target payload:", payload);
          const qId = payload.new.question_id;
          const qRes = await fetch(`/api/questions`);
          if (qRes.ok) {
            const data = await qRes.json();
            const matchingQ = data.incoming?.find((item: any) => item.id === qId);
            if (matchingQ) {
              triggerToast({
                title: "New Incoming Question",
                body: matchingQ.body,
                url: `/qa`,
              });
              setHasIncomingOpen(true);
            }
          }
        }
      )
      .subscribe();

    // 2. Listen to all chat messages and filter locally for rooms I'm in
    const messageChannel = supabase
      .channel("all-chat-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async (payload) => {
          if (payload.new.sender_id === userId) return;

          // Verify if I am a participant in this session
          const { data: isParticipant } = await supabase
            .from("chat_participants")
            .select("alias")
            .eq("session_id", payload.new.session_id)
            .eq("user_id", userId)
            .maybeSingle();

          if (isParticipant) {
            const { data: sender } = await supabase
              .from("chat_participants")
              .select("alias")
              .eq("session_id", payload.new.session_id)
              .eq("user_id", payload.new.sender_id)
              .maybeSingle();

            triggerToast({
              title: `New Message from ${sender?.alias || "Anonymous"}`,
              body: payload.new.body,
              url: `/chat/${payload.new.session_id}`,
            });
          }
        }
      )
      .subscribe();

    // 3. Listen to all carpool messages and filter locally for rooms I'm in
    const carpoolMessageChannel = supabase
      .channel("all-carpool-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "carpool_messages",
        },
        async (payload) => {
          if (payload.new.sender_id === userId) return;

          // Verify if I am a participant in this thread
          const { data: isParticipant } = await supabase
            .from("carpool_participants")
            .select("alias")
            .eq("thread_id", payload.new.thread_id)
            .eq("user_id", userId)
            .maybeSingle();

          if (isParticipant) {
            const { data: sender } = await supabase
              .from("carpool_participants")
              .select("alias")
              .eq("thread_id", payload.new.thread_id)
              .eq("user_id", payload.new.sender_id)
              .maybeSingle();

            const audio = new Audio('/car-honk.mp3');
            audio.play().catch(() => {}); // catch in case browser blocks auto-play

            triggerToast({
              title: `Carpool: Message from ${sender?.alias || "Anonymous"}`,
              body: payload.new.body,
              url: `/carpool/chat/${payload.new.thread_id}`,
            });
          }
        }
      )
      .subscribe();

    // Listen for new in-app notifications
    const inAppChannel = supabase
      .channel("in-app-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "in_app_notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const newNotif = payload.new as any;
          triggerToast({
            title: newNotif.title,
            body: newNotif.body,
            url: newNotif.url || "/",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(targetChannel);
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(carpoolMessageChannel);
      supabase.removeChannel(inAppChannel);
    };
  }, [session, userId]);

  // Unlock audio on first interaction for Android/iOS
  useEffect(() => {
    const unlockAudio = () => {
      const audio = document.getElementById('honk-audio') as HTMLAudioElement;
      if (audio) {
        // Silently play and immediately pause to unlock the audio context
        audio.volume = 0;
        audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1; // Restore volume for actual plays
        }).catch(() => {});
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);
  return (
    <>
      <audio id="honk-audio" src="/car-honk.mp3" preload="auto" />

      {/* PWA Installation Promo Banner for Mobile Browsers removed */}
      {/* Desktop Top Nav */}
      {!isChatRoom && (
        <header
          className="hidden md:block sticky top-0 z-[1010] bg-[var(--color-surface)] border-b border-[var(--color-border-light)] shadow-[var(--shadow-sm)]"
          style={{ height: "var(--nav-height)" }}
        >
          <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <img src="/logo.png" alt="ProxNet" className="h-7 w-7 object-contain rounded" />
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                <span style={{
                  background: "linear-gradient(135deg, var(--color-primary) 30%, #0077ff 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontWeight: 800,
                  letterSpacing: "-0.02em"
                }}>Prox</span>
                <span style={{
                  background: "linear-gradient(135deg, var(--color-accent) 30%, #a855f7 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontWeight: 500,
                  letterSpacing: "-0.01em"
                }}>Net</span>
                <sup style={{
                  fontSize: "0.55em",
                  fontWeight: "bold",
                  color: "var(--color-text-secondary)",
                  marginLeft: "1px",
                  verticalAlign: "super"
                }}>®</sup>
              </span>
            </Link>
            
            <nav className="flex h-full items-center">
              {session &&
                navLinks.map((l) => {
                  const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
                  const hasUnreadChats = inAppNotifications.some(
                    (n) => !n.is_read && (n.url?.includes("/chat") || n.url === "/qa" || n.url === "/proxnet-ai")
                  );
                  const hasUnreadForum = inAppNotifications.some(
                    (n) => !n.is_read && n.url?.includes("/forum")
                  );
                  const showBadge = l.href === "/qa" 
                    ? (hasUnreadChats || hasIncomingOpen) && !active 
                    : l.href === "/forum" 
                      ? hasUnreadForum && !active 
                      : false;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={(e) => handleTabClick(e, l.href)}
                      className="flex h-full items-center gap-2 px-4 text-sm font-medium transition-colors hover:bg-[var(--color-surface-hover)] relative"
                      style={{
                        color: active ? "var(--color-primary)" : "var(--color-text-secondary)",
                      }}
                    >
                      <span className="relative">
                        <l.icon className="h-4 w-4" />
                        {showBadge && (
                          <span
                            className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                            style={{ backgroundColor: "var(--color-error)" }}
                          />
                        )}
                      </span>
                      {l.label}
                      {active && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                          style={{ backgroundColor: "var(--color-primary)" }}
                        />
                      )}
                    </Link>
                  );
                })}
            </nav>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); toggleTheme(); }}
                className="btn-icon btn-ghost flex items-center justify-center text-[var(--color-text-secondary)]"
                aria-label="Toggle theme"
              >
                {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
              </button>
              
              {session ? (
                <>
                  <div className="relative" ref={desktopDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDesktopMenuOpen(!desktopMenuOpen)}
                    className="avatar avatar-sm text-[var(--color-primary)] bg-[var(--color-primary-subtle)] hover:scale-105 transition-transform flex items-center justify-center font-bold"
                    style={{ border: "none", outline: "none", padding: 0, cursor: "pointer" }}
                    title={userName}
                  >
                    {userName ? userName.charAt(0).toUpperCase() : "U"}
                  </button>
                  {desktopMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 py-2 w-48 bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] animate-fadeInDown z-[1020]"
                    >
                      <div className="px-4 py-2 border-b border-[var(--color-border-light)]">
                        <p className="text-body-sm font-semibold truncate text-[var(--color-text)]">
                          {userName || "User"}
                        </p>
                        <p className="text-caption truncate text-[var(--color-text-secondary)]">Logged in</p>
                        {walletBalance !== null && (
                          <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-surface-hover)] px-2 py-1 rounded">
                            <span>Credits</span>
                            <span>{walletBalance}</span>
                          </div>
                        )}
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setDesktopMenuOpen(false)}
                        className="w-full text-left px-4 py-2 hover:bg-[var(--color-surface-hover)] flex items-center gap-2 text-sm text-[var(--color-text)] transition-colors cursor-pointer"
                        style={{ display: "flex", textDecoration: "none" }}
                      >
                        <UserIcon className="h-4 w-4" /> View Profile
                      </Link>
                      <form action={signOutAction} className="w-full">
                        <button
                          type="submit"
                          className="w-full text-left px-4 py-2 hover:bg-[var(--color-surface-hover)] flex items-center gap-2 text-sm text-[var(--color-error)] transition-colors cursor-pointer"
                          style={{ background: "none", border: "none" }}
                        >
                          <LogoutIcon className="h-4 w-4" /> Sign out
                        </button>
                      </form>
                    </div>
                  )}
                </div>
                </>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="btn btn-primary btn-sm"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Mobile Top Bar */}
      {!isChatRoom && (
        <header
          className="md:hidden sticky top-0 z-[1010] flex items-center justify-between px-4 bg-[var(--color-surface)] border-b border-[var(--color-border-light)] shadow-[var(--shadow-sm)]"
          style={{ height: "var(--nav-height)" }}
        >
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <img src="/logo.png" alt="ProxNet" className="h-6 w-6 object-contain rounded" />
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <span style={{
                background: "linear-gradient(135deg, var(--color-primary) 30%, #0077ff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 800,
                letterSpacing: "-0.02em"
              }}>Prox</span>
              <span style={{
                background: "linear-gradient(135deg, var(--color-accent) 30%, #a855f7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 500,
                letterSpacing: "-0.01em"
              }}>Net</span>
              <sup style={{
                fontSize: "0.55em",
                fontWeight: "bold",
                color: "var(--color-text-secondary)",
                marginLeft: "1px",
                verticalAlign: "super"
              }}>®</sup>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); toggleTheme(); }}
              className="btn-icon btn-ghost flex items-center justify-center text-[var(--color-text-secondary)]"
              aria-label="Toggle theme"
            >
              {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
            {session ? (
                <>
                <div className="relative" ref={mobileDropdownRef}>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="avatar avatar-sm text-[var(--color-primary)] bg-[var(--color-primary-subtle)] hover:scale-105 transition-transform flex items-center justify-center font-bold"
                  style={{ border: "none", outline: "none", padding: 0, cursor: "pointer" }}
                  title={userName}
                >
                  {userName ? userName.charAt(0).toUpperCase() : "U"}
                </button>
                {mobileMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 py-2 w-48 bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] animate-fadeInDown z-[1020]"
                  >
                    <div className="px-4 py-2 border-b border-[var(--color-border-light)]">
                      <p className="text-body-sm font-semibold truncate text-[var(--color-text)]">
                        {userName || "User"}
                      </p>
                      <p className="text-caption truncate text-[var(--color-text-secondary)]">Logged in</p>
                      {walletBalance !== null && (
                        <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-surface-hover)] px-2 py-1 rounded">
                          <span>Credits</span>
                          <span>{walletBalance}</span>
                        </div>
                      )}
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full text-left px-4 py-2 hover:bg-[var(--color-surface-hover)] flex items-center gap-2 text-sm text-[var(--color-text)] transition-colors cursor-pointer"
                      style={{ display: "flex", textDecoration: "none" }}
                    >
                      <UserIcon className="h-4 w-4" /> View Profile
                    </Link>
                    <form action={signOutAction} className="w-full">
                      <button
                        type="submit"
                        className="w-full text-left px-4 py-2 hover:bg-[var(--color-surface-hover)] flex items-center gap-2 text-sm text-[var(--color-error)] transition-colors cursor-pointer"
                        style={{ background: "none", border: "none" }}
                      >
                        <LogoutIcon className="h-4 w-4" /> Sign out
                      </button>
                    </form>
                    </div>
                  )}
                </div>
                </>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="btn btn-primary btn-sm px-3 py-1"
                >
                  Login
                </button>
              )}
          </div>
        </header>
      )}

      {/* Profile Completion Reminder Banner */}
      {showProfileReminder && (
        <>
          {/* Mobile floating sticky banner */}
          <div className="md:hidden fixed bottom-[calc(var(--bottom-nav-height)+8px)] left-4 right-4 z-[1005] bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl p-3 shadow-lg flex items-center justify-between animate-fadeInUp">
            <span className="font-semibold text-xs pr-2">Complete your profile to unlock proximity matching!</span>
            <div className="flex gap-3 items-center shrink-0">
              <Link href="/profile" className="bg-white text-orange-600 text-xs font-bold px-3 py-1.5 rounded-lg shadow hover:bg-white/95 transition-colors">Complete Now</Link>
              <button 
                onClick={() => {
                  sessionStorage.setItem("dismissed_profile_reminder", "true");
                  setShowProfileReminder(false);
                }}
                className="text-white/80 hover:text-white transition-colors"
                title="Dismiss"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>

          {/* Desktop/Tablet top sticky banner */}
          <div className="hidden md:flex bg-[var(--color-accent)] text-white px-4 py-3 text-sm items-center justify-between z-[1000] relative shadow-md">
            <span className="font-medium">Complete your profile to unlock better proximity matches!</span>
            <div className="flex gap-4 items-center shrink-0">
              <Link href="/profile" className="font-bold underline hover:text-white/80 transition-colors">Complete Now</Link>
              <button 
                onClick={() => {
                  sessionStorage.setItem("dismissed_profile_reminder", "true");
                  setShowProfileReminder(false);
                }}
                className="text-white hover:text-white/80 transition-colors"
                title="Dismiss for this session"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Tab Bar */}
      {!isChatRoom && session && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-[1010] flex items-center justify-around bg-[var(--color-surface)] border-t border-[var(--color-border-light)] shadow-[var(--shadow-lg)] pb-safe"
          style={{ height: "var(--bottom-nav-height)" }}
        >
          {navLinks.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
            const hasUnreadChats = inAppNotifications.some(
              (n) => !n.is_read && (n.url?.includes("/chat") || n.url === "/qa" || n.url === "/proxnet-ai")
            );
            const hasUnreadForum = inAppNotifications.some(
              (n) => !n.is_read && n.url?.includes("/forum")
            );
            const showBadge = l.href === "/qa" 
              ? (hasUnreadChats || hasIncomingOpen) && !active 
              : l.href === "/forum" 
                ? hasUnreadForum && !active 
                : false;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={(e) => handleTabClick(e, l.href)}
                className="flex flex-1 flex-col items-center justify-center gap-1 h-full transition-colors relative"
                style={{
                  color: active ? "var(--color-primary)" : "var(--color-text-tertiary)",
                }}
              >
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  />
                )}
                <span className="relative">
                  <l.icon className="h-5 w-5" />
                  {showBadge && (
                    <span
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                      style={{ backgroundColor: "var(--color-error)" }}
                    />
                  )}
                </span>
                <span className="text-[10px] font-medium">{l.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Push Permission Prompt Card */}
      {showPushPrompt && (
        <div className="fixed bottom-20 right-4 z-[99] max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)] animate-fadeInUp pointer-events-auto">
          <p className="text-sm font-semibold text-[var(--color-text)]">Enable Notifications</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 mb-3">Get real-time updates when nearby professionals answer your questions or reply in chat.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={dismissPrompt} className="btn btn-ghost btn-sm text-xs px-3 py-1 cursor-pointer">Later</button>
            <button onClick={subscribeToPush} className="btn btn-primary btn-sm text-xs px-3 py-1 cursor-pointer">Enable</button>
          </div>
        </div>
      )}

      {/* PWA Install Prompt Card */}
      {showInstallPrompt && (
        <div className="fixed bottom-20 left-4 z-[99] max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)] animate-fadeInUp pointer-events-auto flex items-start gap-4">
          <img src="/logo.png" alt="ProxNet" className="w-10 h-10 rounded-md shadow-sm" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--color-text)]">Install ProxNet App</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 mb-3">Install for a faster, native-like experience and quick access from your home screen.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={dismissInstallPrompt} className="btn btn-ghost btn-sm text-xs px-3 py-1 cursor-pointer">Maybe Later</button>
              <button onClick={handleInstallClick} className="btn btn-primary btn-sm text-xs px-3 py-1 cursor-pointer">Install Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time In-App Toasts List */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const delta = swipeDelta[t.id] ?? 0;
          return (
            <div
              key={t.id}
              onClick={() => {
                if (Math.abs(delta) > 10) return; // don't navigate if was swiping
                setToasts((prev) => prev.filter((item) => item.id !== t.id));
                window.location.href = t.url;
              }}
              onTouchStart={(e) => {
                swipeStart.current[t.id] = e.touches[0].clientX;
              }}
              onTouchMove={(e) => {
                const dx = e.touches[0].clientX - (swipeStart.current[t.id] ?? 0);
                if (dx > 0) setSwipeDelta((prev) => ({ ...prev, [t.id]: dx }));
              }}
              onTouchEnd={() => {
                const dx = swipeDelta[t.id] ?? 0;
                if (dx > 80) {
                  setToasts((prev) => prev.filter((item) => item.id !== t.id));
                } else {
                  setSwipeDelta((prev) => ({ ...prev, [t.id]: 0 }));
                }
                delete swipeStart.current[t.id];
              }}
              style={{ transform: `translateX(${delta}px)`, opacity: delta > 0 ? Math.max(0, 1 - delta / 120) : 1, transition: delta === 0 ? "transform 0.2s, opacity 0.2s" : "none" }}
              className="pointer-events-auto cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)] flex flex-col gap-1 hover:translate-y-[-2px] animate-fadeInUp border-l-4 border-l-[var(--color-primary)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[var(--color-primary)]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a9.04 9.04 0 0 1-1.685 1.173 8.766 8.766 0 0 1-3.172.984 8.76 8.76 0 0 1-3.228-.409 8.794 8.794 0 0 1-2.875-1.748 8.802 8.802 0 0 1-1.885-2.738 8.758 8.758 0 0 1-.608-3.146 8.76 8.76 0 0 1 .682-3.376A8.75 8.75 0 0 1 4.25 4.75a8.775 8.775 0 0 1 3.204-1.956 8.76 8.76 0 0 1 3.238-.415c1.47 0 2.87.355 4.12 1.01a8.748 8.748 0 0 1 3.036 2.766 8.763 8.763 0 0 1 1.34 3.738 8.756 8.756 0 0 1-.508 3.528 8.784 8.784 0 0 1-1.785 2.873Z" />
                  </svg>
                  {t.title}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setToasts((prev) => prev.filter((item) => item.id !== t.id));
                  }}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{t.body}</p>
            </div>
          );
        })}
      </div>

      {/* PWA Install Guide Modal Overlay */}
      {showPwaInstallModal && deviceOs && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative animate-scaleIn pointer-events-auto flex flex-col items-center">
            <button
              onClick={() => setShowPwaInstallModal(false)}
              className="absolute top-4 right-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer bg-[var(--color-surface-hover)] rounded-full p-1"
              title="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <img src="/logo.png" alt="ProxNet" className="w-12 h-12 rounded-xl shadow-sm mb-4" />
            <h3 className="text-lg font-bold text-[var(--color-text)] text-center mb-1">Install ProxNet</h3>
            <p className="text-sm text-[var(--color-text-secondary)] text-center mb-6">
              Get the fast, app-like experience on your home screen.
            </p>

            {deviceOs === "ios" ? (
              <div className="flex flex-col gap-4 w-full">
                <div className="flex gap-3 items-center bg-[var(--color-surface-hover)] p-3 rounded-lg border border-[var(--color-border-light)]">
                  <div className="w-7 h-7 rounded bg-white flex items-center justify-center shadow-sm shrink-0">
                    1
                  </div>
                  <p className="text-sm m-0 leading-tight">Tap the <strong className="text-[var(--color-text)]">Share</strong> icon at the bottom of Safari.</p>
                </div>
                <div className="flex gap-3 items-center bg-[var(--color-surface-hover)] p-3 rounded-lg border border-[var(--color-border-light)]">
                  <div className="w-7 h-7 rounded bg-white flex items-center justify-center shadow-sm shrink-0">
                    2
                  </div>
                  <p className="text-sm m-0 leading-tight">Select <strong className="text-[var(--color-text)]">Add to Home Screen</strong> from the menu.</p>
                </div>
                <div className="flex gap-3 items-center bg-[var(--color-surface-hover)] p-3 rounded-lg border border-[var(--color-border-light)]">
                  <div className="w-7 h-7 rounded bg-white flex items-center justify-center shadow-sm shrink-0">
                    3
                  </div>
                  <p className="text-sm m-0 leading-tight"><strong className="text-[var(--color-text)]">Open the App</strong> from your Home Screen.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 w-full">
                <button
                  onClick={() => {
                    if (deferredPrompt) {
                      deferredPrompt.prompt();
                      deferredPrompt.userChoice.then((choiceResult: any) => {
                        if (choiceResult.outcome === 'accepted') {
                          console.log('User accepted the A2HS prompt');
                        }
                        setDeferredPrompt(null);
                        setShowPwaInstallModal(false);
                      });
                    } else {
                      // Fallback if deferredPrompt is not available
                      alert("Please use the 'Install App' or 'Add to Home Screen' option from your browser's menu.");
                    }
                  }}
                  className="w-full bg-[var(--color-primary)] text-white py-3 rounded-lg font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md"
                >
                  Install App
                </button>
              </div>
            )}
            <button 
              onClick={() => setShowPwaInstallModal(false)}
              className="mt-6 text-sm font-semibold text-[var(--color-primary)] hover:underline"
            >
              Continue in browser
            </button>
          </div>
        </div>
      )}

      {/* Login Modal Overlay */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative animate-scaleIn pointer-events-auto">
            {typeof window !== "undefined" && !(window as any).AndroidBridge && (
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer"
                title="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-[var(--color-text)]">Log in or sign up</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">Choose your preferred login method for ProxNet</p>
            </div>

            <div className="flex flex-col gap-3">
              {/* LinkedIn Button */}
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  signIn("linkedin", { callbackUrl: "/profile" });
                }}
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl font-semibold text-sm transition-all shadow-sm cursor-pointer"
                style={{
                  backgroundColor: "#0A66C2",
                  color: "#ffffff",
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#004182")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#0A66C2")}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                </svg>
                Sign in with LinkedIn
              </button>

              {/* Google Button */}
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  if ((window as any).AndroidBridge) {
                    (window as any).AndroidBridge.startGoogleSignIn();
                  } else {
                    signIn("google", { callbackUrl: "/profile" });
                  }
                }}
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl font-semibold text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all shadow-sm cursor-pointer"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Inline SVGs
function HomeIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function MapPinIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  );
}

function ChatIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
    </svg>
  );
}

function UserIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function SparklesIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  );
}

function SunIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  );
}

function MoonIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  );
}

function LogoutIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
    </svg>
  );
}

function CarIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  );
}

function BriefcaseIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.896 1.982-2.007 1.982H5.757c-1.111 0-2.007-.888-2.007-1.982v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v3.896m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

function ForumIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94-3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  );
}

function GrowIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235A8.987 8.987 0 0 1 9 18a8.987 8.987 0 0 1 6 1.235c0 .359-.142.7-.4.957a1.353 1.353 0 0 1-.957.4H4.357a1.353 1.353 0 0 1-.957-.4 1.353 1.353 0 0 1-.4-.957Z" />
    </svg>
  );
}
