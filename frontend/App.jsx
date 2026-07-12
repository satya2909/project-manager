import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./context/authcontext.jsx";

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
import MyTasksPage from "./pages/app/MyTasksPage.jsx";

// ── modals ────────────────────────────────────────────────────────────────────
import CreateProjectModal from "./components/ui/CreateProjectModal.jsx";

// ── services ──────────────────────────────────────────────────────────────────
import projectService from "./services/project.service.js";

// ─── Boot screen ──────────────────────────────────────────────────────────────
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
          <span style={A.bootSub}>INITIALIZING{dots}</span>
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

// ─── URL helpers (no React Router) ────────────────────────────────────────────
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
  if (path.includes("register")) return "register";
  if (path.includes("forgot-password")) return "forgot-password";
  if (path.includes("login")) return "login";
  return null;
}

// ─── Unauthenticated router ───────────────────────────────────────────────────
function AuthRouter() {
  const urlPage = getUrlPage();
  const urlToken = getUrlToken();
  const [page, setPage] = useState(urlPage || "login");
  const [token] = useState(urlToken);

  const handleNavigate = (newPage) => {
    setPage(newPage);
    window.history.pushState({}, "", `/${newPage}`);
  };

  useEffect(() => {
    const handlePop = () => setPage(getUrlPage() || "login");
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  return (
    <AuthLayout>
      <AnimatePresence mode="wait">
        {page === "login" && (
          <motion.div key="login" {...fadeSlide}>
            <LoginPage onNavigate={handleNavigate} />
          </motion.div>
        )}
        {page === "register" && (
          <motion.div key="register" {...fadeSlide}>
            <RegisterPage onNavigate={handleNavigate} />
          </motion.div>
        )}
        {page === "forgot-password" && (
          <motion.div key="forgot" {...fadeSlide}>
            <ForgotPasswordPage onNavigate={handleNavigate} />
          </motion.div>
        )}
        {page === "reset-password" && (
          <motion.div key="reset" {...fadeSlide}>
            <ResetPasswordPage token={token} onNavigate={handleNavigate} />
          </motion.div>
        )}
        {page === "verify-email" && (
          <motion.div key="verify" {...fadeSlide}>
            <VerifyEmailPage token={token} onNavigate={handleNavigate} />
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}

// ─── Authenticated app router ─────────────────────────────────────────────────
function AppRouter() {
  const { user, logout } = useAuth();

  const getAppPageFromUrl = () => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "projects" && parts[1]) {
      return { page: "project", projectId: parts[1] };
    }
    const valid = ["dashboard", "projects", "tasks"];
    if (valid.includes(parts[0])) return { page: parts[0], projectId: null };
    return { page: "dashboard", projectId: null };
  };

  const initialInfo = getAppPageFromUrl();
  const [activePage, setActivePage] = useState(initialInfo.page);
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
        const list = data?.projects ?? [];
        setProjects(list);

        const info = getAppPageFromUrl();
        if (info.page === "project" && info.projectId) {
          const found = list.find((p) => p._id === info.projectId);
          if (found) {
            setActiveProject(found);
          } else {
            try {
              const pd = await projectService.getProject(info.projectId);
              if (pd?.project) {
                setActiveProject(pd.project);
              } else {
                setActivePage("dashboard");
                window.history.replaceState({}, "", "/dashboard");
              }
            } catch {
              setActivePage("dashboard");
              window.history.replaceState({}, "", "/dashboard");
            }
          }
        }
      } catch (e) {
        console.error("Failed to load projects", e);
      } finally {
        setProjectsLoading(false);
      }
    })();
  }, []);

  const updateUrl = (pageId, project = null) => {
    if (pageId === "project" && project) {
      window.history.pushState({}, "", `/projects/${project._id}`);
    } else {
      window.history.pushState({}, "", `/${pageId}`);
    }
  };

  const handleCreateProject = async (payload) => {
    const data = await projectService.createProject(payload);
    const created = data?.project;
    if (created) setProjects((prev) => [created, ...prev]);
    return created;
  };

  const handleOpenProject = (project) => {
    setActiveProject(project);
    setActivePage("project");
    updateUrl("project", project);
  };

  const handleBackToDashboard = () => {
    setActiveProject(null);
    setActivePage("dashboard");
    updateUrl("dashboard");
  };

  const handleNavigate = (pageId) => {
    setActiveProject(null);
    setActivePage(pageId);
    updateUrl(pageId);
  };

  useEffect(() => {
    const handlePop = () => {
      const info = getAppPageFromUrl();
      if (info.page === "project" && info.projectId) {
        const found = projects.find((p) => p._id === info.projectId);
        if (found) {
          setActiveProject(found);
          setActivePage("project");
        }
      } else {
        setActiveProject(null);
        setActivePage(info.page);
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [projects]);

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
            activePage={activePage}
            projects={projects}
            loading={projectsLoading}
            onOpenProject={handleOpenProject}
            onCreateProject={() => setShowCreateProject(true)}
          />
        );
      case "tasks":
        return <MyTasksPage />;
      default:
        return <PlaceholderPage label="404" sub="PAGE NOT FOUND" />;
    }
  };

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────────
          AppShell now receives ALL required props:
            activePage         — highlights the correct nav item
            activeProjectName  — shown in topbar breadcrumb
            onNavigate         — changes page without full reload
            onLogout           — ← was missing; now wired to auth logout()
            user               — for avatar initial and role badge
         ───────────────────────────────────────────────────────────────────── */}
      <AppShell
        activePage={activePage === "project" ? "projects" : activePage}
        activeProjectName={
          activePage === "project" ? activeProject?.name : null
        }
        onNavigate={handleNavigate}
        onLogout={logout} /* ← THE FIX */
        user={user}
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

// ─── Auth guard ───────────────────────────────────────────────────────────────
function AuthGuard({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!isAuthenticated) return <AuthRouter />;
  return children;
}

// ─── Placeholder pages ────────────────────────────────────────────────────────
function PlaceholderPage({ label, sub }) {
  return (
    <div style={A.placeholder}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
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

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    // No inline GLOBAL_CSS block — index.css is the single source of truth now.
    // The vars previously defined inline (--phosphor, --bg, --surface, etc.)
    // are all declared in index.css so every component resolves them correctly.
    <AuthGuard>
      <AppRouter />
    </AuthGuard>
  );
}

// ─── Animation preset ─────────────────────────────────────────────────────────
const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
};

// ─── Styles ───────────────────────────────────────────────────────────────────
// These use CSS variables defined in index.css — no duplication.
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
    width: 62,
    height: 62,
    border: "2px solid var(--phosphor)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--phosphor)",
    fontFamily: "var(--font-display)",
    fontSize: 26,
    boxShadow: "0 0 28px rgba(0,255,65,0.25)",
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
    fontSize: 17,
    letterSpacing: 6,
  },
  bootSub: {
    color: "var(--ghost)",
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
    fontSize: 30,
    letterSpacing: 6,
    color: "var(--text)",
  },
  placeholderSub: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 3,
    color: "var(--ghost)",
  },
  placeholderRule: {
    width: 60,
    height: 1,
    background: "var(--phosphor)",
    opacity: 0.35,
    marginTop: 8,
  },
};
