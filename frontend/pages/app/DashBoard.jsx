import { useState } from "react";
import { motion } from "framer-motion";

// ── mock data (swap with real API calls) ──────────────────────────────────────
const MOCK_STATS = [
  { label: "ACTIVE PROJECTS", value: "07", delta: "+2 THIS WEEK" },
  { label: "OPEN TASKS", value: "34", delta: "12 IN PROGRESS" },
  { label: "TEAM MEMBERS", value: "19", delta: "3 ADDED RECENTLY" },
  { label: "COMPLETION RATE", value: "68%", delta: "↑ 4% VS LAST SPRINT" },
];

const MOCK_PROJECTS = [
  {
    _id: "p1",
    name: "MISSION ALPHA",
    description: "Core authentication and user management layer.",
    memberCount: 4,
    taskCount: 12,
    doneCount: 8,
    lastActive: "2H AGO",
    color: "var(--phosphor)",
  },
  {
    _id: "p2",
    name: "GRID FRAMEWORK",
    description: "Reusable component library and design tokens.",
    memberCount: 6,
    taskCount: 21,
    doneCount: 9,
    lastActive: "5H AGO",
    color: "var(--amber)",
  },
  {
    _id: "p3",
    name: "DARK CHANNEL",
    description: "Internal analytics pipeline and dashboards.",
    memberCount: 3,
    taskCount: 8,
    doneCount: 2,
    lastActive: "1D AGO",
    color: "var(--red)",
  },
  {
    _id: "p4",
    name: "PROJECT ECHO",
    description: "Customer-facing API gateway and rate limiter.",
    memberCount: 5,
    taskCount: 15,
    doneCount: 15,
    lastActive: "JUST NOW",
    color: "var(--phosphor)",
  },
  {
    _id: "p5",
    name: "SLATE OPS",
    description: "DevOps automation and deployment pipeline.",
    memberCount: 2,
    taskCount: 6,
    doneCount: 1,
    lastActive: "3D AGO",
    color: "var(--muted)",
  },
  {
    _id: "p6",
    name: "NOVA SYNC",
    description: "Real-time sync engine for offline-first apps.",
    memberCount: 7,
    taskCount: 18,
    doneCount: 6,
    lastActive: "6H AGO",
    color: "var(--amber)",
  },
];

const MOCK_ACTIVITY = [
  {
    id: 1,
    user: "SHAH",
    action: "moved task",
    target: "AUTH-09 → DONE",
    time: "2 MIN AGO",
    type: "done",
  },
  {
    id: 2,
    user: "PRIYA",
    action: "created task",
    target: "RATE LIMITER SPIKE",
    time: "14 MIN AGO",
    type: "create",
  },
  {
    id: 3,
    user: "MARCUS",
    action: "added member",
    target: "jess@corp.io → ECHO",
    time: "1H AGO",
    type: "member",
  },
  {
    id: 4,
    user: "JIN",
    action: "updated subtask",
    target: "DB migration step 3",
    time: "2H AGO",
    type: "update",
  },
  {
    id: 5,
    user: "LEILA",
    action: "posted note",
    target: "SLATE OPS sprint review",
    time: "4H AGO",
    type: "note",
  },
  {
    id: 6,
    user: "CARLOS",
    action: "closed task",
    target: "GRID-14 component audit",
    time: "6H AGO",
    type: "done",
  },
];

const TYPE_COLOR = {
  done: "var(--phosphor)",
  create: "var(--amber)",
  member: "var(--text)",
  update: "var(--phosphor-dim)",
  note: "var(--muted)",
};
const TYPE_SYMBOL = {
  done: "✓",
  create: "+",
  member: "◈",
  update: "↻",
  note: "▤",
};

// ── sub-components ────────────────────────────────────────────────────────────

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
      {/* top accent line */}
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

        {/* progress bar */}
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

        {/* meta row */}
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

function ActivityFeed() {
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
      </div>
      <div style={S.activityList}>
        {MOCK_ACTIVITY.map((ev, i) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.55 + i * 0.05 }}
            style={S.activityRow}
          >
            <span style={{ ...S.actSymbol, color: TYPE_COLOR[ev.type] }}>
              {TYPE_SYMBOL[ev.type]}
            </span>
            <div style={S.actContent}>
              <span style={S.actUser}>{ev.user}</span>
              <span style={S.actAction}> {ev.action} </span>
              <span style={{ ...S.actTarget, color: TYPE_COLOR[ev.type] }}>
                {ev.target}
              </span>
            </div>
            <span style={S.actTime}>{ev.time}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage({ onOpenProject, onCreateProject }) {
  return (
    <div style={S.page}>
      {/* Page title */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={S.pageHeader}
      >
        <div>
          <h1 style={S.pageTitle}>COMMAND CENTER</h1>
          <p style={S.pageSubtitle}>OVERVIEW // ALL ACTIVE OPERATIONS</p>
        </div>
        <button onClick={onCreateProject} style={S.newProjectBtn}>
          + INIT PROJECT
        </button>
      </motion.div>

      {/* Stats row */}
      <div style={S.statsGrid}>
        {MOCK_STATS.map((s, i) => (
          <StatCard key={s.label} stat={s} index={i} />
        ))}
      </div>

      {/* Main 2-col layout */}
      <div style={S.mainGrid}>
        {/* Project cards */}
        <div style={S.projectsSection}>
          <div style={S.sectionHeader}>
            <span style={S.sectionTitle}>ACTIVE PROJECTS</span>
            <span style={S.sectionCount}>{MOCK_PROJECTS.length} TOTAL</span>
          </div>
          <div style={S.projectsGrid}>
            {MOCK_PROJECTS.map((p, i) => (
              <ProjectCard
                key={p._id}
                project={p}
                index={i}
                onClick={onOpenProject}
              />
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <ActivityFeed />
      </div>
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
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
    color: "var(--phosphor)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 2,
    padding: "10px 20px",
    cursor: "pointer",
    transition: "background 0.15s, box-shadow 0.15s",
    flexShrink: 0,
  },

  // Stats
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },
  statCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
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

  // Main 2-col
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 300px",
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
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },

  // Project card
  projCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    transition: "border-color 0.2s, box-shadow 0.2s",
    overflow: "hidden",
  },
  projAccent: {
    height: 2,
    transition: "width 0.3s ease",
  },
  projBody: {
    padding: "14px 16px 16px",
  },
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
    overflow: "hidden",
  },
  progFill: {
    height: "100%",
  },
  progLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--muted)",
    letterSpacing: 1,
    flexShrink: 0,
    width: 30,
    textAlign: "right",
  },
  projMeta: {
    display: "flex",
    gap: 12,
  },
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
  activityList: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 0",
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
  actAction: {
    color: "var(--muted)",
  },
  actTarget: {
    letterSpacing: 0.5,
    wordBreak: "break-word",
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
