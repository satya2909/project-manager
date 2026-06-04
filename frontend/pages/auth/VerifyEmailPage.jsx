import { useEffect, useState } from "react";
import { CheckCircle, XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { authApi } from "../../api";
import { useAuth } from "../../context/authcontext";
import { Spinner } from "../../components/ui";

const STATE = { LOADING: "loading", SUCCESS: "success", ERROR: "error" };

export default function VerifyEmailPage({ token, onNavigate }) {
  const { resendVerification } = useAuth();

  const [status, setStatus] = useState(STATE.LOADING);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus(STATE.ERROR);
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => setStatus(STATE.SUCCESS))
      .catch(() => setStatus(STATE.ERROR));
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    await resendVerification();
    setResending(false);
    setResent(true);
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (status === STATE.LOADING) {
    return (
      <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: "1.5rem",
            padding: "3rem 0",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              border: "3px solid var(--edge)",
              borderTopColor: "var(--signal)",
              borderRadius: "50%",
              animation: "spin 600ms linear infinite",
            }}
          />
          <div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "var(--text-bright)",
                letterSpacing: "-0.02em",
                marginBottom: "0.5rem",
              }}
            >
              Verifying token
            </h2>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.8rem",
                color: "var(--ghost)",
              }}
            >
              authenticating your email address...
            </p>
          </div>
        </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (status === STATE.SUCCESS) {
    return (
      <div className="animate-scale-in" style={{ textAlign: "center" }}>
          {/* Icon */}
          <div
            style={{
              width: 72,
              height: 72,
              background: "var(--signal-dim)",
              border: "1px solid rgba(0,229,160,0.3)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 2rem",
              boxShadow: "0 0 40px rgba(0,229,160,0.15)",
              animation: "pulse-signal 3s ease infinite",
            }}
          >
            <CheckCircle size={32} color="var(--signal)" />
          </div>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text-bright)",
              marginBottom: "0.75rem",
              lineHeight: 1.1,
            }}
          >
            Identity confirmed.
          </h2>

          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.82rem",
              color: "var(--ghost)",
              lineHeight: 1.7,
              marginBottom: "2.5rem",
              maxWidth: 320,
              margin: "0 auto 2.5rem",
            }}
          >
            Your email has been verified. Your account is now fully active and
            ready to use.
          </p>

          {/* Status row */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--edge)",
              borderRadius: "var(--r-lg)",
              padding: "1rem 1.25rem",
              marginBottom: "2rem",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              textAlign: "left",
            }}
          >
            {[
              { label: "email", value: "verified", ok: true },
              { label: "account", value: "active", ok: true },
              { label: "access", value: "granted", ok: true },
              { label: "status", value: "ready", ok: true },
            ].map(({ label, value, ok }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.72rem",
                    color: "var(--dim)",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.72rem",
                    color: ok ? "var(--signal)" : "var(--rose)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onNavigate("login")}
            className="btn btn-primary"
            style={{
              display: "inline-flex",
              justifyContent: "center",
              padding: "0.75rem 1.5rem",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            proceed to sign in
            <ArrowRight size={15} />
          </button>
        </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  return (
    <div className="animate-scale-in" style={{ textAlign: "center" }}>
        {/* Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            background: "var(--rose-dim)",
            border: "1px solid rgba(255,94,125,0.3)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 2rem",
            boxShadow: "0 0 32px rgba(255,94,125,0.1)",
          }}
        >
          <XCircle size={32} color="var(--rose)" />
        </div>

        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text-bright)",
            marginBottom: "0.75rem",
            lineHeight: 1.1,
          }}
        >
          Link expired.
        </h2>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.82rem",
            color: "var(--ghost)",
            lineHeight: 1.7,
            marginBottom: "2.5rem",
            maxWidth: 300,
            margin: "0 auto 2rem",
          }}
        >
          This verification link is invalid or has expired. Request a new one
          below.
        </p>

        {/* Error code */}
        <div
          style={{
            background: "var(--ink-90)",
            border: "1px solid rgba(255,94,125,0.2)",
            borderRadius: "var(--r-md)",
            padding: "0.75rem 1rem",
            marginBottom: "2rem",
            fontFamily: "var(--font-mono)",
            fontSize: "0.72rem",
            color: "var(--rose)",
            letterSpacing: "0.04em",
            textAlign: "left",
          }}
        >
          <span style={{ color: "var(--dim)" }}>ERR </span>
          TOKEN_EXPIRED_OR_INVALID
        </div>

        {/* Resend */}
        {!resent ? (
          <button
            onClick={handleResend}
            className="btn btn-ghost"
            disabled={resending}
            style={{
              width: "100%",
              justifyContent: "center",
              padding: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            {resending ? (
              <>
                <Spinner size="sm" /> sending...
              </>
            ) : (
              <>
                <RotateCcw size={15} /> resend verification email
              </>
            )}
          </button>
        ) : (
          <div
            style={{
              padding: "0.75rem",
              background: "var(--signal-dim)",
              border: "1px solid rgba(0,229,160,0.2)",
              borderRadius: "var(--r-md)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8rem",
              color: "var(--signal)",
              marginBottom: "1rem",
            }}
          >
            ✓ new verification email sent
          </div>
        )}

        <button
          type="button"
          onClick={() => onNavigate("login")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
            color: "var(--ghost)",
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "none",
            transition: "color 120ms ease",
            padding: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ghost)")}
        >
          ← back to sign in
        </button>
      </div>
  );
}
