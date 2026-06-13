import Link from "next/link";
import { LoginButton } from "@/components/auth/LoginButton";

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
        <LoginButton className="btn btn-linkedin" style={{ width: "100%" }} />

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
