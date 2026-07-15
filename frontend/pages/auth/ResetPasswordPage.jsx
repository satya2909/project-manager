import { useState } from "react";
import { Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import { useAuth } from "../../context/authcontext";
import { InlineError, InlineSuccess, Spinner } from "../../components/ui/primitive.jsx";
import { authTitle, authSubtitle } from "./LoginPage.jsx";
import { BackToSignIn } from "./ForgotPasswordPage.jsx";

function getStrength(password) {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "weak", color: "var(--danger)" };
  if (score <= 3) return { score, label: "fair", color: "var(--brass)" };
  return { score, label: "strong", color: "var(--signal)" };
}

export default function ResetPasswordPage({ token, onNavigate }) {
  const { resetPassword } = useAuth();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { score, label, color } = getStrength(form.password);

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setLoading(true);
    const result = await resetPassword(token, { password: form.password });
    setLoading(false);
    if (result.success) {
      setSuccess("Password updated. Redirecting to sign in…");
      setTimeout(() => onNavigate("login"), 2200);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="animate-fade-up delay-0">
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 style={authTitle}>Set a new password</h2>
        <p style={authSubtitle}>Choose a strong password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <div className="input-group">
          <label className="input-label" htmlFor="password">New password</label>
          <div style={{ position: "relative" }}>
            <input
              id="password"
              name="password"
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
              className="input-field"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={handleChange}
              disabled={loading}
              style={{ paddingRight: "2.75rem" }}
              autoFocus
            />
            <button type="button" onClick={() => setShowPass((p) => !p)} style={eyeBtn} aria-label={showPass ? "Hide password" : "Show password"}>
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {form.password && (
            <div style={{ marginTop: "0.5rem" }}>
              <div style={{ display: "flex", gap: 3, marginBottom: "0.3rem" }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? color : "var(--border)", transition: "background 300ms var(--ease)" }} />
                ))}
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.64rem", color, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
            </div>
          )}
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="confirm">Confirm password</label>
          <div style={{ position: "relative" }}>
            <input
              id="confirm"
              name="confirm"
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
              className="input-field"
              placeholder="Repeat new password"
              value={form.confirm}
              onChange={handleChange}
              disabled={loading}
              style={{ paddingRight: "2.75rem" }}
            />
            {form.confirm && form.password === form.confirm && (
              <div style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--signal)", display: "flex" }}>
                <Check size={15} />
              </div>
            )}
          </div>
        </div>

        {error && <InlineError message={error} />}
        {success && <InlineSuccess message={success} />}

        <button type="submit" className="btn btn-primary" disabled={loading || !!success} style={{ width: "100%", justifyContent: "center", padding: "0.75rem" }}>
          {loading ? <><Spinner size="sm" /> Updating…</> : success ? <><Check size={15} /> Updated</> : <>Update password <ArrowRight size={15} /></>}
        </button>
      </form>

      <div style={{ marginTop: "1.6rem", paddingTop: "1.4rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center" }}>
        <BackToSignIn onNavigate={onNavigate} />
      </div>
    </div>
  );
}

const eyeBtn = {
  position: "absolute",
  right: "0.75rem",
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-dim)",
  padding: 0,
  display: "flex",
  alignItems: "center",
};
