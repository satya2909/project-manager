import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import KanbanBoard from "../../components/ui/KanbanBoard.jsx";
import CreateTaskModal from "../../components/ui/CreateTaskModal.jsx";
import TaskDetailDrawer from "../../components/ui/TaskDetailDrawer.jsx";
import { useTasks, useMembers, useNotes } from "../../hooks/index.js";
import { useAuth } from "../../context/authcontext.jsx";

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

function SkeletonCard() {
  return (
    <div style={PS.skeletonCard}>
      <div style={{ ...PS.skeletonLine, width: "60%", marginBottom: 10 }} />
      <div style={{ ...PS.skeletonLine, width: "40%", marginBottom: 8 }} />
      <div style={{ ...PS.skeletonLine, width: "80%" }} />
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={PS.errorState}>
      <span style={PS.errorIcon}>⚠</span>
      <span style={PS.errorMsg}>{message}</span>
      {onRetry && (
        <button onClick={onRetry} style={PS.retryBtn}>
          ↻ RETRY
        </button>
      )}
    </div>
  );
}

// ── members tab ───────────────────────────────────────────────────────────────
function MembersTab({ projectId }) {
  const { members, loading, error, refetch } = useMembers(projectId);

  if (loading)
    return (
      <div style={PS.tabContent}>
        <div style={PS.memberGrid}>
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  if (error)
    return (
      <div style={PS.tabContent}>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={PS.tabContent}
    >
      <div style={PS.memberGrid}>
        {members.map((m, i) => {
          const user = m.user || m;
          const name = user.fullName || user.username || "Unknown";
          return (
            <motion.div
              key={user._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.06 }}
              style={PS.memberCard}
            >
              <div style={PS.memberAvatar}>{name[0].toUpperCase()}</div>
              <div style={PS.memberInfo}>
                <span style={PS.memberName}>{name.toUpperCase()}</span>
                <span style={PS.memberEmail}>{user.email}</span>
                <div style={PS.memberMeta}>
                  <RoleBadge role={m.role} />
                  <span style={PS.memberJoined}>
                    JOINED{" "}
                    {new Date(user.createdAt)
                      .toLocaleDateString("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                      })
                      .toUpperCase()}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
        {members.length === 0 && (
          <div style={PS.emptyState}>
            <span style={PS.emptyIcon}>◈</span>
            <span>NO MEMBERS FOUND</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── notes tab ─────────────────────────────────────────────────────────────────
function NotesTab({ projectId }) {
  const { notes, loading, error, refetch } = useNotes(projectId);
  const [expanded, setExpanded] = useState(null);

  if (loading)
    return (
      <div style={PS.tabContent}>
        {[...Array(3)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  if (error)
    return (
      <div style={PS.tabContent}>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={PS.tabContent}
    >
      <div style={PS.notesList}>
        {notes.map((note, i) => {
          const isOpen = expanded === note._id;
          const author =
            note.createdBy?.fullName || note.createdBy?.username || "UNKNOWN";
          const date = new Date(note.createdAt)
            .toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
            .toUpperCase();
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
                  {author.split(" ")[0].toUpperCase()}
                </span>
                <span style={PS.noteDate}>{date}</span>
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
        {notes.length === 0 && (
          <div style={PS.emptyState}>
            <span style={PS.emptyIcon}>▤</span>
            <span>NO NOTES YET</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── tasks tab ─────────────────────────────────────────────────────────────────
function TasksTab({ project, members }) {
  const { user } = useAuth();
  const projectId = project._id;
  const { tasks, loading, error, refetch, createTask, updateTask, deleteTask } =
    useTasks(projectId);

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const myMembership = project.members?.find(
    (m) => (m.user?._id || m.user)?.toString() === user?._id?.toString(),
  );
  const canManage = ["admin", "project_admin"].includes(myMembership?.role);

  const handleTaskMove = async (taskId, newStatus) => {
    await updateTask(taskId, { status: newStatus });
  };
  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };
  const handleCreateTask = async (data) => {
    await createTask({
      title: data.title,
      description: data.description,
      status: data.status,
      assignedTo: data.assigneeId || undefined,
    });
  };
  const handleTaskUpdate = async (taskId, patch) => {
    await updateTask(taskId, patch);
    setSelectedTask((prev) => (prev ? { ...prev, ...patch } : prev));
  };
  const handleTaskDelete = (taskId) => {
    deleteTask(taskId);
    setDrawerOpen(false);
    setSelectedTask(null);
  };

  const memberList = members.map((m) => ({
    _id: m.user?._id || m._id,
    name: m.user?.fullName || m.user?.username || "Unknown",
  }));

  if (loading)
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 16,
          height: "100%",
        }}
      >
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ ...PS.skeletonCard, height: "100%" }}>
            {[...Array(3)].map((_, j) => (
              <div key={j} style={{ marginBottom: 12 }}>
                <SkeletonCard />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ height: "100%" }}
      >
        <KanbanBoard
          tasks={tasks}
          onTaskMove={handleTaskMove}
          onTaskClick={handleTaskClick}
          onCreateTask={() => setShowCreateTask(true)}
        />
      </motion.div>
      <CreateTaskModal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onSubmit={handleCreateTask}
        members={memberList}
        projectName={project.name}
      />
      <TaskDetailDrawer
        task={selectedTask}
        projectId={projectId}
        members={memberList}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedTask(null);
        }}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
        canManage={canManage}
      />
    </>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function ProjectPage({ project, onBack }) {
  const [activeTab, setActiveTab] = useState("tasks");
  const { members } = useMembers(project._id);

  const TABS = [
    { id: "tasks", label: "TASKS" },
    { id: "members", label: "MEMBERS" },
    { id: "notes", label: "NOTES" },
  ];

  return (
    <div style={PS.page}>
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
          <span style={PS.breadCurrent}>{project.name}</span>
        </div>
        {project.description && (
          <p style={PS.projDesc}>{project.description}</p>
        )}
      </motion.div>

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
          </button>
        ))}
        <div style={PS.tabRest} />
      </div>

      <div style={PS.contentArea}>
        <AnimatePresence mode="wait">
          {activeTab === "tasks" && (
            <TasksTab key="tasks" project={project} members={members} />
          )}
          {activeTab === "members" && (
            <MembersTab key="members" projectId={project._id} />
          )}
          {activeTab === "notes" && (
            <NotesTab key="notes" projectId={project._id} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const PS = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  },
  pageHeader: { marginBottom: 20 },
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
    padding: "10px 20px",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
    marginBottom: -1,
  },
  tabRest: { flex: 1 },
  contentArea: { flex: 1, minHeight: 0, overflow: "hidden" },
  tabContent: { height: "100%", overflowY: "auto" },
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
  memberInfo: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
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
  memberMeta: { display: "flex", alignItems: "center", gap: 10, marginTop: 4 },
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
  noteChevron: { color: "var(--phosphor)", fontSize: 8, flexShrink: 0 },
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
    padding: "12px 16px 16px 36px",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    lineHeight: 1.7,
    letterSpacing: 0.5,
    borderTop: "1px solid var(--border)",
  },
  skeletonCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    padding: 16,
  },
  skeletonLine: {
    height: 10,
    background:
      "linear-gradient(90deg, var(--surface) 25%, var(--border) 50%, var(--surface) 75%)",
    backgroundSize: "200% auto",
    animation: "shimmer 1.5s linear infinite",
    borderRadius: 2,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "48px 20px",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
  },
  emptyIcon: { fontSize: 28, opacity: 0.3 },
  errorState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "48px 20px",
    fontFamily: "var(--font-mono)",
  },
  errorIcon: { color: "var(--red)", fontSize: 24 },
  errorMsg: { color: "var(--muted)", fontSize: 10, letterSpacing: 1 },
  retryBtn: {
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "6px 14px",
    cursor: "pointer",
    transition: "border-color 0.15s, color 0.15s",
  },
};
