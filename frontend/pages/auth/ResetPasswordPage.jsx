import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthLayout from "../../components/layout/AuthLayout";
import { InlineError, InlineSuccess, Spinner } from "../../components/ui";

function getStrength(password) {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "weak", color: "var(--rose)" };
  if (score <= 3) return { score, label: "fair", color: "var(--amber)" };
  return { score, label: "strong", color: "var(--signal)" };
}

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const { token } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [focused, setFocused] = useState("");

  const { score, label, color } = getStrength(form.password);

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await resetPassword(token, { password: form.password });
    setLoading(false);

    if (result.success) {
      setSuccess("Password updated successfully!");
      setTimeout(() => navigate("/login"), 2500);
    } else {
      setError(result.error);
    }
  };

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
              background: "var(--signal-dim)",
              border: "1px solid rgba(0,229,160,0.2)",
              borderRadius: "var(--r-sm)",
              padding: "0.25rem 0.65rem",
              marginBottom: "1.25rem",
            }}
          >
            <ShieldCheck size={11} color="var(--signal)" />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.65rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--signal)",
              }}
            >
              set new password
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
            New credentials.
          </h2>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.82rem",
              color: "var(--ghost)",
              lineHeight: 1.6,
            }}
          >
            Choose a strong password for your account.
          </p>
        </div>

        {/* Token indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 0.9rem",
            background: "var(--ink-90)",
            border: "1px solid var(--edge)",
            borderRadius: "var(--r-md)",
            marginBottom: "1.5rem",
            fontFamily: "var(--font-mono)",
            fontSize: "0.72rem",
            color: "var(--ghost)",
          }}
        >
          <div className="notif-dot" />
          <span>reset token: </span>
          <span style={{ color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
            {token ? `${token.slice(0, 8)}...${token.slice(-4)}` : "invalid"}
          </span>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
        >
          {/* New password */}
          <div className="animate-fade-up delay-100 input-group">
            <label className="input-label" htmlFor="password">
              {focused === "password" || form.password ? (
                <span style={{ color: "var(--signal)" }}>▸ new password</span>
              ) : (
                "new password"
              )}
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                name="password"
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                className="input-field"
                placeholder="min. 8 characters"
                value={form.password}
                onChange={handleChange}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused("")}
                disabled={loading}
                style={{ paddingRight: "2.75rem" }}
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  transition: "color 120ms ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text-soft)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--muted)")
                }
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {/* Strength bar */}
            {form.password && (
              <div style={{ marginTop: "0.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "3px",
                    marginBottom: "0.3rem",
                  }}
                >
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        background: i <= score ? color : "var(--edge)",
                        transition: "background 300ms ease",
                      }}
                    />
                  ))}
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.65rem",
                    color,
                    letterSpacing: "0.06em",
                  }}
                >
                  {label}
                </span>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="animate-fade-up delay-150 input-group">
            <label className="input-label" htmlFor="confirm">
              {focused === "confirm" || form.confirm ? (
                <span style={{ color: "var(--signal)" }}>
                  ▸ confirm password
                </span>
              ) : (
                "confirm password"
              )}
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="confirm"
                name="confirm"
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                className="input-field"
                placeholder="repeat new password"
                value={form.confirm}
                onChange={handleChange}
                onFocus={() => setFocused("confirm")}
                onBlur={() => setFocused("")}
                disabled={loading}
                style={{ paddingRight: "2.75rem" }}
              />
              {form.confirm && form.password === form.confirm && (
                <div
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--signal)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Check size={15} />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="animate-fade-in">
              <InlineError message={error} />
            </div>
          )}
          {success && (
            <div className="animate-fade-in">
              <InlineSuccess message={success} />
            </div>
          )}

          <div className="animate-fade-up delay-200">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !!success}
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "0.75rem",
                fontSize: "0.85rem",
              }}
            >
              {loading ? (
                <>
                  <Spinner size="sm" /> updating password...
                </>
              ) : success ? (
                <>
                  <Check size={15} /> password updated
                </>
              ) : (
                <>
                  update password <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </form>

        <div
          className="animate-fade-up delay-300"
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
