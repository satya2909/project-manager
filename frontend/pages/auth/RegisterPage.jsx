import { useState } from "react";
import { Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import { useAuth } from "../../context/authcontext";
import { InlineError, InlineSuccess, Spinner } from "../../components/ui/primitive.jsx";
import { authTitle, authSubtitle, authFoot, authFootLink } from "./LoginPage.jsx";

// ─── PASSWORD STRENGTH ────────────────────────────────────────────────────────
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

function StrengthBar({ password }) {
  const { score, label, color } = getStrength(password);
  if (!password) return null;

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <div style={{ display: "flex", gap: "3px", marginBottom: "0.3rem" }}>
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
  );
}

// ─── REGISTER PAGE ────────────────────────────────────────────────────────────
export default function RegisterPage({ onNavigate }) {
  const { register } = useAuth();

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    organizationName: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [focused, setFocused] = useState("");

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError("");
  };

  const validate = () => {
    if (!form.username.trim()) return "Username is required.";
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username))
      return "Username must be 3–30 letters, numbers, or underscores.";
    if (!form.organizationName.trim())
      return "Company / workspace name is required.";
    if (form.organizationName.trim().length < 2)
      return "Workspace name must be at least 2 characters.";
    if (!form.email) return "Email address is required.";
    if (form.password.length < 8)
      return "Password must be at least 8 characters.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    const result = await register({
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      organizationName: form.organizationName.trim(),
      email: form.email,
      password: form.password,
    });
    setLoading(false);

    if (result.success) {
      setSuccess("Account created! Check your email to verify your account.");
      setTimeout(() => onNavigate("login"), 3000);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="animate-fade-up delay-0">
      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 style={authTitle}>Create your workspace</h2>
        <p style={authSubtitle}>Start a new workspace — you'll be its owner</p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
      >
        {/* Full name */}
        <div className="animate-fade-up delay-50 input-group">
          <label className="input-label" htmlFor="fullName">
            {focused === "fullName" || form.fullName ? (
              <span style={{ color: "var(--signal)" }}>▸ full name</span>
            ) : (
              "full name"
            )}
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            className="input-field"
            placeholder="Ada Lovelace"
            value={form.fullName}
            onChange={handleChange}
            onFocus={() => setFocused("fullName")}
            onBlur={() => setFocused("")}
            disabled={loading}
          />
        </div>

        {/* Username */}
        <div className="animate-fade-up delay-75 input-group">
          <label className="input-label" htmlFor="username">
            {focused === "username" || form.username ? (
              <span style={{ color: "var(--signal)" }}>▸ username</span>
            ) : (
              "username"
            )}
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            className="input-field"
            placeholder="ada_lovelace"
            value={form.username}
            onChange={handleChange}
            onFocus={() => setFocused("username")}
            onBlur={() => setFocused("")}
            disabled={loading}
          />
        </div>

        {/* Company / workspace name */}
        <div className="animate-fade-up delay-100 input-group">
          <label className="input-label" htmlFor="organizationName">
            {focused === "organizationName" || form.organizationName ? (
              <span style={{ color: "var(--signal)" }}>
                ▸ company / workspace name
              </span>
            ) : (
              "company / workspace name"
            )}
          </label>
          <input
            id="organizationName"
            name="organizationName"
            type="text"
            autoComplete="organization"
            className="input-field"
            placeholder="Acme Inc."
            value={form.organizationName}
            onChange={handleChange}
            onFocus={() => setFocused("organizationName")}
            onBlur={() => setFocused("")}
            disabled={loading}
          />
        </div>

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
            placeholder="ada@projectcamp.io"
            value={form.email}
            onChange={handleChange}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused("")}
            disabled={loading}
          />
        </div>

        {/* Password */}
        <div className="animate-fade-up delay-150 input-group">
          <label className="input-label" htmlFor="password">
            {focused === "password" || form.password ? (
              <span style={{ color: "var(--signal)" }}>▸ password</span>
            ) : (
              "password"
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
          <StrengthBar password={form.password} />
        </div>

        {/* Confirm password */}
        <div className="animate-fade-up delay-200 input-group">
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
              placeholder="repeat password"
              value={form.confirm}
              onChange={handleChange}
              onFocus={() => setFocused("confirm")}
              onBlur={() => setFocused("")}
              disabled={loading}
              style={{ paddingRight: "2.75rem" }}
            />
            {/* Match indicator */}
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

        {/* Error / Success */}
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

        {/* Submit */}
        <div className="animate-fade-up delay-250">
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
                <Spinner size="sm" /> creating account...
              </>
            ) : success ? (
              <>
                <Check size={15} /> account created
              </>
            ) : (
              <>
                create account <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Terms note */}
      <p
        className="animate-fade-up delay-300"
        style={{
          marginTop: "1rem",
          fontSize: "0.72rem",
          color: "var(--text-dim)",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        By creating an account you agree to our{" "}
        <span style={{ color: "var(--text-soft)" }}>terms of service</span>.
      </p>

      {/* Footer */}
      <div className="animate-fade-up delay-400" style={authFoot}>
        Already have an account?{" "}
        <button type="button" onClick={() => onNavigate("login")} className="link" style={authFootLink}>
          Sign in
        </button>
      </div>
    </div>
  );
}
