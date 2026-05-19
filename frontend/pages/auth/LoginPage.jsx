import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Terminal } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthLayout from "../../components/layout/AuthLayout";
import { InlineError, Spinner } from "../../components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

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
    if (result.success) {
      navigate("/dashboard", { replace: true });
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
            <Terminal size={11} color="var(--signal)" />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.65rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--signal)",
              }}
            >
              operator access
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
            Welcome back.
          </h2>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.82rem",
              color: "var(--ghost)",
            }}
          >
            Sign in to your workspace
          </p>
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
              <Link
                to="/forgot-password"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.7rem",
                  color: "var(--ghost)",
                  textDecoration: "none",
                  transition: "color 120ms ease",
                }}
                onMouseEnter={(e) => (e.target.style.color = "var(--signal)")}
                onMouseLeave={(e) => (e.target.style.color = "var(--ghost)")}
              >
                forgot?
              </Link>
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
        <div
          className="animate-fade-up delay-300"
          style={{
            marginTop: "1.75rem",
            paddingTop: "1.75rem",
            borderTop: "1px solid var(--edge)",
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
            color: "var(--ghost)",
          }}
        >
          no account?{" "}
          <Link to="/register" className="link" style={{ fontWeight: 500 }}>
            request access →
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
