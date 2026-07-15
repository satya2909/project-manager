import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Button,
  EmptyState,
  Skeleton,
  SectionLabel,
} from "../../components/ui/primitive.jsx";
import { fadeUp, stagger, EASE } from "../../motion/tokens";
import { useActivity } from "../../hooks/index.js";
import { useAuth } from "../../context/authcontext.jsx";

// ─── helpers ───────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function projStatus(pct) {
  if (pct >= 100)
    return { label: "Complete", color: "var(--signal)", soft: "var(--signal-soft)" };
  if (pct > 0)
    return { label: "In progress", color: "var(--brass)", soft: "var(--brass-soft)" };
  return { label: "Planning", color: "var(--text-dim)", soft: "var(--surface-2)" };
}

function relTime(iso) {
  if (!iso) return "just now";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

// ─── RollingNumber — count-up on mount, respects reduced motion ─────────────────
function RollingNumber({ value, isPct = false, duration = 900 }) {
  const target = parseFloat(value) || 0;
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setN(target);
      return;
    }
    let raf;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(eased * target);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce, duration]);

  const rounded = Math.round(n);
  return <>{isPct ? `${rounded}%` : String(rounded).padStart(2, "0")}</>;
}

// ─── StatCard — cursor-tracked spotlight (opacity-only) ─────────────────────────
function StatCard({ label, value, isPct, delta, deltaUp }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <motion.div ref={ref} variants={fadeUp} onMouseMove={onMove} className="stat">
      <div style={S.statLabel}>{label}</div>
      <div style={S.statValue}>
        <RollingNumber value={value} isPct={isPct} />
      </div>
      <div style={{ ...S.statDelta, color: deltaUp ? "var(--signal)" : "var(--text-dim)" }}>
        {delta}
      </div>
    </motion.div>
  );
}

// ─── ProjectCard ────────────────────────────────────────────────────────────────
function ProjectCard({ project, onClick }) {
  const pct =
    project.taskCount > 0
      ? Math.round((project.doneCount / project.taskCount) * 100)
      : 0;
  const status = projStatus(pct);
  const members = project.members || [];
  const shown = members.slice(0, 3);
  const overflow = members.length - shown.length;

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="pcard"
      onClick={() => onClick(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(project);
        }
      }}
    >
      {/* bottom corner brackets (top two are ::before/::after) */}
      <span className="brk-b" />
      <span className="brk-c" />

      <div style={S.pcardTop}>
        <div style={{ ...S.pcardIcon, background: status.soft, color: status.color }}>
          {initials(project.name)}
        </div>
        <span style={{ ...S.pcardStatus, background: status.soft, color: status.color }}>
          {status.label}
        </span>
      </div>

      <div style={S.pcardName}>{project.name}</div>
      <div style={S.pcardMeta}>{project.description || "No description"}</div>

      <div className="progress-bar" style={{ marginBottom: 10 }}>
        <motion.div
          className="progress-fill"
          style={{ background: pct >= 100 ? "var(--signal)" : "var(--brass)" }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
        />
      </div>

      <div style={S.pcardFoot}>
        <div style={S.stack}>
          {shown.map((m, i) => {
            const nm = m.user?.fullName || m.user?.username || m.fullName || m.username || "U";
            return (
              <span key={i} style={S.miniAvatar} title={nm}>
                {nm[0].toUpperCase()}
              </span>
            );
          })}
          {overflow > 0 && <span style={S.miniAvatar}>+{overflow}</span>}
          {members.length === 0 && <span style={S.metaText}>No members</span>}
        </div>
        <span style={S.metaText}>{project.taskCount} tasks · {relTime(project.updatedAt)}</span>
      </div>
    </motion.div>
  );
}

// ─── ActivityFeed (real data, restyled to the new language) ─────────────────────
const ACTION_CFG = {
  created_task: { verb: "created task", color: "var(--brass)" },
  updated_task: { verb: "updated task", color: "var(--text-dim)" },
  moved_task: { verb: "moved task", color: "var(--signal)" },
  deleted_task: { verb: "deleted task", color: "var(--danger)" },
  created_subtask: { verb: "added subtask", color: "var(--brass)" },
  completed_subtask: { verb: "completed subtask", color: "var(--signal)" },
  uncompleted_subtask: { verb: "unchecked subtask", color: "var(--text-dim)" },
  deleted_subtask: { verb: "deleted subtask", color: "var(--danger)" },
  created_note: { verb: "posted note", color: "var(--text-dim)" },
  updated_note: { verb: "edited note", color: "var(--text-dim)" },
  deleted_note: { verb: "deleted note", color: "var(--danger)" },
  added_member: { verb: "added member", color: "var(--text-soft)" },
  updated_role: { verb: "updated role", color: "var(--brass)" },
  removed_member: { verb: "removed member", color: "var(--danger)" },
};

function ActivityFeed({ projectId }) {
  const { events, loading, error, refetch } = useActivity(projectId, {
    limit: 20,
    poll: true,
  });

  return (
    <motion.div variants={fadeUp} style={S.activityPanel}>
      <div style={S.panelHeader}>
        <span style={S.panelTitle}>Activity</span>
        <span className="notif-dot" />
        <button onClick={refetch} style={S.refreshBtn} title="Refresh" aria-label="Refresh activity">
          ↻
        </button>
      </div>

      <div style={S.activityList} className="scroll-area">
        {loading && (
          <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={12} width={`${80 - i * 8}%`} />
            ))}
          </div>
        )}

        {error && !loading && (
          <div style={S.feedCenter}>
            <span style={S.feedNote}>⚠ Couldn't load activity. Try refresh.</span>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div style={S.feedCenter}>
            <span style={S.feedNote}>No activity yet</span>
          </div>
        )}

        {!loading &&
          !error &&
          events.map((ev, i) => {
            const cfg = ACTION_CFG[ev.action] || { verb: ev.action, color: "var(--text-dim)" };
            const actor = ev.user?.fullName || ev.user?.username || "Someone";
            return (
              <motion.div
                key={ev._id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
                style={S.activityRow}
              >
                <div style={S.actContent}>
                  <span style={S.actUser}>{actor}</span>
                  <span style={{ color: "var(--text-dim)" }}> {cfg.verb} </span>
                  {ev.target && <span style={{ color: cfg.color }}>{ev.target}</span>}
                </div>
                <span style={S.actTime}>{relTime(ev.createdAt)}</span>
              </motion.div>
            );
          })}
      </div>
    </motion.div>
  );
}

// ─── Loading skeleton for the whole dashboard ───────────────────────────────────
function DashboardSkeleton({ showStats }) {
  return (
    <div style={S.page}>
      <div style={S.pageHeader}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton width={280} height={26} />
          <Skeleton width={180} height={12} />
        </div>
      </div>
      {showStats && (
        <div style={S.statsGrid}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="stat">
              <Skeleton width="55%" height={10} />
              <Skeleton width={64} height={30} style={{ marginTop: 10 }} />
              <Skeleton width="45%" height={10} style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>
      )}
      <div style={S.projectsGrid}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="pcard" style={{ cursor: "default" }}>
            <Skeleton width={34} height={34} radius="var(--r-md)" />
            <Skeleton width="70%" height={16} style={{ marginTop: 18 }} />
            <Skeleton width="90%" height={10} style={{ marginTop: 8 }} />
            <Skeleton width="100%" height={3} style={{ marginTop: 22 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DashboardPage ──────────────────────────────────────────────────────────────
export default function DashboardPage({
  activePage = "dashboard",
  projects = [],
  loading,
  onOpenProject,
  onCreateProject,
}) {
  const { user, isOrgManager } = useAuth();
  const canCreateProject = isOrgManager;
  const isProjectsView = activePage === "projects";

  // NOTE: per-project task/done counts are still mocked here (no aggregate task
  // endpoint yet) — unchanged from before; this phase is visual only.
  const displayProjects = projects.map((p, idx) => {
    const mockTasks = [10, 15, 8, 20, 12, 6];
    const mockDone = [6, 15, 2, 10, 8, 1];
    return {
      ...p,
      taskCount: mockTasks[idx % mockTasks.length],
      doneCount: mockDone[idx % mockDone.length],
    };
  });

  const totalProjects = projects.length;
  const uniqueMembers = new Set();
  projects.forEach((p) =>
    p.members?.forEach((m) => {
      const uid = m.user?._id || m.user || m;
      if (uid) uniqueMembers.add(uid.toString());
    }),
  );
  let totalTasks = 0,
    totalDone = 0;
  displayProjects.forEach((p) => {
    totalTasks += p.taskCount;
    totalDone += p.doneCount;
  });
  const avgCompletion = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const createdThisWeek = projects.filter(
    (p) => Date.now() - new Date(p.createdAt).getTime() < 7 * 86400000,
  ).length;

  const stats = [
    { label: "Active projects", value: totalProjects, delta: `${createdThisWeek} created this week`, deltaUp: createdThisWeek > 0 },
    { label: "Open tasks", value: totalTasks - totalDone, delta: `${totalTasks} total assigned` },
    { label: "Team members", value: uniqueMembers.size, delta: "across all projects" },
    { label: "Completion rate", value: avgCompletion, isPct: true, delta: `${totalDone} tasks done`, deltaUp: avgCompletion >= 50 },
  ];

  const firstName = (user?.fullName || user?.username || "there").split(" ")[0];
  const activityProjectId = projects[0]?._id ?? null;

  if (loading) return <DashboardSkeleton showStats={!isProjectsView} />;

  const hasProjects = projects.length > 0;

  return (
    <motion.div style={S.page} variants={stagger(0.06)} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={fadeUp} style={S.pageHeader}>
        <div>
          <h1 style={S.pageTitle}>
            {isProjectsView ? "Projects" : `${greeting()}, ${firstName}`}
          </h1>
          <p style={S.pageSubtitle}>
            {isProjectsView
              ? `${totalProjects} ${totalProjects === 1 ? "project" : "projects"} in your organization`
              : `${totalProjects} active ${totalProjects === 1 ? "project" : "projects"} · ${totalTasks - totalDone} open tasks`}
          </p>
        </div>
        {canCreateProject && (
          <Button variant="primary" onClick={onCreateProject}>
            <PlusIcon /> New project
          </Button>
        )}
      </motion.div>

      {/* Stats — dashboard view only */}
      {!isProjectsView && hasProjects && (
        <motion.div className="dash-stats" style={S.statsGrid} variants={stagger(0.04)}>
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </motion.div>
      )}

      {/* Empty state */}
      {!hasProjects && (
        <motion.div variants={fadeUp} style={{ marginTop: 8 }}>
          {canCreateProject ? (
            <EmptyState
              title="No projects yet"
              description="Create your first project to start tracking tasks, inviting teammates, and shipping work."
              action={
                <Button variant="primary" onClick={onCreateProject}>
                  <PlusIcon /> Create your first project
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No projects assigned to you yet"
              description="Ask an organization admin to add you to a project and it'll show up here."
            />
          )}
        </motion.div>
      )}

      {/* Projects + activity */}
      {hasProjects && (
        <div
          className="dash-main"
          style={{
            ...S.mainGrid,
            gridTemplateColumns: isProjectsView ? "1fr" : "minmax(0,1fr) 300px",
          }}
        >
          <motion.div variants={fadeUp} style={{ minWidth: 0 }}>
            <SectionLabel>{isProjectsView ? "All projects" : "Projects"}</SectionLabel>
            <motion.div
              className="dash-projects"
              style={{
                ...S.projectsGrid,
                gridTemplateColumns: isProjectsView ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
              }}
              variants={stagger(0.05)}
            >
              {displayProjects.map((p) => (
                <ProjectCard key={p._id} project={p} onClick={onOpenProject} />
              ))}
            </motion.div>
          </motion.div>

          {!isProjectsView && activityProjectId && (
            <ActivityFeed projectId={activityProjectId} />
          )}
        </div>
      )}
    </motion.div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

// ─── styles (token-driven) ──────────────────────────────────────────────────────
const S = {
  page: { display: "flex", flexDirection: "column", gap: 30, minHeight: "100%", maxWidth: 1180 },
  pageHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  pageTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "1.7rem",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "var(--text)",
    margin: 0,
  },
  pageSubtitle: { fontSize: "0.86rem", color: "var(--text-dim)", marginTop: 4 },

  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  statLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.66rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
  },
  statValue: {
    fontFamily: "var(--font-display)",
    fontSize: "2.1rem",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "var(--text)",
    marginTop: 6,
    lineHeight: 1,
    position: "relative",
  },
  statDelta: { fontSize: "0.74rem", marginTop: 6, position: "relative" },

  mainGrid: { display: "grid", gap: 20, alignItems: "start" },
  projectsGrid: { display: "grid", gap: 14 },

  pcardTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  pcardIcon: {
    width: 34,
    height: 34,
    borderRadius: "var(--r-md)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    fontWeight: 600,
  },
  pcardStatus: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.62rem",
    padding: "3px 8px",
    borderRadius: 20,
    whiteSpace: "nowrap",
  },
  pcardName: { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem", color: "var(--text)", marginBottom: 4 },
  pcardMeta: {
    fontSize: "0.78rem",
    color: "var(--text-dim)",
    marginBottom: 16,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pcardFoot: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stack: { display: "flex", alignItems: "center" },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    marginLeft: -6,
    border: "2px solid var(--surface)",
    background: "var(--panel-hi)",
    color: "var(--text-soft)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.56rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  metaText: { fontSize: "0.72rem", color: "var(--text-dim)", whiteSpace: "nowrap" },

  // Activity panel
  activityPanel: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "var(--shadow-sm)",
    maxHeight: 460,
  },
  panelHeader: {
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  panelTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "var(--text)",
    flex: 1,
  },
  refreshBtn: {
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    cursor: "pointer",
    fontSize: 13,
    padding: "0 2px",
    lineHeight: 1,
  },
  activityList: { flex: 1, overflowY: "auto", padding: "6px 0" },
  feedCenter: { display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 16px" },
  feedNote: { color: "var(--text-dim)", fontSize: "0.78rem" },
  activityRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    padding: "8px 16px",
  },
  actContent: { fontSize: "0.78rem", lineHeight: 1.5, minWidth: 0 },
  actUser: { color: "var(--text)", fontWeight: 600 },
  actTime: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.62rem",
    color: "var(--text-dim)",
    flexShrink: 0,
    marginTop: 2,
    whiteSpace: "nowrap",
  },
};
