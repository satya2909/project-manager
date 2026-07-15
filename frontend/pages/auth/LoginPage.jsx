import { useState } from "react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/authcontext";
import { InlineError, Spinner } from "../../components/ui/primitive.jsx";

export default function LoginPage({ onNavigate }) {
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState("");

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Both fields are required.");
      return;
    }
    setLoading(true);
    const result = await login(form);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
    }
  };

  return (
    <div className="animate-fade-up delay-0">
      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 style={authTitle}>Welcome back</h2>
        <p style={authSubtitle}>Sign in to your workspace</p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
      >
        {/* Email */}
        <div className="animate-fade-up delay-100 input-group">
          <label className="input-label" htmlFor="email">
            {focused === "email" || form.email ? (
              <span style={{ color: "var(--signal)" }}>▸ email address</span>
            ) : (
              "email address"
            )}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="input-field"
            placeholder="operator@projectcamp.io"
            value={form.email}
            onChange={handleChange}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused("")}
            disabled={loading}
          />
        </div>

        {/* Password */}
        <div className="animate-fade-up delay-150 input-group">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.4rem",
            }}
          >
            <label
              className="input-label"
              htmlFor="password"
              style={{ margin: 0 }}
            >
              {focused === "password" || form.password ? (
                <span style={{ color: "var(--signal)" }}>▸ password</span>
              ) : (
                "password"
              )}
            </label>
            <button
              type="button"
              onClick={() => onNavigate("forgot-password")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                color: "var(--ghost)",
                textDecoration: "none",
                transition: "color 120ms ease",
                padding: 0,
              }}
              onMouseEnter={(e) => (e.target.style.color = "var(--signal)")}
              onMouseLeave={(e) => (e.target.style.color = "var(--ghost)")}
            >
              forgot?
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <input
              id="password"
              name="password"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              className="input-field"
              placeholder="••••••••••••"
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
                transition: "color 120ms ease",
                display: "flex",
                alignItems: "center",
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
        </div>

        {/* Error */}
        {error && (
          <div className="animate-fade-in">
            <InlineError message={error} />
          </div>
        )}

        {/* Submit */}
        <div className="animate-fade-up delay-200">
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
                <Spinner size="sm" />
                authenticating...
              </>
            ) : (
              <>
                sign in
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Footer link */}
      <div className="animate-fade-up delay-300" style={authFoot}>
        No account?{" "}
        <button type="button" onClick={() => onNavigate("register")} className="link" style={authFootLink}>
          Create one
        </button>
      </div>
    </div>
  );
}

// Shared auth text styles
export const authTitle = {
  fontFamily: "var(--font-display)",
  fontSize: "1.6rem",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  color: "var(--text)",
  marginBottom: "0.4rem",
  lineHeight: 1.15,
};
export const authSubtitle = { fontSize: "0.86rem", color: "var(--text-dim)" };
export const authFoot = {
  marginTop: "1.6rem",
  paddingTop: "1.4rem",
  borderTop: "1px solid var(--border)",
  textAlign: "center",
  fontSize: "0.83rem",
  color: "var(--text-dim)",
};
export const authFootLink = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  padding: 0,
  fontSize: "0.83rem",
};
