import { useState } from "react";
import { ArrowRight, ArrowLeft, Send } from "lucide-react";
import { useAuth } from "../../context/authcontext";
import { InlineError, Spinner } from "../../components/ui/primitive.jsx";
import { authTitle, authSubtitle } from "./LoginPage.jsx";

export default function ForgotPasswordPage({ onNavigate }) {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return setError("Email address is required.");
    setLoading(true);
    const result = await forgotPassword(email);
    setLoading(false);
    if (result.success) setSent(true);
    else setError(result.error);
  };

  if (sent) {
    return (
      <div className="animate-scale-in" style={{ textAlign: "center" }}>
        <div style={iconCircle("var(--signal-soft)", "var(--signal-line)")}>
          <Send size={22} color="var(--signal)" />
        </div>
        <h2 style={{ ...authTitle, textAlign: "center" }}>Check your inbox</h2>
        <p style={{ ...authSubtitle, lineHeight: 1.6 }}>
          If an account exists for <span style={{ color: "var(--text)" }}>{email}</span>, a reset
          link is on its way. Check your spam folder if it doesn't arrive soon.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
          <button onClick={() => setSent(false)} className="btn btn-ghost" style={{ justifyContent: "center", padding: "0.7rem" }}>
            Didn't get it? Try again
          </button>
          <BackToSignIn onNavigate={onNavigate} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up delay-0">
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 style={authTitle}>Reset your password</h2>
        <p style={authSubtitle}>Enter your email and we'll send a reset link.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <div className="input-group">
          <label className="input-label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input-field"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            disabled={loading}
            autoFocus
          />
        </div>

        {error && <InlineError message={error} />}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "0.75rem" }}>
          {loading ? <><Spinner size="sm" /> Sending…</> : <>Send reset link <ArrowRight size={15} /></>}
        </button>
      </form>

      <div style={{ marginTop: "1.6rem", paddingTop: "1.4rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center" }}>
        <BackToSignIn onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function BackToSignIn({ onNavigate }) {
  return (
    <button type="button" onClick={() => onNavigate("login")} className="link" style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.83rem", padding: 0 }}>
      <ArrowLeft size={14} /> Back to sign in
    </button>
  );
}

export function iconCircle(bg, border) {
  return {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: bg,
    border: `1px solid ${border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 1.5rem",
  };
}
