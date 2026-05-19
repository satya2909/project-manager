import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft, Mail, Send } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthLayout from "../../components/layout/AuthLayout";
import { InlineError, Spinner } from "../../components/ui";

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Email address is required.");
      return;
    }
    setLoading(true);
    const result = await forgotPassword(email);
    setLoading(false);
    if (result.success) {
      setSent(true);
    } else {
      setError(result.error);
    }
  };

  // ── Sent state ───────────────────────────────────────────────────────────────
  if (sent) {
    return (
      <AuthLayout>
        <div className="animate-scale-in" style={{ textAlign: "center" }}>
          {/* Icon */}
          <div
            style={{
              width: 64,
              height: 64,
              background: "var(--signal-dim)",
              border: "1px solid rgba(0,229,160,0.3)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.75rem",
              boxShadow: "0 0 32px rgba(0,229,160,0.15)",
            }}
          >
            <Send size={24} color="var(--signal)" />
          </div>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.75rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text-bright)",
              marginBottom: "0.75rem",
              lineHeight: 1.1,
            }}
          >
            Transmission sent.
          </h2>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.82rem",
              color: "var(--ghost)",
              lineHeight: 1.7,
              marginBottom: "0.5rem",
            }}
          >
            If an account exists for
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.85rem",
              color: "var(--signal)",
              marginBottom: "1.5rem",
              fontWeight: 500,
            }}
          >
            {email}
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.82rem",
              color: "var(--ghost)",
              lineHeight: 1.7,
              marginBottom: "2rem",
            }}
          >
            you'll receive a password reset link shortly. Check your spam folder
            if it doesn't arrive within a few minutes.
          </p>

          {/* Resend */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--edge)",
              borderRadius: "var(--r-lg)",
              padding: "1rem 1.25rem",
              marginBottom: "2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
                color: "var(--ghost)",
              }}
            >
              didn't receive it?
            </span>
            <button
              onClick={() => setSent(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
                color: "var(--signal)",
                padding: 0,
                transition: "color 120ms ease",
              }}
              onMouseEnter={(e) => (e.target.style.color = "#00ffb2")}
              onMouseLeave={(e) => (e.target.style.color = "var(--signal)")}
            >
              try again →
            </button>
          </div>

          <Link
            to="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8rem",
              color: "var(--ghost)",
              textDecoration: "none",
              transition: "color 120ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ghost)")}
          >
            <ArrowLeft size={14} />
            back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // ── Form state ───────────────────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className="animate-fade-up delay-0">
        {/* Header */}
        <div style={{ marginBottom: "2.25rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--amber-dim)",
              border: "1px solid rgba(245,166,35,0.2)",
              borderRadius: "var(--r-sm)",
              padding: "0.25rem 0.65rem",
              marginBottom: "1.25rem",
            }}
          >
            <Mail size={11} color="var(--amber)" />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.65rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--amber)",
              }}
            >
              password recovery
            </span>
          </div>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text-bright)",
              marginBottom: "0.5rem",
              lineHeight: 1.1,
            }}
          >
            Locked out?
          </h2>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.82rem",
              color: "var(--ghost)",
              lineHeight: 1.6,
            }}
          >
            Enter your email and we'll send a reset link to your inbox.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
        >
          <div className="animate-fade-up delay-100 input-group">
            <label className="input-label" htmlFor="email">
              {focused || email ? (
                <span style={{ color: "var(--signal)" }}>▸ email address</span>
              ) : (
                "email address"
              )}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input-field"
              placeholder="operator@projectcamp.io"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="animate-fade-in">
              <InlineError message={error} />
            </div>
          )}

          <div className="animate-fade-up delay-150">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "0.75rem",
                fontSize: "0.85rem",
              }}
            >
              {loading ? (
                <>
                  <Spinner size="sm" /> sending link...
                </>
              ) : (
                <>
                  send reset link <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Back link */}
        <div
          className="animate-fade-up delay-200"
          style={{
            marginTop: "1.75rem",
            paddingTop: "1.75rem",
            borderTop: "1px solid var(--edge)",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Link
            to="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8rem",
              color: "var(--ghost)",
              textDecoration: "none",
              transition: "color 120ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ghost)")}
          >
            <ArrowLeft size={14} />
            back to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
