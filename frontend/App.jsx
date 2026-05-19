import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { PageLoading } from "./components/ui";

// Auth pages
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";

// ─── ROUTE GUARDS ─────────────────────────────────────────────────────────────
function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoading />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function GuestRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoading />;
  return !isAuthenticated ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

// Placeholder for phases 3 & 4
function ComingSoon({ label }) {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        fontFamily: "var(--font-mono)",
        color: "var(--ghost)",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--signal)",
          boxShadow: "0 0 0 0 var(--signal-glow)",
          animation: "pulse-signal 2s ease infinite",
        }}
      />
      <p
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: "0.75rem", color: "var(--dim)" }}>
        Coming in a subsequent phase.
      </p>
    </div>
  );
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Guest-only */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route
            path="/reset-password/:token"
            element={<ResetPasswordPage />}
          />
        </Route>

        {/* Email verify — accessible always */}
        <Route path="/verify-email/:token" element={<VerifyEmailPage />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={<ComingSoon label="dashboard — phase 3" />}
          />
          <Route
            path="/projects"
            element={<ComingSoon label="projects — phase 3" />}
          />
          <Route
            path="/projects/:projectId"
            element={<ComingSoon label="project detail — phase 4" />}
          />
          <Route
            path="/projects/:projectId/tasks/:taskId"
            element={<ComingSoon label="task detail — phase 4" />}
          />
          <Route
            path="/settings"
            element={<ComingSoon label="settings — phase 4" />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
