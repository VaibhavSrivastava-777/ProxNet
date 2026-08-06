"use client";

import { signIn } from "next-auth/react";

interface LoginButtonProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function LoginButton({ className, style }: LoginButtonProps) {
  const handleGoogleClick = () => {
    if (typeof window !== "undefined" && (window as any).AndroidBridge) {
      (window as any).AndroidBridge.startGoogleSignIn();
    } else {
      signIn("google", { callbackUrl: "/profile?fresh_login=true" });
    }
  };

  const handleLinkedInClick = () => {
    signIn("linkedin", { callbackUrl: "/profile?fresh_login=true" });
  };

  const isHero = className?.includes("btn-lg") ?? false;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        maxWidth: "340px",
        justifyContent: "center",
        alignItems: "center",
        ...style,
      }}
      className="flex flex-col w-full max-w-[340px] gap-3"
    >
      {/* LinkedIn Button */}
      <button
        onClick={handleLinkedInClick}
        className={isHero ? "btn btn-lg w-full" : "btn w-full"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A66C2",
          color: "#ffffff",
          border: "none",
          width: "100%",
          padding: "12px 20px",
          borderRadius: "12px",
          fontWeight: 600,
          fontSize: "15px",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(10, 102, 194, 0.25)",
          transition: "all 0.2s ease",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = "#004182";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = "#0A66C2";
        }}
      >
        <svg className="w-5 h-5 mr-2 fill-current shrink-0" viewBox="0 0 24 24">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.75a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9Z"/>
        </svg>
        Sign in with LinkedIn
      </button>

      {/* Google Button */}
      <button
        onClick={handleGoogleClick}
        className={isHero ? "btn btn-lg w-full" : "btn w-full"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          color: "#18181b",
          border: "1px solid #e4e4e7",
          width: "100%",
          padding: "12px 20px",
          borderRadius: "12px",
          fontWeight: 600,
          fontSize: "15px",
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          transition: "all 0.2s ease",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = "#f4f4f5";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = "#ffffff";
        }}
      >
        <svg className="w-5 h-5 mr-2 shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}
