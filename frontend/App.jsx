import { useState, useEffect } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { useAuth } from "./context/authcontext.jsx";

// ── layouts & pages ───────────────────────────────────────────────────────────
import AuthLayout from "./components/layout/AuthLayout.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage.jsx";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage.jsx";
import AcceptInvitePage from "./pages/auth/AcceptInvitePage.jsx";
import DashboardPage from "./pages/app/DashboardPage.jsx";
import ProjectPage from "./pages/app/ProjectPage.jsx";
import MyTasksPage from "./pages/app/MyTasksPage.jsx";
import OrganizationPage from "./pages/app/OrganizationPage.jsx";

// ── modals ────────────────────────────────────────────────────────────────────
import CreateProjectModal from "./components/ui/CreateProjectModal.jsx";
import CommandPalette from "./components/ui/CommandPalette.jsx";

// ── services ──────────────────────────────────────────────────────────────────
import projectService from "./services/project.service.js";
import { useToast } from "./components/ui/Toast.jsx";

// ─── Boot screen — calm brand mark + indeterminate loader (no idle pulse) ──────
function BootScreen() {
  return (
    <div style={A.boot}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={A.bootInner}
      >
        <div style={A.bootMark}>
          <span style={A.bootMarkInner} />
        </div>
        <span style={A.bootTitle}>
          project<span style={{ color: "var(--signal)" }}>camp</span>
        </span>
        <div style={A.bootBarTrack}>
          <motion.div
            initial={{ x: "-120%" }}
            animate={{ x: "220%" }}
            transition={{ duration: 1, ease: "easeInOut", repeat: Infinity }}
            style={A.bootBarFill}
          />
        </div>
      </motion.div>
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
  if (path.includes("accept-invite")) return "accept-invite";
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
        {page === "accept-invite" && (
          <motion.div key="accept-invite" {...fadeSlide}>
            <AcceptInvitePage token={token} onNavigate={handleNavigate} />
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}

// ─── Authenticated app router ─────────────────────────────────────────────────
function AppRouter() {
  const { user, logout, isOrgManager } = useAuth();
  const { toast } = useToast();
  const [commandOpen, setCommandOpen] = useState(false);

  const getAppPageFromUrl = () => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "projects" && parts[1]) {
      return { page: "project", projectId: parts[1] };
    }
    const valid = ["dashboard", "projects", "tasks", "organization"];
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
    if (created) {
      setProjects((prev) => [created, ...prev]);
      toast(`Project “${created.name}” created`, { kind: "success" });
    }
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
      case "organization":
        return <OrganizationPage />;
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
        onOpenCommand={() => setCommandOpen(true)}
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

      <CommandPalette
        open={commandOpen}
        setOpen={setCommandOpen}
        projects={projects}
        onOpenProject={handleOpenProject}
        onNavigate={handleNavigate}
        onCreateProject={() => setShowCreateProject(true)}
        canCreateProject={isOrgManager}
        isOrgManager={isOrgManager}
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
    // MotionConfig reducedMotion="user" makes every motion.* component in the
    // tree respect prefers-reduced-motion automatically (motion-patterns.md §7).
    // index.css is the single source of truth for tokens.
    <MotionConfig reducedMotion="user">
      <AuthGuard>
        <AppRouter />
      </AuthGuard>
    </MotionConfig>
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
    gap: 18,
  },
  bootMark: {
    width: 34,
    height: 34,
    borderRadius: "var(--r-sm)",
    background: "var(--signal)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bootMarkInner: { width: 15, height: 15, borderRadius: 2, background: "var(--signal-ink)" },
  bootTitle: {
    color: "var(--text)",
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "1rem",
    letterSpacing: "-0.01em",
  },
  bootBarTrack: {
    width: 120,
    height: 2,
    borderRadius: 2,
    background: "var(--border)",
    overflow: "hidden",
  },
  bootBarFill: { height: "100%", width: "45%", background: "var(--signal)", borderRadius: 2 },
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
