import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./context/AuthContext.jsx";

// ── layouts & pages ───────────────────────────────────────────────────────────
import AuthLayout from "./components/layout/AuthLayout.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage.jsx";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage.jsx";
import DashboardPage from "./pages/app/DashboardPage.jsx";
import ProjectPage from "./pages/app/ProjectPage.jsx";

// ── modals ────────────────────────────────────────────────────────────────────
import CreateProjectModal from "./components/ui/CreateProjectModal.jsx";

// ── services ──────────────────────────────────────────────────────────────────
import projectService from "./services/project.service.js";

// ── boot screen ───────────────────────────────────────────────────────────────
function BootScreen() {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const t = setInterval(
      () => setDots((d) => (d.length >= 3 ? "" : d + ".")),
      400,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div style={A.boot}>
      <div style={A.bootInner}>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={A.bootLogo}
        >
          P
        </motion.div>
        <div style={A.bootLines}>
          <span style={A.bootTitle}>PROJECT CAMP</span>
          <span style={A.bootSub}>INITIALIZING SYSTEM{dots}</span>
        </div>
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={A.bootBar}
        />
      </div>
    </div>
  );
}

// ── url token parser ──────────────────────────────────────────────────────────
// Reads ?token=xxx or /verify-email/TOKEN style URLs without a router
function getUrlToken() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("token")) return params.get("token");
  const parts = window.location.pathname.split("/");
  return parts[parts.length - 1] || null;
}

function getUrlPage() {
  const path = window.location.pathname;
  if (path.includes("verify-email")) return "verify-email";
  if (path.includes("reset-password")) return "reset-password";
  return null;
}

// ── unauthenticated router ────────────────────────────────────────────────────
function AuthRouter() {
  const urlPage = getUrlPage();
  const urlToken = getUrlToken();

  // If user lands on a token URL, show the right page immediately
  const [page, setPage] = useState(urlPage || "login");
  const [token] = useState(urlToken);

  return (
    <AuthLayout>
      <AnimatePresence mode="wait">
        {page === "login" && (
          <motion.div key="login" {...fadeSlide}>
            <LoginPage onNavigate={setPage} />
          </motion.div>
        )}

        {page === "register" && (
          <motion.div key="register" {...fadeSlide}>
            <RegisterPage onNavigate={setPage} />
          </motion.div>
        )}

        {page === "forgot-password" && (
          <motion.div key="forgot" {...fadeSlide}>
            <ForgotPasswordPage onNavigate={setPage} />
          </motion.div>
        )}

        {page === "reset-password" && (
          <motion.div key="reset" {...fadeSlide}>
            <ResetPasswordPage token={token} onNavigate={setPage} />
          </motion.div>
        )}

        {page === "verify-email" && (
          <motion.div key="verify" {...fadeSlide}>
            <VerifyEmailPage token={token} onNavigate={setPage} />
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}

// ── authenticated app ─────────────────────────────────────────────────────────
function AppRouter() {
  const { user, logout } = useAuth();

  const [activePage, setActivePage] = useState("dashboard");
  const [activeProject, setActiveProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  // Load projects on mount
  useEffect(() => {
    (async () => {
      setProjectsLoading(true);
      try {
        const data = await projectService.listProjects();
        setProjects(data || []);
      } catch (e) {
        console.error("Failed to load projects", e);
      } finally {
        setProjectsLoading(false);
      }
    })();
  }, []);

  const handleCreateProject = async (payload) => {
    const created = await projectService.createProject(payload);
    setProjects((p) => [created, ...p]);
    return created;
  };

  const handleOpenProject = (project) => {
    setActiveProject(project);
    setActivePage("project");
  };

  const handleBackToDashboard = () => {
    setActiveProject(null);
    setActivePage("dashboard");
  };

  const handleNavigate = (pageId) => {
    if (pageId === "dashboard") setActiveProject(null);
    setActivePage(pageId);
  };

  const renderPage = () => {
    if (activePage === "project" && activeProject) {
      return (
        <ProjectPage project={activeProject} onBack={handleBackToDashboard} />
      );
    }

    switch (activePage) {
      case "dashboard":
      case "projects":
        return (
          <DashboardPage
            projects={projects}
            loading={projectsLoading}
            onOpenProject={handleOpenProject}
            onCreateProject={() => setShowCreateProject(true)}
          />
        );
      case "tasks":
        return (
          <PlaceholderPage
            label="MY TASKS"
            sub="PERSONAL TASK VIEW — COMING SOON"
          />
        );
      case "notes":
        return (
          <PlaceholderPage
            label="NOTES"
            sub="GLOBAL NOTES VIEW — COMING SOON"
          />
        );
      case "members":
        return (
          <PlaceholderPage label="TEAM" sub="ORGANISATION VIEW — COMING SOON" />
        );
      default:
        return <PlaceholderPage label="404" sub="PAGE NOT FOUND" />;
    }
  };

  return (
    <>
      <AppShell
        activePage={activePage === "project" ? "projects" : activePage}
        onNavigate={handleNavigate}
        user={user}
        onLogout={logout}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage + (activeProject?._id || "")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ height: "100%" }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </AppShell>

      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onSubmit={handleCreateProject}
      />
    </>
  );
}

// ── auth guard ────────────────────────────────────────────────────────────────
function AuthGuard({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!isAuthenticated) return <AuthRouter />;
  return children;
}

// ── placeholder ───────────────────────────────────────────────────────────────
function PlaceholderPage({ label, sub }) {
  return (
    <div style={A.placeholder}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        style={A.placeholderInner}
      >
        <span style={A.placeholderLabel}>{label}</span>
        <span style={A.placeholderSub}>{sub}</span>
        <div style={A.placeholderRule} />
      </motion.div>
    </div>
  );
}

// ── root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <AuthGuard>
        <AppRouter />
      </AuthGuard>
    </>
  );
}

// ── animation preset ──────────────────────────────────────────────────────────
const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
};

// ── global CSS ────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --phosphor:       #00ff41;
    --phosphor-dim:   #00cc33;
    --amber:          #ffaa00;
    --red:            #ff3c3c;
    --bg:             #0a0c0a;
    --surface:        #0f120f;
    --surface-raised: #141814;
    --border:         #1e241e;
    --text:           #d4e8d4;
    --muted:          #4a5c4a;
    --font-mono:      'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
    --font-display:   'Share Tech Mono', 'JetBrains Mono', monospace;
  }

  html, body, #root {
    height: 100%; width: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-mono);
    overflow: hidden;
  }

  ::-webkit-scrollbar        { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track  { background: var(--bg); }
  ::-webkit-scrollbar-thumb  { background: var(--border); }
  ::-webkit-scrollbar-thumb:hover { background: var(--muted); }

  @keyframes blink   { 0%,100%{opacity:1}50%{opacity:0} }
  @keyframes pulse   { 0%,100%{opacity:1}50%{opacity:0.4} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes shimmer { 0%{transform:translateX(-100%)}100%{transform:translateX(200%)} }

  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Share+Tech+Mono&display=swap');

  button { font-family: var(--font-mono); }
`;

// ── styles ────────────────────────────────────────────────────────────────────
const A = {
  boot: {
    height: "100vh",
    width: "100vw",
    background: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bootInner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
  },
  bootLogo: {
    width: 64,
    height: 64,
    border: "2px solid var(--phosphor)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--phosphor)",
    fontFamily: "var(--font-display)",
    fontSize: 28,
    fontWeight: "bold",
    boxShadow: "0 0 30px rgba(0,255,65,0.3)",
  },
  bootLines: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  bootTitle: {
    color: "var(--text)",
    fontFamily: "var(--font-display)",
    fontSize: 18,
    letterSpacing: 6,
  },
  bootSub: {
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 3,
  },
  bootBar: {
    width: 200,
    height: 1,
    background:
      "linear-gradient(90deg, transparent, var(--phosphor), transparent)",
    transformOrigin: "left",
    boxShadow: "0 0 8px var(--phosphor)",
  },
  placeholder: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderInner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  placeholderLabel: {
    fontFamily: "var(--font-display)",
    fontSize: 32,
    letterSpacing: 6,
    color: "var(--text)",
  },
  placeholderSub: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 3,
    color: "var(--muted)",
  },
  placeholderRule: {
    width: 60,
    height: 1,
    background: "var(--phosphor)",
    opacity: 0.4,
    marginTop: 8,
  },
};
