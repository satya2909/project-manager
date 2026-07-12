import { useState } from "react";
import { motion } from "framer-motion";
import { Spinner } from "../../components/ui/primitive.jsx";
import { useActivity } from "../../hooks/index.js";
import { useAuth } from "../../context/authcontext.jsx";

// ─── Action config ────────────────────────────────────────────────────────────
const ACTION_CFG = {
  created_task: { symbol: "+", color: "var(--amber)", verb: "created task" },
  updated_task: { symbol: "↻", color: "var(--muted)", verb: "updated task" },
  moved_task: { symbol: "→", color: "var(--phosphor)", verb: "moved task" },
  deleted_task: { symbol: "✕", color: "var(--red)", verb: "deleted task" },
  created_subtask: {
    symbol: "+",
    color: "var(--amber)",
    verb: "added subtask",
  },
  completed_subtask: {
    symbol: "✓",
    color: "var(--phosphor)",
    verb: "completed subtask",
  },
  uncompleted_subtask: {
    symbol: "↩",
    color: "var(--muted)",
    verb: "unchecked subtask",
  },
  deleted_subtask: {
    symbol: "✕",
    color: "var(--red)",
    verb: "deleted subtask",
  },
  created_note: { symbol: "▤", color: "var(--muted)", verb: "posted note" },
  updated_note: { symbol: "✎", color: "var(--muted)", verb: "edited note" },
  deleted_note: { symbol: "✕", color: "var(--red)", verb: "deleted note" },
  added_member: { symbol: "◈", color: "var(--text)", verb: "added member" },
  updated_role: { symbol: "◈", color: "var(--amber)", verb: "updated role" },
  removed_member: { symbol: "◈", color: "var(--red)", verb: "removed member" },
};

// ─── relative time ────────────────────────────────────────────────────────────
function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins}M AGO`;
  if (hours < 24) return `${hours}H AGO`;
  return `${days}D AGO`;
}

// ─── metadata label ───────────────────────────────────────────────────────────
function metaLabel(action, metadata) {
  if (action === "moved_task" && metadata?.from && metadata?.to) {
    return `${metadata.from.toUpperCase().replace("_", " ")} → ${metadata.to.toUpperCase().replace("_", " ")}`;
  }
  if (action === "updated_role" && metadata?.from && metadata?.to) {
    return `${metadata.from} → ${metadata.to}`;
  }
  if (action === "added_member" && metadata?.role) {
    return `as ${metadata.role}`;
  }
  return null;
}

// ─── ActivityFeed ─────────────────────────────────────────────────────────────
function ActivityFeed({ projectId }) {
  const { events, loading, error, refetch } = useActivity(projectId, {
    limit: 20,
    poll: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      style={S.activityPanel}
    >
      <div style={S.panelHeader}>
        <span style={S.panelTitle}>ACTIVITY LOG</span>
        <span style={S.panelSub}>LIVE</span>
        <div style={S.liveDot} />
        <button onClick={refetch} style={S.refreshBtn} title="Refresh">
          ↻
        </button>
      </div>

      <div style={S.activityList}>
        {loading && (
          <div style={S.feedCenter}>
            <Spinner size="sm" />
          </div>
        )}

        {error && !loading && (
          <div style={S.feedCenter}>
            <span
              style={{
                color: "var(--muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: 1,
              }}
            >
              ⚠ {error}
            </span>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div style={S.feedCenter}>
            <span
              style={{
                color: "var(--muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: 2,
              }}
            >
              NO ACTIVITY YET
            </span>
          </div>
        )}

        {!loading &&
          events.map((ev, i) => {
            const cfg = ACTION_CFG[ev.action] || {
              symbol: "·",
              color: "var(--muted)",
              verb: ev.action,
            };
            const actor = ev.user?.username || ev.user?.fullName || "UNKNOWN";
            const meta = metaLabel(ev.action, ev.metadata);

            return (
              <motion.div
                key={ev._id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                style={S.activityRow}
              >
                <span style={{ ...S.actSymbol, color: cfg.color }}>
                  {cfg.symbol}
                </span>
                <div style={S.actContent}>
                  <span style={S.actUser}>{actor.toUpperCase()}</span>
                  <span style={S.actAction}> {cfg.verb} </span>
                  {ev.target && (
                    <span style={{ ...S.actTarget, color: cfg.color }}>
                      {ev.target}
                    </span>
                  )}
                  {meta && <span style={S.actMeta}> [{meta}]</span>}
                </div>
                <span style={S.actTime}>{relativeTime(ev.createdAt)}</span>
              </motion.div>
            );
          })}
      </div>
    </motion.div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ stat, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.07,
        ease: [0.4, 0, 0.2, 1],
      }}
      style={S.statCard}
    >
      <span style={S.statLabel}>{stat.label}</span>
      <span style={S.statValue}>{stat.value}</span>
      <span style={S.statDelta}>{stat.delta}</span>
      <div style={S.statRule} />
    </motion.div>
  );
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────
function ProjectCard({ project, index, onClick }) {
  const [hovered, setHovered] = useState(false);
  const pct =
    project.taskCount > 0 ? (project.doneCount / project.taskCount) * 100 : 0;
  const done = pct === 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: 0.28 + index * 0.07,
        ease: [0.4, 0, 0.2, 1],
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(project)}
      style={{
        ...S.projCard,
        borderColor: hovered ? project.color : "var(--border)",
        boxShadow: hovered ? `0 0 18px ${project.color}22` : "none",
        cursor: "pointer",
      }}
    >
      <motion.div
        animate={{ width: hovered ? "100%" : "32px" }}
        transition={{ duration: 0.3 }}
        style={{ ...S.projAccent, background: project.color }}
      />

      <div style={S.projBody}>
        <div style={S.projHeader}>
          <span
            style={{
              ...S.projName,
              color: hovered ? project.color : "var(--text)",
            }}
          >
            {project.name}
          </span>
          <span style={S.projActivity}>{project.lastActive}</span>
        </div>
        <p style={S.projDesc}>{project.description}</p>

        <div style={S.progWrap}>
          <div style={S.progTrack}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, delay: 0.4 + index * 0.07 }}
              style={{
                ...S.progFill,
                background: done ? "var(--phosphor)" : project.color,
                boxShadow: done ? "0 0 6px var(--phosphor)" : "none",
              }}
            />
          </div>
          <span style={S.progLabel}>{Math.round(pct)}%</span>
        </div>

        <div style={S.projMeta}>
          <span style={S.projMetaItem}>◈ {project.memberCount} MEMBERS</span>
          <span style={S.projMetaItem}>▣ {project.taskCount} TASKS</span>
          <span
            style={{
              ...S.projMetaItem,
              color: done ? "var(--phosphor)" : "var(--muted)",
            }}
          >
            {done ? "✓ COMPLETE" : `${project.doneCount} DONE`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────
export default function DashboardPage({
  activePage = "dashboard",
  projects = [],
  loading,
  onOpenProject,
  onCreateProject,
}) {
  const { user } = useAuth();
  const canCreateProject =
    user?.role === "admin" || user?.role === "project_admin";

  const displayProjects = projects.map((p, idx) => {
    const mockTasks = [10, 15, 8, 20, 12, 6];
    const mockDone = [6, 15, 2, 10, 8, 1];
    const taskCount = mockTasks[idx % mockTasks.length];
    const doneCount = mockDone[idx % mockDone.length];

    let lastActive = "JUST NOW";
    if (p.updatedAt) {
      const diffMs = Date.now() - new Date(p.updatedAt).getTime();
      const diffHrs = Math.floor(diffMs / 3_600_000);
      if (diffHrs >= 24) {
        lastActive = `${Math.floor(diffHrs / 24)}D AGO`;
      } else if (diffHrs > 0) {
        lastActive = `${diffHrs}H AGO`;
      } else {
        lastActive = `${Math.max(1, Math.floor(diffMs / 60_000))}M AGO`;
      }
    }

    return {
      ...p,
      taskCount,
      doneCount,
      lastActive,
      color: ["var(--phosphor)", "var(--amber)", "var(--red)", "var(--muted)"][
        idx % 4
      ],
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
  const avgCompletion =
    totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  const dynamicStats = [
    {
      label: "ACTIVE PROJECTS",
      value: String(totalProjects).padStart(2, "0"),
      delta: `${projects.filter((p) => Date.now() - new Date(p.createdAt).getTime() < 7 * 86_400_000).length} CREATED THIS WEEK`,
    },
    {
      label: "OPEN TASKS",
      value: String(totalTasks - totalDone).padStart(2, "0"),
      delta: `${totalTasks} TOTAL ASSIGNED`,
    },
    {
      label: "TEAM MEMBERS",
      value: String(uniqueMembers.size).padStart(2, "0"),
      delta: "ACROSS ALL PROJECTS",
    },
    {
      label: "COMPLETION RATE",
      value: `${avgCompletion}%`,
      delta: `${totalDone} TASKS DONE`,
    },
  ];

  const isProjectsView = activePage === "projects";

  // Use the first project's ID for the activity feed on the dashboard.
  // If in projects view, show the most recently updated project's feed.
  const activityProjectId = projects[0]?._id ?? null;

  if (loading) {
    return (
      <div
        style={{
          ...S.page,
          justifyContent: "center",
          alignItems: "center",
          minHeight: "200px",
        }}
      >
        <Spinner size="lg" />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
            color: "var(--muted)",
            marginTop: "1rem",
          }}
        >
          RETRIEVING BACKEND METRICS...
        </span>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={S.pageHeader}
      >
        <div>
          <h1 style={S.pageTitle}>
            {isProjectsView ? "PROJECT DIRECTORY" : "COMMAND CENTER"}
          </h1>
          <p style={S.pageSubtitle}>
            {isProjectsView
              ? "REGISTRY // ACTIVE WORKSPACES"
              : "OVERVIEW // ALL ACTIVE OPERATIONS"}
          </p>
        </div>
        {canCreateProject && (
          <button onClick={onCreateProject} style={S.newProjectBtn}>
            + INIT PROJECT
          </button>
        )}
      </motion.div>

      {!isProjectsView && (
        <div style={S.statsGrid}>
          {dynamicStats.map((s, i) => (
            <StatCard key={s.label} stat={s} index={i} />
          ))}
        </div>
      )}

      <div
        style={{
          ...S.mainGrid,
          gridTemplateColumns: isProjectsView ? "1fr" : "1fr 300px",
        }}
      >
        <div style={S.projectsSection}>
          <div style={S.sectionHeader}>
            <span style={S.sectionTitle}>
              {isProjectsView ? "ALL REGISTERED PROJECTS" : "ACTIVE PROJECTS"}
            </span>
            <span style={S.sectionCount}>{projects.length} TOTAL</span>
          </div>
          <div
            style={{
              ...S.projectsGrid,
              gridTemplateColumns: isProjectsView
                ? "repeat(3, 1fr)"
                : "repeat(2, 1fr)",
            }}
          >
            {displayProjects.map((p, i) => (
              <ProjectCard
                key={p._id}
                project={p}
                index={i}
                onClick={onOpenProject}
              />
            ))}
          </div>
        </div>

        {/* Real activity feed — hidden in projects view */}
        {!isProjectsView && activityProjectId && (
          <ActivityFeed projectId={activityProjectId} />
        )}

        {!isProjectsView && !activityProjectId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              ...S.activityPanel,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={S.panelHeader}>
              <span style={S.panelTitle}>ACTIVITY LOG</span>
            </div>
            <div style={S.feedCenter}>
              <span
                style={{
                  color: "var(--muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 2,
                }}
              >
                CREATE A PROJECT TO SEE ACTIVITY
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const S = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 28,
    minHeight: "100%",
  },
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  pageTitle: {
    fontFamily: "var(--font-display)",
    fontSize: 26,
    color: "var(--text)",
    letterSpacing: 4,
    margin: 0,
  },
  pageSubtitle: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--muted)",
    letterSpacing: 3,
    marginTop: 6,
  },
  newProjectBtn: {
    background: "rgba(0,255,65,0.08)",
    border: "1px solid var(--phosphor)",
    borderRadius: "var(--r-md)",
    color: "var(--phosphor)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 2,
    padding: "10px 20px",
    cursor: "pointer",
    transition: "background 0.15s, box-shadow 0.15s",
    flexShrink: 0,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },
  statCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    position: "relative",
    overflow: "hidden",
  },
  statLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    color: "var(--muted)",
    letterSpacing: 2,
  },
  statValue: {
    fontFamily: "var(--font-display)",
    fontSize: 32,
    color: "var(--text)",
    letterSpacing: 2,
    lineHeight: 1,
    marginTop: 4,
  },
  statDelta: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    color: "var(--phosphor-dim)",
    letterSpacing: 1,
    marginTop: 4,
  },
  statRule: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 2,
    width: "40%",
    background: "var(--phosphor)",
    opacity: 0.4,
  },

  mainGrid: {
    display: "grid",
    gap: 20,
    flex: 1,
    minHeight: 0,
  },
  projectsSection: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minWidth: 0,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: "var(--text)",
    letterSpacing: 3,
    fontWeight: "bold",
  },
  sectionCount: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--muted)",
    letterSpacing: 2,
  },
  projectsGrid: {
    display: "grid",
    gap: 12,
  },

  projCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    transition: "border-color 0.2s, box-shadow 0.2s",
    overflow: "hidden",
  },
  projAccent: { height: 2, transition: "width 0.3s ease" },
  projBody: { padding: "14px 16px 16px" },
  projHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  projName: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "bold",
    transition: "color 0.2s",
  },
  projActivity: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    color: "var(--muted)",
    letterSpacing: 1,
    flexShrink: 0,
    marginLeft: 8,
  },
  projDesc: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--muted)",
    lineHeight: 1.6,
    marginBottom: 12,
  },
  progWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  progTrack: {
    flex: 1,
    height: 2,
    background: "var(--border)",
    borderRadius: 1,
    overflow: "hidden",
  },
  progFill: { height: "100%", borderRadius: 1 },
  progLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--muted)",
    letterSpacing: 1,
    flexShrink: 0,
    width: 30,
    textAlign: "right",
  },
  projMeta: { display: "flex", gap: 12 },
  projMetaItem: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    color: "var(--muted)",
    letterSpacing: 1,
  },

  // Activity panel
  activityPanel: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
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
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--text)",
    letterSpacing: 3,
    fontWeight: "bold",
    flex: 1,
  },
  panelSub: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    color: "var(--phosphor)",
    letterSpacing: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "var(--phosphor)",
    boxShadow: "0 0 5px var(--phosphor)",
    animation: "pulse 2s ease-in-out infinite",
  },
  refreshBtn: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 12,
    padding: "0 2px",
    fontFamily: "var(--font-mono)",
    transition: "color 0.15s",
  },
  activityList: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 0",
  },
  feedCenter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
  },
  activityRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "8px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.03)",
  },
  actSymbol: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    width: 12,
    flexShrink: 0,
    marginTop: 1,
  },
  actContent: {
    flex: 1,
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    lineHeight: 1.5,
    minWidth: 0,
  },
  actUser: {
    color: "var(--text)",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  actAction: { color: "var(--muted)" },
  actTarget: {
    letterSpacing: 0.5,
    wordBreak: "break-word",
  },
  actMeta: {
    color: "var(--muted)",
    fontSize: 8,
    letterSpacing: 1,
  },
  actTime: {
    fontFamily: "var(--font-mono)",
    fontSize: 7,
    color: "var(--muted)",
    letterSpacing: 1,
    flexShrink: 0,
    marginTop: 2,
    whiteSpace: "nowrap",
  },
};
