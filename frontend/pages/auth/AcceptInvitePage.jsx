import { useState, useEffect } from "react";
import { Eye, EyeOff, ArrowRight, Mail, Check, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/authcontext";
import inviteService from "../../services/invite.service.js";
import {
  InlineError,
  Spinner,
} from "../../components/ui/primitive.jsx";

// ─── ACCEPT INVITE PAGE ───────────────────────────────────────────────────────
// Reached via the emailed link /accept-invite/:token while logged out.
// Previews the org + role (both locked — the invitee cannot change them), then
// completes registration and logs the new user in.
export default function AcceptInvitePage({ token, onNavigate }) {
  const { acceptInvite } = useAuth();

  const [checking, setChecking] = useState(true);
  const [invite, setInvite] = useState(null); // { email, role, organization }
  const [previewError, setPreviewError] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    password: "",
    confirm: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState("");

  // ── Validate the token on mount ──────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) {
        setPreviewError("This invitation link is missing its token.");
        setChecking(false);
        return;
      }
      try {
        const data = await inviteService.preview(token);
        if (active) setInvite(data?.invite ?? null);
      } catch (err) {
        if (active)
          setPreviewError(
            err?.response?.data?.message ||
              "This invitation is invalid or has expired.",
          );
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError("");
  };

  const validate = () => {
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username))
      return "Username must be 3–30 letters, numbers, or underscores.";
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
    const result = await acceptInvite(token, {
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      password: form.password,
    });
    setLoading(false);
    // On success the AuthProvider sets the user and the app swaps to the shell —
    // no manual navigation needed. On failure, surface the error.
    if (!result.success) setError(result.error);
  };

  // ── Checking token ───────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div
        className="animate-fade-up delay-0"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          padding: "2rem 0",
        }}
      >
        <Spinner size="md" />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
            color: "var(--ghost)",
            letterSpacing: "0.08em",
          }}
        >
          validating invitation...
        </span>
      </div>
    );
  }

  // ── Invalid / expired ────────────────────────────────────────────────────────
  if (previewError) {
    return (
      <div className="animate-fade-up delay-0">
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.6rem",
            fontWeight: 800,
            color: "var(--text-bright)",
            marginBottom: "0.75rem",
          }}
        >
          Invitation unavailable
        </h2>
        <div style={{ marginBottom: "1.25rem" }}>
          <InlineError message={previewError} />
        </div>
        <button
          type="button"
          onClick={() => onNavigate("login")}
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", padding: "0.75rem" }}
        >
          go to sign in <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  // ── Valid invite — show the completion form ──────────────────────────────────
  return (
    <div className="animate-fade-up delay-0">
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
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
          <ShieldCheck size={11} color="var(--ice)" />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.65rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ice)",
            }}
          >
            invitation
          </span>
        </div>

        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.85rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text-bright)",
            marginBottom: "0.5rem",
            lineHeight: 1.15,
          }}
        >
          Join {invite?.organization?.name || "the workspace"}.
        </h2>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.82rem",
            color: "var(--ghost)",
          }}
        >
          You're joining as{" "}
          <span style={{ color: "var(--signal)" }}>
            {(invite?.role || "member").toUpperCase()}
          </span>
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
      >
        {/* Locked email (from the invite) */}
        <div className="input-group">
          <label className="input-label" htmlFor="invite-email">
            email address (locked)
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="invite-email"
              type="email"
              className="input-field"
              value={invite?.email || ""}
              readOnly
              disabled
              style={{ paddingRight: "2.75rem", opacity: 0.75 }}
            />
            <div
              style={{
                position: "absolute",
                right: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Mail size={15} />
            </div>
          </div>
        </div>

        {/* Full name */}
        <div className="input-group">
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
        <div className="input-group">
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

        {/* Password */}
        <div className="input-group">
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
                display: "flex",
                alignItems: "center",
              }}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div className="input-group">
          <label className="input-label" htmlFor="confirm">
            {focused === "confirm" || form.confirm ? (
              <span style={{ color: "var(--signal)" }}>▸ confirm password</span>
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
              <Spinner size="sm" /> joining...
            </>
          ) : (
            <>
              accept & join <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      <div
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
        already have an account?{" "}
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
