import Link from "next/link";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px",
        background: "var(--color-bg)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative gradient glow behind the card */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: "480px",
          height: "480px",
          borderRadius: "var(--radius-full)",
          background:
            "conic-gradient(from 180deg, var(--color-accent), var(--color-primary), var(--color-accent))",
          opacity: 0.15,
          filter: "blur(80px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        className="card animate-scaleIn"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "40px",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0",
        }}
      >
        {/* Logo */}
        <img
          src="/logo.png"
          alt="ProxNet"
          width={48}
          height={48}
          style={{ marginBottom: "12px" }}
        />

        {/* Brand name */}
        <h2
          className="text-h2"
          style={{
            margin: 0,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
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
            fontSize: "0.45em",
            fontWeight: "bold",
            color: "var(--color-text-secondary)",
            marginLeft: "2px",
            verticalAlign: "super"
          }}>®</sup>
        </h2>

        {/* Divider */}
        <hr
          className="divider"
          style={{ width: "100%", margin: "24px 0" }}
        />

        {/* Welcome heading */}
        <h1
          className="text-h1"
          style={{ margin: "0 0 8px 0", textAlign: "center" }}
        >
          Welcome back
        </h1>

        {/* Subtitle */}
        <p
          className="text-body-sm"
          style={{ margin: "0 0 28px 0", textAlign: "center" }}
        >
          Sign in to discover professionals in your proximity and connect
          anonymously.
        </p>

        {/* LinkedIn sign-in form */}
        <form
          action={async () => {
            "use server";
            await signIn("linkedin", { redirectTo: "/profile" });
          }}
          style={{ width: "100%" }}
        >
          <button
            type="submit"
            className="btn btn-linkedin"
            style={{ width: "100%" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="white"
              aria-hidden="true"
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Continue with LinkedIn
          </button>
        </form>

        {/* Security note */}
        <p
          className="text-caption"
          style={{
            margin: "20px 0 0 0",
            textAlign: "center",
          }}
        >
          🔒 Your identity remains anonymous to other users
        </p>

        {/* Admin login link */}
        <p
          className="text-caption"
          style={{
            margin: "24px 0 0 0",
            textAlign: "center",
          }}
        >
          <Link
            href="/admin/login"
            style={{
              color: "var(--color-text-tertiary)",
              textDecoration: "none",
              transition: "color var(--transition-fast)",
            }}
          >
            Admin login
          </Link>
        </p>
      </div>
    </div>
  );
}
