import { useEffect, useState, useRef } from "react";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { authApi } from "../../api";
import { useAuth } from "../../context/authcontext";
import { Spinner } from "../../components/ui/primitive.jsx";
import { authTitle, authSubtitle } from "./LoginPage.jsx";
import { BackToSignIn, iconCircle } from "./ForgotPasswordPage.jsx";

const STATE = { LOADING: "loading", SUCCESS: "success", ERROR: "error" };

export default function VerifyEmailPage({ token, onNavigate }) {
  const { resendVerification } = useAuth();
  const [status, setStatus] = useState(STATE.LOADING);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus(STATE.ERROR);
      return;
    }
    if (calledRef.current) return; // skip the StrictMode re-fire
    calledRef.current = true;
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

  if (status === STATE.LOADING) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", padding: "2rem 0", textAlign: "center" }}>
        <Spinner size="lg" />
        <div>
          <h2 style={{ ...authTitle, marginBottom: "0.3rem" }}>Verifying your email</h2>
          <p style={authSubtitle}>This only takes a moment…</p>
        </div>
      </div>
    );
  }

  if (status === STATE.SUCCESS) {
    return (
      <div className="animate-scale-in" style={{ textAlign: "center" }}>
        <div style={iconCircle("var(--signal-soft)", "var(--signal-line)")}>
          <CheckCircle2 size={26} color="var(--signal)" />
        </div>
        <h2 style={{ ...authTitle, textAlign: "center" }}>Email verified</h2>
        <p style={{ ...authSubtitle, lineHeight: 1.6 }}>
          Your account is fully active and ready to use.
        </p>
        <button
          type="button"
          onClick={() => onNavigate("login")}
          className="btn btn-primary"
          style={{ justifyContent: "center", padding: "0.75rem 1.5rem", marginTop: 24 }}
        >
          Continue to sign in <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  // Error
  return (
    <div className="animate-scale-in" style={{ textAlign: "center" }}>
      <div style={iconCircle("var(--danger-soft)", "color-mix(in srgb, var(--danger) 30%, transparent)")}>
        <XCircle size={26} color="var(--danger)" />
      </div>
      <h2 style={{ ...authTitle, textAlign: "center" }}>Link expired</h2>
      <p style={{ ...authSubtitle, lineHeight: 1.6 }}>
        This verification link is invalid or has expired. Request a new one below.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
        {!resent ? (
          <button onClick={handleResend} className="btn btn-ghost" disabled={resending} style={{ width: "100%", justifyContent: "center", padding: "0.75rem" }}>
            {resending ? <><Spinner size="sm" /> Sending…</> : <><RotateCcw size={15} /> Resend verification email</>}
          </button>
        ) : (
          <div style={{ padding: "0.7rem", background: "var(--signal-soft)", border: "1px solid var(--signal-line)", borderRadius: "var(--r-md)", fontSize: "0.82rem", color: "var(--signal)" }}>
            New verification email sent
          </div>
        )}
        <BackToSignIn onNavigate={onNavigate} />
      </div>
    </div>
  );
}
