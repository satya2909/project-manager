import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ITEMS = [
  { id: "dashboard", label: "DASHBOARD", icon: GridIcon },
  { id: "projects", label: "PROJECTS", icon: FolderIcon },
  { id: "tasks", label: "MY TASKS", icon: TaskIcon },
  { id: "notes", label: "NOTES", icon: NoteIcon },
  { id: "members", label: "TEAM", icon: TeamIcon },
];

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M2 4h14M2 9h14M2 14h14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

export default function AppShell({
  activePage = "dashboard",
  onNavigate,
  children,
  user,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [time, setTime] = useState(new Date());
  const [scanHover, setScanHover] = useState(null);

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

  return (
    <div style={styles.root}>
      {/* Scanline overlay */}
      <div style={styles.scanlines} />

      {/* SIDEBAR */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        style={styles.sidebar}
      >
        {/* Logo / Brand */}
        <div style={styles.brand}>
          <div style={styles.brandLogo}>
            <span style={styles.brandLogoInner}>P</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                style={styles.brandText}
              >
                <span style={styles.brandName}>PROJECT</span>
                <span style={styles.brandSub}>CAMP</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Clock */}
        {!collapsed && (
          <div style={styles.clock}>
            <span style={styles.clockTime}>{timeStr}</span>
            <span style={styles.clockDate}>{dateStr}</span>
          </div>
        )}

        <div style={styles.divider} />

        {/* Nav */}
        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            const isHovered = scanHover === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.id)}
                onMouseEnter={() => setScanHover(item.id)}
                onMouseLeave={() => setScanHover(null)}
                style={{
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                  ...(isHovered && !isActive ? styles.navItemHover : {}),
                  justifyContent: collapsed ? "center" : "flex-start",
                }}
              >
                {/* Active indicator line */}
                {isActive && <div style={styles.activeBar} />}

                {/* Scan sweep on hover */}
                {(isHovered || isActive) && (
                  <motion.div
                    key={item.id + "-sweep"}
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 0.5, ease: "linear" }}
                    style={styles.scanSweep}
                  />
                )}

                <span
                  style={{
                    ...styles.navIcon,
                    color: isActive
                      ? "var(--phosphor)"
                      : isHovered
                        ? "var(--phosphor-dim)"
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
                        ...styles.navLabel,
                        color: isActive
                          ? "var(--phosphor)"
                          : isHovered
                            ? "var(--phosphor-dim)"
                            : "var(--muted)",
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

        <div style={styles.divider} />

        {/* User + logout */}
        <div style={{ padding: "12px 8px" }}>
          {!collapsed && user && (
            <div style={styles.userBlock}>
              <div style={styles.userAvatar}>
                {(user.name || "U")[0].toUpperCase()}
              </div>
              <div style={styles.userInfo}>
                <span style={styles.userName}>{user.name || "OPERATOR"}</span>
                <span style={styles.userRole}>
                  {(user.role || "MEMBER").toUpperCase()}
                </span>
              </div>
            </div>
          )}
          <button
            style={{
              ...styles.navItem,
              justifyContent: collapsed ? "center" : "flex-start",
              marginTop: 4,
            }}
          >
            <span style={styles.navIcon}>
              <LogoutIcon />
            </span>
            {!collapsed && <span style={styles.navLabel}>LOGOUT</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={styles.collapseBtn}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <MenuIcon />
        </button>
      </motion.aside>

      {/* MAIN AREA */}
      <div style={styles.main}>
        {/* Topbar */}
        <header style={styles.topbar}>
          <div style={styles.topbarLeft}>
            <span style={styles.topbarCrumb}>
              SYS://PROJECTCAMP/{activePage.toUpperCase()}
            </span>
            <span style={styles.topbarBlink}>▮</span>
          </div>
          <div style={styles.topbarRight}>
            <div style={styles.statusDot} />
            <span style={styles.statusText}>SYSTEM ONLINE</span>
          </div>
        </header>

        {/* Content */}
        <main style={styles.content}>{children}</main>
      </div>
    </div>
  );
}

const styles = {
  root: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    background: "var(--bg)",
    fontFamily: "var(--font-mono)",
    position: "relative",
    overflow: "hidden",
  },
  scanlines: {
    position: "fixed",
    inset: 0,
    background:
      "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.015) 2px, rgba(0,255,65,0.015) 4px)",
    pointerEvents: "none",
    zIndex: 9999,
  },
  sidebar: {
    background: "var(--surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "20px 16px 16px",
  },
  brandLogo: {
    width: 32,
    height: 32,
    border: "1.5px solid var(--phosphor)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 0 8px rgba(0,255,65,0.3)",
  },
  brandLogoInner: {
    color: "var(--phosphor)",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
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
    fontSize: 13,
    letterSpacing: 3,
    fontWeight: "bold",
  },
  brandSub: {
    color: "var(--muted)",
    fontSize: 9,
    letterSpacing: 4,
    marginTop: 2,
  },
  clock: {
    padding: "0 16px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  clockTime: {
    color: "var(--phosphor)",
    fontSize: 18,
    letterSpacing: 2,
    fontWeight: "bold",
    textShadow: "0 0 10px rgba(0,255,65,0.6)",
  },
  clockDate: {
    color: "var(--muted)",
    fontSize: 9,
    letterSpacing: 2,
  },
  divider: {
    height: "1px",
    background: "var(--border)",
    margin: "0 8px",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    padding: "8px 8px",
    gap: 2,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 10px",
    background: "none",
    border: "none",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
    transition: "background 0.15s",
    width: "100%",
    textAlign: "left",
  },
  navItemActive: {
    background: "rgba(0,255,65,0.06)",
  },
  navItemHover: {
    background: "rgba(0,255,65,0.03)",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: "20%",
    height: "60%",
    width: 2,
    background: "var(--phosphor)",
    boxShadow: "0 0 6px var(--phosphor)",
  },
  scanSweep: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "30%",
    height: "100%",
    background:
      "linear-gradient(90deg, transparent, rgba(0,255,65,0.08), transparent)",
    pointerEvents: "none",
  },
  navIcon: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    transition: "color 0.15s",
  },
  navLabel: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "bold",
    transition: "color 0.15s",
    whiteSpace: "nowrap",
  },
  userBlock: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    marginBottom: 4,
  },
  userAvatar: {
    width: 28,
    height: 28,
    background: "rgba(0,255,65,0.15)",
    border: "1px solid var(--phosphor)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--phosphor)",
    fontSize: 11,
    fontWeight: "bold",
    flexShrink: 0,
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  userName: {
    color: "var(--text)",
    fontSize: 10,
    letterSpacing: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: {
    color: "var(--muted)",
    fontSize: 8,
    letterSpacing: 2,
  },
  collapseBtn: {
    position: "absolute",
    bottom: 12,
    right: 8,
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--muted)",
    padding: 4,
    display: "flex",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
  },
  topbar: {
    height: 48,
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
    gap: 8,
  },
  topbarCrumb: {
    color: "var(--phosphor-dim)",
    fontSize: 10,
    letterSpacing: 2,
  },
  topbarBlink: {
    color: "var(--phosphor)",
    fontSize: 10,
    animation: "blink 1s step-end infinite",
  },
  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--phosphor)",
    boxShadow: "0 0 6px var(--phosphor)",
    animation: "pulse 2s ease-in-out infinite",
  },
  statusText: {
    color: "var(--muted)",
    fontSize: 9,
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "24px",
  },
};
