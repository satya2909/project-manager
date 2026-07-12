import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ITEMS = [
  { id: "dashboard", label: "DASHBOARD", icon: GridIcon },
  { id: "projects", label: "PROJECTS", icon: FolderIcon },
  { id: "tasks", label: "MY TASKS", icon: TaskIcon },
  { id: "notes", label: "NOTES", icon: NoteIcon },
  { id: "members", label: "TEAM", icon: TeamIcon },
];

// ─── Icons ────────────────────────────────────────────────────────────────────
function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect
        x="1"
        y="1"
        width="6"
        height="6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9"
        y="1"
        width="6"
        height="6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="1"
        y="9"
        width="6"
        height="6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9"
        y="9"
        width="6"
        height="6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path
        d="M1 4h5l2 2h7v8H1V4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function TaskIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4 5h8M4 8h8M4 11h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}
function NoteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect
        x="2"
        y="1"
        width="12"
        height="14"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 5h6M5 8h6M5 11h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}
function TeamIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M1 14c0-3 2-5 5-5s5 2 5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 10c2 0 3 1.5 3 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path
        d="M6 2H2v12h4M11 5l3 3-3 3M6 8h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
function CollapseIcon({ collapsed }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d={collapsed ? "M3 7h8M8 4l3 3-3 3" : "M11 7H3M6 4L3 7l3 3"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

// ─── Ambient signal bars (sidebar signature element) ──────────────────────────
// Five thin bars that pulse independently — ambient data atmosphere.
// Heights and delays are staggered so they feel organic, not mechanical.
function SignalBars() {
  const bars = [
    { delay: "0s", dur: "2.1s" },
    { delay: "0.4s", dur: "1.8s" },
    { delay: "0.7s", dur: "2.4s" },
    { delay: "1.1s", dur: "1.9s" },
    { delay: "0.2s", dur: "2.6s" },
  ];
  return (
    <div style={S.signalBars}>
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            ...S.signalBar,
            animationDelay: b.delay,
            animationDuration: b.dur,
          }}
        />
      ))}
    </div>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────
export default function AppShell({
  activePage = "dashboard",
  activeProjectName = null, // shown in topbar when inside a project
  onNavigate,
  onLogout, // ← was missing, now wired
  children,
  user,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [time, setTime] = useState(new Date());
  const [scanHover, setScanHover] = useState(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toTimeString().slice(0, 8);
  const dateStr = time
    .toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    })
    .toUpperCase();

  // Two-step logout: first click arms the button, second click fires.
  const handleLogoutClick = () => {
    if (logoutConfirm) {
      onLogout?.();
      setLogoutConfirm(false);
    } else {
      setLogoutConfirm(true);
      // Auto-disarm after 3 seconds if user doesn't confirm
      setTimeout(() => setLogoutConfirm(false), 3000);
    }
  };

  // Derive breadcrumb path for topbar
  const crumbPage = activeProjectName
    ? `PROJECTS/${activeProjectName.toUpperCase()}`
    : activePage.toUpperCase();

  // Role display
  const roleLabel = user?.role
    ? user.role.replace("_", " ").toUpperCase()
    : "MEMBER";
  const roleColor =
    user?.role === "admin"
      ? "var(--ice)"
      : user?.role === "project_admin"
        ? "var(--amber)"
        : "var(--phosphor)";

  return (
    <div style={S.root}>
      {/* SIDEBAR */}
      <motion.aside
        animate={{ width: collapsed ? 56 : 216 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        style={S.sidebar}
      >
        {/* Ambient signal bars — signature element */}
        <SignalBars />

        {/* Logo / Brand */}
        <div style={S.brand}>
          <div style={S.brandLogo}>
            <span style={S.brandLogoInner}>P</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                style={S.brandText}
              >
                <span style={S.brandName}>PROJECT</span>
                <span style={S.brandSub}>CAMP</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Clock — only when expanded */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={S.clock}
            >
              <span style={S.clockTime}>{timeStr}</span>
              <span style={S.clockDate}>{dateStr}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={S.divider} />

        {/* Navigation */}
        <nav style={S.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            const isHovered = scanHover === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.id)}
                onMouseEnter={() => setScanHover(item.id)}
                onMouseLeave={() => setScanHover(null)}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                style={{
                  ...S.navItem,
                  ...(isActive ? S.navItemActive : {}),
                  ...(isHovered && !isActive ? S.navItemHover : {}),
                  justifyContent: collapsed ? "center" : "flex-start",
                  paddingLeft: collapsed ? 0 : undefined,
                }}
              >
                {isActive && <div style={S.activeBar} />}

                {(isHovered || isActive) && (
                  <motion.div
                    key={item.id + "-sweep"}
                    initial={{ x: "-100%" }}
                    animate={{ x: "200%" }}
                    transition={{ duration: 0.55, ease: "linear" }}
                    style={S.scanSweep}
                  />
                )}

                <span
                  style={{
                    ...S.navIcon,
                    color: isActive
                      ? "var(--phosphor)"
                      : isHovered
                        ? "var(--text-soft)"
                        : "var(--muted)",
                  }}
                >
                  <item.icon />
                </span>

                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{
                        ...S.navLabel,
                        color: isActive
                          ? "var(--phosphor)"
                          : isHovered
                            ? "var(--text-soft)"
                            : "var(--ghost)",
                      }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />
        <div style={S.divider} />

        {/* User block + Logout */}
        <div style={{ padding: "10px 8px 8px" }}>
          {!collapsed && user && (
            <div style={S.userBlock}>
              <div style={S.userAvatar}>
                {(user.fullName || user.username || "U")[0].toUpperCase()}
              </div>
              <div style={S.userInfo}>
                <span style={S.userName}>
                  {(user.fullName || user.username || "OPERATOR")
                    .toUpperCase()
                    .slice(0, 14)}
                </span>
                <span style={{ ...S.userRole, color: roleColor }}>
                  {roleLabel}
                </span>
              </div>
            </div>
          )}

          {/* LOGOUT — wired to onLogout prop with two-step confirm */}
          <button
            onClick={handleLogoutClick}
            onBlur={() => setLogoutConfirm(false)}
            aria-label="Log out"
            style={{
              ...S.navItem,
              justifyContent: collapsed ? "center" : "flex-start",
              marginTop: 4,
              width: "100%",
              ...(logoutConfirm
                ? {
                    background: "rgba(255,60,60,0.08)",
                    borderColor: "rgba(255,60,60,0.25)",
                    color: "var(--red)",
                  }
                : {}),
            }}
          >
            <span
              style={{
                ...S.navIcon,
                color: logoutConfirm ? "var(--red)" : "var(--ghost)",
              }}
            >
              <LogoutIcon />
            </span>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    ...S.navLabel,
                    color: logoutConfirm ? "var(--red)" : "var(--ghost)",
                  }}
                >
                  {logoutConfirm ? "CONFIRM?" : "LOGOUT"}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={S.collapseBtn}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </motion.aside>

      {/* MAIN AREA */}
      <div style={S.main}>
        {/* Topbar */}
        <header style={S.topbar}>
          <div style={S.topbarLeft}>
            <span style={S.topbarCrumb}>PROJECTCAMP/</span>
            <span style={S.topbarCrumbPage}>{crumbPage}</span>
            <span style={S.topbarBlink}>▮</span>
          </div>
          <div style={S.topbarRight}>
            <div style={S.statusDot} />
            <span style={S.statusText}>SYSTEM ONLINE</span>
          </div>
        </header>

        {/* Page content */}
        <main style={S.content}>{children}</main>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    background: "var(--bg)",
    fontFamily: "var(--font-mono)",
    position: "relative",
    overflow: "hidden",
  },

  // Sidebar
  sidebar: {
    background: "var(--surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
  },

  // Ambient signal bars
  signalBars: {
    position: "absolute",
    bottom: 80,
    right: 8,
    display: "flex",
    alignItems: "flex-end",
    gap: 2,
    height: 28,
    opacity: 0.35,
    pointerEvents: "none",
  },
  signalBar: {
    width: 2,
    background: "var(--phosphor)",
    borderRadius: 1,
    animation: "signal-bar 2s ease-in-out infinite",
    boxShadow: "0 0 4px var(--phosphor)",
  },

  // Brand
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "18px 14px 14px",
  },
  brandLogo: {
    width: 30,
    height: 30,
    border: "1.5px solid var(--phosphor)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 0 8px rgba(0,255,65,0.25)",
  },
  brandLogoInner: {
    color: "var(--phosphor)",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 1,
    fontFamily: "var(--font-display)",
  },
  brandText: {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1,
    overflow: "hidden",
    whiteSpace: "nowrap",
  },
  brandName: {
    color: "var(--phosphor)",
    fontFamily: "var(--font-display)",
    fontSize: 12,
    letterSpacing: 4,
  },
  brandSub: {
    color: "var(--ghost)",
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: 5,
    marginTop: 3,
  },

  // Clock
  clock: {
    padding: "0 14px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  clockTime: {
    color: "var(--phosphor)",
    fontFamily: "var(--font-display)",
    fontSize: 17,
    letterSpacing: 2,
    textShadow: "0 0 10px rgba(0,255,65,0.5)",
  },
  clockDate: {
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
  },

  divider: { height: 1, background: "var(--border)", margin: "0 8px" },

  // Nav
  nav: {
    display: "flex",
    flexDirection: "column",
    padding: "8px",
    gap: 2,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "8px 10px",
    background: "none",
    border: "1px solid transparent",
    borderRadius: "var(--r-md)",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
    transition: "background 0.15s, border-color 0.15s",
    width: "100%",
    textAlign: "left",
  },
  navItemActive: {
    background: "rgba(0,255,65,0.05)",
    borderColor: "rgba(0,255,65,0.1)",
  },
  navItemHover: {
    background: "rgba(0,255,65,0.025)",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: "20%",
    height: "60%",
    width: 2,
    background: "var(--phosphor)",
    boxShadow: "0 0 6px var(--phosphor)",
    borderRadius: "0 1px 1px 0",
  },
  scanSweep: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "30%",
    height: "100%",
    background:
      "linear-gradient(90deg, transparent, rgba(0,255,65,0.07), transparent)",
    pointerEvents: "none",
  },
  navIcon: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    transition: "color 0.15s",
    width: 15,
  },
  navLabel: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "bold",
    fontFamily: "var(--font-mono)",
    transition: "color 0.15s",
    whiteSpace: "nowrap",
  },

  // User block
  userBlock: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px 8px",
  },
  userAvatar: {
    width: 26,
    height: 26,
    background: "rgba(0,255,65,0.1)",
    border: "1px solid rgba(0,255,65,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--phosphor)",
    fontSize: 11,
    fontWeight: "bold",
    flexShrink: 0,
    fontFamily: "var(--font-mono)",
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    gap: 2,
  },
  userName: {
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: 2,
  },

  // Collapse toggle
  collapseBtn: {
    position: "absolute",
    bottom: 10,
    right: 8,
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--dim)",
    padding: 4,
    display: "flex",
    transition: "color 0.15s",
    borderRadius: "var(--r-sm)",
  },

  // Main
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
  },
  topbar: {
    height: 46,
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    background: "var(--surface)",
    flexShrink: 0,
  },
  topbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 0,
  },
  topbarCrumb: {
    color: "var(--ghost)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 1,
  },
  topbarCrumbPage: {
    color: "var(--phosphor-dim)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 1,
  },
  topbarBlink: {
    color: "var(--phosphor)",
    fontSize: 10,
    animation: "blink 1s step-end infinite",
    marginLeft: 4,
  },
  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "var(--phosphor)",
    boxShadow: "0 0 6px var(--phosphor)",
    animation: "pulse-signal 2s ease-in-out infinite",
  },
  statusText: {
    color: "var(--ghost)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "24px",
  },
};
