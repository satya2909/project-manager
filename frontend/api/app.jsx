import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAuth } from "../../backend/src/context/AuthContext";
import { PageLoading } from "./components/ui";

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
        This page will be built in a subsequent phase.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<GuestRoute />}>
          <Route
            path="/login"
            element={<ComingSoon label="login — phase 2" />}
          />
          <Route
            path="/register"
            element={<ComingSoon label="register — phase 2" />}
          />
          <Route
            path="/forgot-password"
            element={<ComingSoon label="forgot-password — phase 2" />}
          />
          <Route
            path="/reset-password/:token"
            element={<ComingSoon label="reset-password — phase 2" />}
          />
          <Route
            path="/verify-email/:token"
            element={<ComingSoon label="verify-email — phase 2" />}
          />
        </Route>
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
