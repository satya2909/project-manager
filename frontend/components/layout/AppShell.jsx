import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Menu, X } from "lucide-react";
import ThemeToggle from "../ui/ThemeToggle.jsx";
import { Kbd } from "../ui/primitive.jsx";
import { EASE } from "../../motion/tokens";

// ─── Nav model ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: GridIcon },
  { id: "projects", label: "Projects", icon: FolderIcon },
  { id: "tasks", label: "My Tasks", icon: TaskIcon },
];

// ─── Icons (currentColor — tokenize via parent color) ─────────────────────────
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 4h5l2 2h7v8H1V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function TaskIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 8l1.5 1.5L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="8" height="14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 5h4v10h-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4.5 4h3M4.5 7h3M4.5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 2H2v12h4M11 5l3 3-3 3M6 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CollapseIcon({ collapsed }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d={collapsed ? "M3 7h8M8 4l3 3-3 3" : "M11 7H3M6 4L3 7l3 3"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── AppShell ────────────────────────────────────────────────────────────────
export default function AppShell({
  activePage = "dashboard",
  activeProjectName = null,
  onNavigate,
  onLogout,
  onOpenCommand, // ⌘K — wired in Phase 6; safe no-op until then
  children,
  user,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── responsive: below 768px the sidebar becomes an off-canvas drawer ──
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Org owner/admin see the Organization admin area.
  const isOrgManager = user?.role === "owner" || user?.role === "admin";
  const navItems = isOrgManager
    ? [...NAV_ITEMS, { id: "organization", label: "Organization", icon: BuildingIcon }]
    : NAV_ITEMS;

  const railCollapsed = collapsed && !isMobile;

  // ── sliding nav pill: measure the active item and glide the pill to it ──
  const itemRefs = useRef({});
  const [pill, setPill] = useState({ y: 0, h: 34, visible: false });
  useLayoutEffect(() => {
    const el = itemRefs.current[activePage];
    if (el) setPill({ y: el.offsetTop, h: el.offsetHeight, visible: true });
    else setPill((p) => ({ ...p, visible: false }));
  }, [activePage, railCollapsed, navItems.length, mobileOpen, isMobile]);

  // Two-step logout: first click arms, second fires; auto-disarms after 3s.
  const handleLogoutClick = () => {
    if (logoutConfirm) {
      onLogout?.();
      setLogoutConfirm(false);
    } else {
      setLogoutConfirm(true);
      setTimeout(() => setLogoutConfirm(false), 3000);
    }
  };

  const handleNavigate = (id) => {
    onNavigate?.(id);
    if (isMobile) setMobileOpen(false);
  };

  // Breadcrumb
  const crumbRoot = activeProjectName ? "Projects" : "Workspace";
  const crumbCurrent =
    activeProjectName ||
    navItems.find((n) => n.id === activePage)?.label ||
    activePage.charAt(0).toUpperCase() + activePage.slice(1);

  const roleLabel = user?.role ? user.role.toUpperCase() : "MEMBER";
  const roleColor =
    user?.role === "owner"
      ? "var(--brass)"
      : user?.role === "admin"
        ? "var(--signal)"
        : "var(--text-soft)";

  const sidebarWidth = railCollapsed ? 60 : 232;

  // ── sidebar content (shared between desktop and mobile drawer) ──
  const sidebarInner = (
    <>
      {/* Brand */}
      <div style={S.brand}>
        <div style={S.brandMark}>
          <span style={S.brandMarkInner} />
        </div>
        <AnimatePresence>
          {!railCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
              style={S.brandText}
            >
              project<span style={{ color: "var(--signal)" }}>camp</span>
            </motion.div>
          )}
        </AnimatePresence>
        {isMobile && (
          <button aria-label="Close menu" onClick={() => setMobileOpen(false)} style={S.drawerClose}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <div style={{ marginTop: 22 }}>
        {!railCollapsed && <div style={S.navGroupLabel}>Workspace</div>}
        <nav style={S.nav}>
          {/* sliding pill */}
          {pill.visible && (
            <motion.div
              aria-hidden
              animate={{ y: pill.y, height: pill.h }}
              transition={{ duration: 0.34, ease: EASE }}
              style={S.navPill}
            />
          )}
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => (itemRefs.current[item.id] = el)}
                onClick={() => handleNavigate(item.id)}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                style={{
                  ...S.navItem,
                  justifyContent: railCollapsed ? "center" : "flex-start",
                  color: isActive ? "var(--text)" : "var(--text-dim)",
                }}
              >
                <span
                  style={{
                    ...S.navIcon,
                    color: isActive ? "var(--signal)" : "inherit",
                  }}
                >
                  <item.icon />
                </span>
                {!railCollapsed && <span style={S.navLabel}>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div style={{ flex: 1 }} />

      {/* User + logout */}
      <div style={S.foot}>
        {!railCollapsed && user && (
          <div style={S.userBlock}>
            <div style={S.userAvatar}>
              {(user.fullName || user.username || "U")[0].toUpperCase()}
            </div>
            <div style={S.userInfo}>
              <span style={S.userName}>
                {(user.fullName || user.username || "Operator").slice(0, 18)}
              </span>
              <span style={{ ...S.userRole, color: roleColor }}>{roleLabel}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleLogoutClick}
          onBlur={() => setLogoutConfirm(false)}
          aria-label="Log out"
          style={{
            ...S.navItem,
            justifyContent: railCollapsed ? "center" : "flex-start",
            marginTop: 4,
            ...(logoutConfirm
              ? {
                  background: "var(--danger-soft)",
                  borderColor: "color-mix(in srgb, var(--danger) 30%, transparent)",
                  color: "var(--danger)",
                }
              : {}),
          }}
        >
          <span
            style={{
              ...S.navIcon,
              color: logoutConfirm ? "var(--danger)" : "var(--text-dim)",
            }}
          >
            <LogoutIcon />
          </span>
          {!railCollapsed && (
            <span style={{ ...S.navLabel, color: logoutConfirm ? "var(--danger)" : undefined }}>
              {logoutConfirm ? "Confirm?" : "Logout"}
            </span>
          )}
        </button>
      </div>

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={S.collapseBtn}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      )}
    </>
  );

  return (
    <div style={S.root}>
      {/* ── SIDEBAR ── */}
      {isMobile ? (
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                key="veil"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                onClick={() => setMobileOpen(false)}
                style={S.drawerVeil}
              />
              <motion.aside
                key="drawer"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.3, ease: EASE }}
                style={{ ...S.sidebar, ...S.sidebarDrawer }}
              >
                {sidebarInner}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      ) : (
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, width: sidebarWidth }}
          transition={{ opacity: { duration: 0.4, ease: EASE }, width: { duration: 0.24, ease: EASE } }}
          style={{ ...S.sidebar, width: sidebarWidth }}
        >
          {sidebarInner}
        </motion.aside>
      )}

      {/* ── MAIN ── */}
      <div style={S.main}>
        <motion.header
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
          style={S.topbar}
        >
          <div style={S.topbarLeft}>
            {isMobile && (
              <button aria-label="Open menu" onClick={() => setMobileOpen(true)} style={S.hamburger}>
                <Menu size={18} />
              </button>
            )}
            <span style={S.crumbRoot}>{crumbRoot}</span>
            <span style={S.crumbSep}>/</span>
            <span style={S.crumbCurrent}>{crumbCurrent}</span>
          </div>

          <div style={S.topbarRight}>
            <button
              onClick={() => onOpenCommand?.()}
              style={S.cmdkTrigger}
              aria-label="Open command palette"
            >
              <Search size={14} style={{ color: "var(--text-dim)" }} />
              {!isMobile && <span style={{ flex: 1, textAlign: "left" }}>Jump to…</span>}
              {!isMobile && <Kbd>⌘K</Kbd>}
            </button>
            <ThemeToggle />
          </div>
        </motion.header>

        <main style={S.content}>{children}</main>
      </div>
    </div>
  );
}

// ─── Styles (100% token-driven — no literal colors) ───────────────────────────
const S = {
  root: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    background: "var(--bg)",
    fontFamily: "var(--font-sans)",
    position: "relative",
    overflow: "hidden",
  },

  // Sidebar
  sidebar: {
    background: "linear-gradient(180deg, var(--surface), var(--bg) 60%)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
    padding: "20px 14px 14px",
  },
  sidebarDrawer: {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: 264,
    zIndex: 80,
    boxShadow: "var(--shadow-xl)",
  },
  drawerVeil: {
    position: "fixed",
    inset: 0,
    background: "rgba(6,7,8,.6)",
    backdropFilter: "blur(2px)",
    zIndex: 79,
  },
  drawerClose: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    cursor: "pointer",
    display: "flex",
    padding: 4,
  },

  // Brand
  brand: { display: "flex", alignItems: "center", gap: 10, padding: "0 4px", minHeight: 26 },
  brandMark: {
    width: 26,
    height: 26,
    borderRadius: "var(--r-sm)",
    background: "var(--signal)",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkInner: {
    width: 12,
    height: 12,
    borderRadius: 1,
    background: "var(--signal-ink)",
  },
  brandText: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "1.02rem",
    letterSpacing: "-0.01em",
    color: "var(--text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
  },

  // Nav
  navGroupLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.64rem",
    letterSpacing: "0.1em",
    color: "var(--muted)",
    textTransform: "uppercase",
    padding: "0 10px",
    marginBottom: 6,
  },
  nav: { display: "flex", flexDirection: "column", gap: 2, position: "relative" },
  navPill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    borderRadius: "var(--r-md)",
    background: "var(--panel-hi)",
    border: "1px solid var(--border-hi)",
    zIndex: 0,
    pointerEvents: "none",
  },
  navItem: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    minHeight: 34,
    background: "none",
    border: "1px solid transparent",
    borderRadius: "var(--r-md)",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    fontFamily: "var(--font-sans)",
    fontSize: "0.86rem",
    fontWeight: 500,
    transition: "color 0.2s var(--ease)",
  },
  navIcon: { flexShrink: 0, display: "flex", alignItems: "center", transition: "color 0.2s var(--ease)" },
  navLabel: { whiteSpace: "nowrap" },

  // Foot
  foot: { paddingTop: 14, borderTop: "1px solid var(--border)", marginTop: 8 },
  userBlock: { display: "flex", alignItems: "center", gap: 10, padding: "4px 6px 8px" },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--brass), color-mix(in srgb, var(--brass) 65%, #000))",
    color: "var(--signal-ink)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 600,
    flexShrink: 0,
  },
  userInfo: { display: "flex", flexDirection: "column", overflow: "hidden", gap: 1 },
  userName: {
    color: "var(--text-soft)",
    fontSize: "0.78rem",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: { fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.08em" },

  collapseBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--muted)",
    padding: 4,
    display: "flex",
    borderRadius: "var(--r-sm)",
  },

  // Main
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 },
  topbar: {
    height: 58,
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    flexShrink: 0,
    gap: 16,
  },
  topbarLeft: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  hamburger: {
    background: "none",
    border: "none",
    color: "var(--text-soft)",
    cursor: "pointer",
    display: "flex",
    padding: 4,
    marginRight: 2,
  },
  crumbRoot: { fontSize: "0.86rem", color: "var(--text-dim)" },
  crumbSep: { fontSize: "0.86rem", color: "var(--muted)" },
  crumbCurrent: {
    fontSize: "0.86rem",
    color: "var(--text)",
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  topbarRight: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 },
  cmdkTrigger: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "7px 10px 7px 12px",
    color: "var(--text-dim)",
    fontSize: "0.8rem",
    fontFamily: "var(--font-sans)",
    cursor: "pointer",
    width: 220,
    maxWidth: "42vw",
    transition: "border-color 0.2s var(--ease), background 0.2s var(--ease), color 0.2s var(--ease)",
  },
  content: { flex: 1, overflow: "auto", padding: "28px 32px 64px" },
};
