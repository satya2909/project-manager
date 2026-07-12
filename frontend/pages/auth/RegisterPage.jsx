import { useState } from "react";
import { Eye, EyeOff, ArrowRight, UserPlus, Check } from "lucide-react";
import { useAuth } from "../../context/authcontext";
import { InlineError, InlineSuccess, Spinner } from "../../components/ui/primitive.jsx";

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
    username: "",
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
    if (!form.username.trim()) return "Full name is required.";
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
      username: form.username,
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
      <div style={{ marginBottom: "2.25rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "var(--ice-dim)",
            border: "1px solid rgba(77,184,255,0.2)",
            borderRadius: "var(--r-sm)",
            padding: "0.25rem 0.65rem",
            marginBottom: "1.25rem",
          }}
        >
          <UserPlus size={11} color="var(--ice)" />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.65rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ice)",
            }}
          >
            new account
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
          Join the mission.
        </h2>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.82rem",
            color: "var(--ghost)",
          }}
        >
          Create your workspace account
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
      >
        {/* Full name */}
        <div className="animate-fade-up delay-50 input-group">
          <label className="input-label" htmlFor="username">
            {focused === "username" || form.username ? (
              <span style={{ color: "var(--signal)" }}>▸ full name</span>
            ) : (
              "full name"
            )}
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="name"
            className="input-field"
            placeholder="Ada Lovelace"
            value={form.username}
            onChange={handleChange}
            onFocus={() => setFocused("username")}
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
          fontFamily: "var(--font-mono)",
          fontSize: "0.7rem",
          color: "var(--dim)",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        By creating an account you agree to our{" "}
        <span style={{ color: "var(--ghost)" }}>terms of service</span>.
      </p>

      {/* Footer */}
      <div
        className="animate-fade-up delay-400"
        style={{
          marginTop: "1.5rem",
          paddingTop: "1.5rem",
          borderTop: "1px solid var(--edge)",
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: "0.8rem",
          color: "var(--ghost)",
        }}
      >
        already have access?{" "}
        <button
          type="button"
          onClick={() => onNavigate("login")}
          className="link"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
            padding: 0,
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
          }}
        >
          sign in →
        </button>
      </div>
    </div>
  );
}
