import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import KanbanBoard from "../../components/ui/KanbanBoard";
import CreateTaskModal from "../../components/ui/CreateTaskModal";

// ── mock data (replace with real API calls) ───────────────────────────────────
const MOCK_MEMBERS = [
  {
    _id: "u1",
    name: "Shah Karim",
    email: "shah@corp.io",
    role: "admin",
    joined: "2024-01-10",
  },
  {
    _id: "u2",
    name: "Priya Nair",
    email: "priya@corp.io",
    role: "project_admin",
    joined: "2024-02-03",
  },
  {
    _id: "u3",
    name: "Marcus Webb",
    email: "marcus@corp.io",
    role: "member",
    joined: "2024-03-18",
  },
  {
    _id: "u4",
    name: "Jin Park",
    email: "jin@corp.io",
    role: "member",
    joined: "2024-04-01",
  },
  {
    _id: "u5",
    name: "Leila Osei",
    email: "leila@corp.io",
    role: "member",
    joined: "2024-04-22",
  },
];

const MOCK_TASKS = [
  {
    _id: "t001",
    title: "Set up JWT middleware",
    description:
      "Implement access + refresh token flow with secure httpOnly cookies.",
    status: "done",
    priority: "high",
    assignee: MOCK_MEMBERS[0],
    subTasks: [{ isCompleted: true }, { isCompleted: true }],
    attachments: [],
  },
  {
    _id: "t002",
    title: "Design user schema",
    description: "MongoDB schema with role enum, email verification fields.",
    status: "done",
    priority: "high",
    assignee: MOCK_MEMBERS[1],
    subTasks: [{ isCompleted: true }],
    attachments: [],
  },
  {
    _id: "t003",
    title: "Build project CRUD routes",
    description: "GET, POST, PUT, DELETE endpoints with role-based guards.",
    status: "in_progress",
    priority: "high",
    assignee: MOCK_MEMBERS[0],
    subTasks: [
      { isCompleted: true },
      { isCompleted: false },
      { isCompleted: false },
    ],
    attachments: [1],
  },
  {
    _id: "t004",
    title: "Task management endpoints",
    description: "Task + subtask CRUD, file attachment support via Multer.",
    status: "in_progress",
    priority: "medium",
    assignee: MOCK_MEMBERS[1],
    subTasks: [],
    attachments: [],
  },
  {
    _id: "t005",
    title: "Email verification flow",
    description: "Send verification token on register, resend endpoint.",
    status: "in_progress",
    priority: "medium",
    assignee: MOCK_MEMBERS[2],
    subTasks: [{ isCompleted: false }],
    attachments: [],
  },
  {
    _id: "t006",
    title: "Password reset endpoint",
    description: "Forgot password + reset token with expiry.",
    status: "todo",
    priority: "medium",
    assignee: MOCK_MEMBERS[3],
    subTasks: [],
    attachments: [],
  },
  {
    _id: "t007",
    title: "API rate limiting",
    description: "Express-rate-limit middleware on auth routes.",
    status: "todo",
    priority: "low",
    assignee: MOCK_MEMBERS[4],
    subTasks: [],
    attachments: [],
  },
  {
    _id: "t008",
    title: "Health check endpoint",
    description: "GET /api/v1/healthcheck with DB ping status.",
    status: "todo",
    priority: "low",
    assignee: null,
    subTasks: [],
    attachments: [],
  },
];

const MOCK_NOTES = [
  {
    _id: "n1",
    title: "Sprint 1 Kickoff",
    content:
      "Auth + user model is the critical path. JWT middleware must land before any protected routes can be tested downstream. Target: end of week 1.",
    author: MOCK_MEMBERS[0],
    createdAt: "2024-05-01",
  },
  {
    _id: "n2",
    title: "Architecture Decisions",
    content:
      "Chose refresh token rotation pattern over long-lived tokens. Tokens stored httpOnly. Access token 15min TTL, refresh 7d TTL stored in DB for revocation.",
    author: MOCK_MEMBERS[0],
    createdAt: "2024-05-03",
  },
  {
    _id: "n3",
    title: "File Upload Notes",
    content:
      "Multer configured for disk storage under /public/images. Max 5MB per file. MIME whitelist: image/*, application/pdf. Multiple files per task supported.",
    author: MOCK_MEMBERS[1],
    createdAt: "2024-05-06",
  },
];

// ── role badge ────────────────────────────────────────────────────────────────
const ROLE_CFG = {
  admin: { label: "ADMIN", color: "var(--phosphor)" },
  project_admin: { label: "PROJ ADMIN", color: "var(--amber)" },
  member: { label: "MEMBER", color: "var(--muted)" },
};

function RoleBadge({ role }) {
  const cfg = ROLE_CFG[role] || ROLE_CFG.member;
  return (
    <span style={{ ...PS.roleBadge, color: cfg.color, borderColor: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ── members tab ───────────────────────────────────────────────────────────────
function MembersTab({ members }) {
  return (
    <motion.div
      key="members"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={PS.tabContent}
    >
      <div style={PS.memberGrid}>
        {members.map((m, i) => (
          <motion.div
            key={m._id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.06 }}
            style={PS.memberCard}
          >
            <div style={PS.memberAvatar}>{m.name[0].toUpperCase()}</div>
            <div style={PS.memberInfo}>
              <span style={PS.memberName}>{m.name.toUpperCase()}</span>
              <span style={PS.memberEmail}>{m.email}</span>
              <div style={PS.memberMeta}>
                <RoleBadge role={m.role} />
                <span style={PS.memberJoined}>JOINED {m.joined}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── notes tab ─────────────────────────────────────────────────────────────────
function NotesTab({ notes }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <motion.div
      key="notes"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={PS.tabContent}
    >
      <div style={PS.notesList}>
        {notes.map((note, i) => {
          const isOpen = expanded === note._id;
          return (
            <motion.div
              key={note._id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.07 }}
              style={{
                ...PS.noteCard,
                borderColor: isOpen ? "var(--phosphor-dim)" : "var(--border)",
              }}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : note._id)}
                style={PS.noteHeader}
              >
                <span style={PS.noteChevron}>{isOpen ? "▼" : "▶"}</span>
                <span style={PS.noteTitle}>{note.title}</span>
                <span style={PS.noteAuthor}>
                  {note.author.name.split(" ")[0].toUpperCase()}
                </span>
                <span style={PS.noteDate}>{note.createdAt}</span>
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={PS.noteBody}>{note.content}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function ProjectPage({ project, onBack }) {
  const proj = project || {
    _id: "demo",
    name: "MISSION ALPHA",
    description: "Core authentication and user management layer.",
  };

  const [activeTab, setActiveTab] = useState("tasks");
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const handleTaskMove = (taskId, newStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)),
    );
    // TODO: PATCH /api/v1/tasks/:projectId/t/:taskId  { status: newStatus }
  };

  const handleCreateTask = async (data) => {
    const newTask = {
      _id: `t${Date.now()}`,
      ...data,
      assignee: MOCK_MEMBERS.find((m) => m._id === data.assigneeId) || null,
      subTasks: (data.subtasks || []).map((s) => ({
        ...s,
        isCompleted: false,
      })),
      attachments: [],
    };
    setTasks((prev) => [...prev, newTask]);
    // TODO: POST /api/v1/tasks/:projectId  { ...data }
  };

  const TABS = [
    { id: "tasks", label: "TASKS", count: tasks.length },
    { id: "members", label: "MEMBERS", count: MOCK_MEMBERS.length },
    { id: "notes", label: "NOTES", count: MOCK_NOTES.length },
  ];

  return (
    <div style={PS.page}>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={PS.pageHeader}
      >
        <div style={PS.breadcrumb}>
          <button onClick={onBack} style={PS.backBtn}>
            ← PROJECTS
          </button>
          <span style={PS.breadSep}>/</span>
          <span style={PS.breadCurrent}>{proj.name}</span>
        </div>
        <p style={PS.projDesc}>{proj.description}</p>
      </motion.div>

      {/* Tab bar */}
      <div style={PS.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...PS.tabBtn,
              color: activeTab === tab.id ? "var(--phosphor)" : "var(--muted)",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--phosphor)"
                  : "2px solid transparent",
            }}
          >
            {tab.label}
            <span
              style={{
                ...PS.tabCount,
                background:
                  activeTab === tab.id ? "rgba(0,255,65,0.12)" : "transparent",
                color:
                  activeTab === tab.id ? "var(--phosphor)" : "var(--muted)",
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
        <div style={PS.tabRest} />
      </div>

      {/* Tab content */}
      <div style={PS.contentArea}>
        <AnimatePresence mode="wait">
          {activeTab === "tasks" && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ height: "100%" }}
            >
              <KanbanBoard
                tasks={tasks}
                onTaskMove={handleTaskMove}
                onTaskClick={(task) =>
                  console.log("open task detail", task._id)
                }
                onCreateTask={() => setShowCreateTask(true)}
              />
            </motion.div>
          )}

          {activeTab === "members" && (
            <MembersTab key="members" members={MOCK_MEMBERS} />
          )}

          {activeTab === "notes" && <NotesTab key="notes" notes={MOCK_NOTES} />}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <CreateTaskModal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onSubmit={handleCreateTask}
        members={MOCK_MEMBERS}
        projectName={proj.name}
      />
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const PS = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    gap: 0,
    minHeight: 0,
  },
  pageHeader: {
    marginBottom: 20,
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    cursor: "pointer",
    padding: 0,
    transition: "color 0.15s",
  },
  breadSep: {
    color: "var(--border)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
  },
  breadCurrent: {
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    letterSpacing: 3,
    fontWeight: "bold",
  },
  projDesc: {
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 1,
    margin: 0,
  },

  tabBar: {
    display: "flex",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    marginBottom: 20,
  },
  tabBtn: {
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 2,
    padding: "10px 20px 10px",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: -1,
  },
  tabCount: {
    fontSize: 8,
    letterSpacing: 1,
    padding: "1px 6px",
    fontFamily: "var(--font-mono)",
    transition: "background 0.15s, color 0.15s",
  },
  tabRest: {
    flex: 1,
  },

  contentArea: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  tabContent: {
    height: "100%",
    overflowY: "auto",
  },

  // Members
  memberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 12,
    padding: "4px 0",
  },
  memberCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    padding: "16px",
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    transition: "border-color 0.15s",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    background: "rgba(0,255,65,0.1)",
    border: "1px solid var(--phosphor)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--phosphor)",
    fontFamily: "var(--font-mono)",
    fontSize: 16,
    fontWeight: "bold",
    flexShrink: 0,
  },
  memberInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  memberName: {
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "bold",
  },
  memberEmail: {
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 1,
  },
  memberMeta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  roleBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: 7,
    letterSpacing: 2,
    border: "1px solid",
    padding: "2px 6px",
  },
  memberJoined: {
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 7,
    letterSpacing: 1,
  },

  // Notes
  notesList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "4px 0",
  },
  noteCard: {
    background: "var(--surface)",
    border: "1px solid",
    overflow: "hidden",
    transition: "border-color 0.15s",
  },
  noteHeader: {
    width: "100%",
    background: "none",
    border: "none",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    textAlign: "left",
  },
  noteChevron: {
    color: "var(--phosphor)",
    fontSize: 8,
    flexShrink: 0,
  },
  noteTitle: {
    color: "var(--text)",
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "bold",
    flex: 1,
  },
  noteAuthor: {
    color: "var(--phosphor-dim)",
    fontSize: 8,
    letterSpacing: 2,
    flexShrink: 0,
  },
  noteDate: {
    color: "var(--muted)",
    fontSize: 8,
    letterSpacing: 1,
    flexShrink: 0,
  },
  noteBody: {
    padding: "0 16px 16px 36px",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    lineHeight: 1.7,
    letterSpacing: 0.5,
    borderTop: "1px solid var(--border)",
    paddingTop: 12,
  },
};
