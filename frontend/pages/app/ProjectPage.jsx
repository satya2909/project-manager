import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import KanbanBoard from "../../components/ui/KanbanBoard.jsx";
import CreateTaskModal from "../../components/ui/CreateTaskModal.jsx";
import TaskDetailDrawer from "../../components/ui/TaskDetailDrawer.jsx";
import { useTasks, useMembers, useNotes } from "../../hooks/index.js";
import { useAuth } from "../../context/authcontext.jsx";
import MembersPanel from "../../components/ui/MembersPanel.jsx";

// ── role badges ───────────────────────────────────────────────────────────────
// Project-level role (this user's role within THIS project). Greenish palette.
const ROLE_CFG = {
  admin: { label: "PROJECT ADMIN", color: "var(--phosphor)" },
  project_admin: { label: "PROJECT PM", color: "var(--phosphor-dim, #4ea36a)" },
  member: { label: "MEMBER", color: "var(--muted)" },
};

// Org-level role (owner/admin) — distinct hue so it never reads the same as a
// project role. Shown when the user manages the whole org.
const ORG_ROLE_CFG = {
  owner: { label: "ORG OWNER", color: "var(--amber, #f0a500)" },
  admin: { label: "ORG ADMIN", color: "var(--ice, #4db8ff)" },
};

function RoleBadge({ role }) {
  const cfg = ROLE_CFG[role] || ROLE_CFG.member;
  return (
    <span style={{ ...PS.roleBadge, color: cfg.color, borderColor: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function OrgRoleBadge({ role }) {
  const cfg = ORG_ROLE_CFG[role];
  if (!cfg) return null;
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

// ── project stats strip ───────────────────────────────────────────────────────
function ProjectStats({ project, tasks, members }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const stats = [
    { label: "MEMBERS", value: members.length, color: "var(--phosphor)" },
    { label: "TOTAL TASKS", value: total, color: "var(--text)" },
    { label: "IN PROGRESS", value: inProgress, color: "var(--amber)" },
    { label: "COMPLETED", value: done, color: "var(--phosphor)" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      style={PS.statsStrip}
    >
      {stats.map((s, i) => (
        <div key={s.label} style={PS.statItem}>
          <span style={{ ...PS.statValue, color: s.color }}>{s.value}</span>
          <span style={PS.statLabel}>{s.label}</span>
          {i < stats.length - 1 && <div style={PS.statDivider} />}
        </div>
      ))}

      {/* completion bar */}
      <div style={PS.completionWrap}>
        <div style={PS.completionTrack}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              ...PS.completionFill,
              background: pct === 100 ? "var(--phosphor)" : "var(--amber)",
              boxShadow: pct === 100 ? "0 0 6px var(--phosphor)" : "none",
            }}
          />
        </div>
        <span style={PS.completionPct}>{pct}%</span>
      </div>
    </motion.div>
  );
}

// ── members tab ───────────────────────────────────────────────────────────────
function MembersTab({ projectId }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ ...PS.tabContent, overflowY: "auto" }}
    >
      <MembersPanel projectId={projectId} />
    </motion.div>
  );
}

// ── create / edit note form ───────────────────────────────────────────────────
function NoteForm({ initial = null, onSave, onCancel, saving }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const titleRef = useRef(null);

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 80);
  }, []);

  const canSubmit = title.trim().length >= 2 && content.trim().length >= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      style={PS.noteForm}
    >
      {/* corner brackets */}
      <div
        style={{
          ...PS.corner,
          top: -1,
          left: -1,
          borderTop: "2px solid var(--phosphor)",
          borderLeft: "2px solid var(--phosphor)",
        }}
      />
      <div
        style={{
          ...PS.corner,
          top: -1,
          right: -1,
          borderTop: "2px solid var(--phosphor)",
          borderRight: "2px solid var(--phosphor)",
        }}
      />
      <div
        style={{
          ...PS.corner,
          bottom: -1,
          left: -1,
          borderBottom: "2px solid var(--phosphor)",
          borderLeft: "2px solid var(--phosphor)",
        }}
      />
      <div
        style={{
          ...PS.corner,
          bottom: -1,
          right: -1,
          borderBottom: "2px solid var(--phosphor)",
          borderRight: "2px solid var(--phosphor)",
        }}
      />

      <div style={PS.noteFormHeader}>
        <span style={PS.noteFormLabel}>
          {initial ? "EDIT NOTE" : "NEW NOTE"}
        </span>
      </div>

      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="NOTE TITLE..."
        style={PS.noteFormInput}
        maxLength={150}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="NOTE CONTENT..."
        rows={5}
        style={{ ...PS.noteFormInput, ...PS.noteFormTextarea }}
        maxLength={10000}
      />
      <div style={PS.noteFormFooter}>
        <span style={PS.noteFormCount}>{content.length}/10000</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            style={PS.noteFormCancel}
            disabled={saving}
          >
            ABORT
          </button>
          <button
            onClick={() =>
              canSubmit &&
              onSave({ title: title.trim(), content: content.trim() })
            }
            style={{
              ...PS.noteFormSave,
              opacity: canSubmit && !saving ? 1 : 0.4,
              cursor: canSubmit && !saving ? "pointer" : "not-allowed",
            }}
            disabled={!canSubmit || saving}
          >
            {saving ? "◌ SAVING..." : initial ? "SAVE CHANGES" : "POST NOTE"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── notes tab ─────────────────────────────────────────────────────────────────
function NotesTab({ projectId, canAdmin }) {
  const { notes, loading, error, refetch, createNote, updateNote, deleteNote } =
    useNotes(projectId);

  const [expanded, setExpanded] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleCreate = async (payload) => {
    setSaving(true);
    const result = await createNote(payload);
    setSaving(false);
    if (result?.success !== false) {
      setShowCreate(false);
    }
  };

  const handleEdit = async (noteId, payload) => {
    setSaving(true);
    const result = await updateNote(noteId, payload);
    setSaving(false);
    if (result?.success !== false) {
      setEditingId(null);
    }
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm("DELETE THIS NOTE? THIS CANNOT BE UNDONE.")) return;
    setDeletingId(noteId);
    await deleteNote(noteId);
    setDeletingId(null);
    if (expanded === noteId) setExpanded(null);
  };

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
      style={{ ...PS.tabContent, overflowY: "auto" }}
    >
      {/* admin toolbar */}
      {canAdmin && (
        <div style={PS.notesToolbar}>
          <span style={PS.notesToolbarLabel}>▤ NOTES [{notes.length}]</span>
          {!showCreate && (
            <button onClick={() => setShowCreate(true)} style={PS.notesAddBtn}>
              + NEW NOTE
            </button>
          )}
        </div>
      )}

      {/* create form */}
      <AnimatePresence>
        {showCreate && (
          <NoteForm
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
            saving={saving && !editingId}
          />
        )}
      </AnimatePresence>

      <div style={PS.notesList}>
        {notes.map((note, i) => {
          const isOpen = expanded === note._id;
          const isEditing = editingId === note._id;
          const isDeleting = deletingId === note._id;
          const author =
            note.createdBy?.fullName || note.createdBy?.username || "UNKNOWN";
          // Notes created before titles existed have no title — fall back to
          // the first line of content so the header never renders blank.
          const displayTitle =
            note.title?.trim() ||
            note.content?.split("\n")[0].slice(0, 80).trim() ||
            "UNTITLED";
          const isEdited =
            note.updatedAt &&
            note.createdAt &&
            note.updatedAt !== note.createdAt;
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
              animate={{ opacity: isDeleting ? 0.4 : 1, x: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
              style={{
                ...PS.noteCard,
                borderColor:
                  isOpen || isEditing ? "var(--phosphor-dim)" : "var(--border)",
              }}
            >
              {/* header row — always visible */}
              <div style={PS.noteHeader}>
                <button
                  onClick={() =>
                    !isEditing && setExpanded(isOpen ? null : note._id)
                  }
                  style={PS.noteHeaderBtn}
                >
                  <span style={PS.noteChevron}>{isOpen ? "▼" : "▶"}</span>
                  <span style={PS.noteTitle}>{displayTitle}</span>
                  {isEdited && <span style={PS.noteEdited}>EDITED</span>}
                  <span style={PS.noteAuthor}>
                    {author.split(" ")[0].toUpperCase()}
                  </span>
                  <span style={PS.noteDate}>{date}</span>
                </button>

                {/* admin actions */}
                {canAdmin && !isEditing && (
                  <div style={PS.noteActions}>
                    <button
                      onClick={() => {
                        setExpanded(note._id);
                        setEditingId(note._id);
                      }}
                      style={PS.noteActionBtn}
                      title="Edit note"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(note._id)}
                      style={{ ...PS.noteActionBtn, color: "var(--red)" }}
                      disabled={isDeleting}
                      title="Delete note"
                    >
                      {isDeleting ? "◌" : "✕"}
                    </button>
                  </div>
                )}
              </div>

              {/* edit form */}
              <AnimatePresence>
                {isEditing && (
                  <div style={{ padding: "0 0 12px" }}>
                    <NoteForm
                      initial={note}
                      onSave={(payload) => handleEdit(note._id, payload)}
                      onCancel={() => setEditingId(null)}
                      saving={saving && editingId === note._id}
                    />
                  </div>
                )}
              </AnimatePresence>

              {/* expanded content */}
              <AnimatePresence>
                {isOpen && !isEditing && (
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

        {notes.length === 0 && !showCreate && (
          <div style={PS.emptyState}>
            <span style={PS.emptyIcon}>▤</span>
            <span>NO NOTES YET</span>
            {canAdmin && (
              <button
                onClick={() => setShowCreate(true)}
                style={PS.emptyAddBtn}
              >
                + POST FIRST NOTE
              </button>
            )}
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
  const { tasks, loading, error, refetch, createTask, updateTask, setTasks } =
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
    // The drawer already deleted the task on the server before calling onDelete,
    // so here we only sync local state (re-calling the API would 404 and skip
    // the state update, leaving the task on the board until a manual refresh).
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
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
          canCreate={canManage}
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
  const { user, isOrgOwner, isOrgAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("tasks");
  const { members } = useMembers(project._id);
  const { tasks } = useTasks(project._id);

  // derive current user's role in this project
  const myMembership = project.members?.find(
    (m) => (m.user?._id || m.user)?.toString() === user?._id?.toString(),
  );
  const myRole = myMembership?.role;
  const canAdmin = myRole === "admin";
  // org owner/admin manage every project in their org (may not be a member here)
  const myOrgRole = isOrgOwner ? "owner" : isOrgAdmin ? "admin" : null;

  const TABS = [
    { id: "tasks", label: "TASKS" },
    { id: "members", label: "MEMBERS" },
    { id: "notes", label: "NOTES" },
  ];

  return (
    <div style={PS.page}>
      {/* header */}
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
          {myOrgRole && <OrgRoleBadge role={myOrgRole} />}
          {myRole && <RoleBadge role={myRole} />}
        </div>
        {project.description && (
          <p style={PS.projDesc}>{project.description}</p>
        )}
      </motion.div>

      {/* stats strip — driven by live task + member data */}
      <ProjectStats project={project} tasks={tasks} members={members} />

      {/* tab bar */}
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

      {/* content */}
      <div style={PS.contentArea}>
        <AnimatePresence mode="wait">
          {activeTab === "tasks" && (
            <TasksTab key="tasks" project={project} members={members} />
          )}
          {activeTab === "members" && (
            <MembersTab key="members" projectId={project._id} />
          )}
          {activeTab === "notes" && (
            <NotesTab key="notes" projectId={project._id} canAdmin={canAdmin} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const PS = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  },
  pageHeader: { marginBottom: 12 },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
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

  // ── stats strip ──────────────────────────────────────────────────────────
  statsStrip: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    padding: "10px 16px",
    marginBottom: 16,
    position: "relative",
    overflow: "hidden",
  },
  statItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  statValue: {
    fontFamily: "var(--font-display)",
    fontSize: 20,
    letterSpacing: 1,
    lineHeight: 1,
  },
  statLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 7,
    letterSpacing: 2,
    color: "var(--muted)",
    lineHeight: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    background: "var(--border)",
    margin: "0 16px",
  },
  completionWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginLeft: "auto",
    flexShrink: 0,
  },
  completionTrack: {
    width: 120,
    height: 2,
    background: "var(--border)",
    overflow: "hidden",
  },
  completionFill: {
    height: "100%",
    transition: "width 0.3s ease",
  },
  completionPct: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--muted)",
    letterSpacing: 1,
    width: 28,
    textAlign: "right",
    flexShrink: 0,
  },

  // ── tabs ─────────────────────────────────────────────────────────────────
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

  // ── notes toolbar ────────────────────────────────────────────────────────
  notesToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: "1px solid var(--border)",
  },
  notesToolbarLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--muted)",
    letterSpacing: 2,
  },
  notesAddBtn: {
    background: "rgba(0,255,65,0.07)",
    border: "1px solid var(--phosphor)",
    color: "var(--phosphor)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "6px 14px",
    cursor: "pointer",
    transition: "background 0.15s",
  },

  // ── note form ────────────────────────────────────────────────────────────
  noteForm: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    padding: "16px",
    marginBottom: 14,
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  corner: {
    position: "absolute",
    width: 10,
    height: 10,
  },
  noteFormHeader: {
    marginBottom: 4,
  },
  noteFormLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: 3,
    color: "var(--phosphor)",
  },
  noteFormInput: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: 0.5,
    padding: "9px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  noteFormTextarea: {
    resize: "vertical",
    minHeight: 100,
    lineHeight: 1.7,
  },
  noteFormFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteFormCount: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    color: "var(--muted)",
    letterSpacing: 1,
  },
  noteFormCancel: {
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "7px 14px",
    cursor: "pointer",
  },
  noteFormSave: {
    background: "rgba(0,255,65,0.08)",
    border: "1px solid var(--phosphor)",
    color: "var(--phosphor)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "7px 16px",
    transition: "background 0.15s",
  },

  // ── notes list ───────────────────────────────────────────────────────────
  notesList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "4px 0",
  },
  noteCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    overflow: "hidden",
    transition: "border-color 0.15s",
  },
  noteHeader: {
    display: "flex",
    alignItems: "center",
    gap: 0,
  },
  noteHeaderBtn: {
    flex: 1,
    background: "none",
    border: "none",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "13px 16px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    textAlign: "left",
    minWidth: 0,
  },
  noteChevron: { color: "var(--phosphor)", fontSize: 8, flexShrink: 0 },
  noteTitle: {
    color: "var(--text)",
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "bold",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  noteEdited: {
    color: "var(--amber)",
    fontSize: 7,
    letterSpacing: 1.5,
    border: "1px solid var(--amber)",
    borderRadius: 2,
    padding: "1px 4px",
    flexShrink: 0,
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
  noteActions: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    paddingRight: 10,
    flexShrink: 0,
  },
  noteActionBtn: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 11,
    padding: "4px 7px",
    fontFamily: "var(--font-mono)",
    transition: "color 0.15s",
    lineHeight: 1,
  },
  noteBody: {
    padding: "12px 16px 16px 36px",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    lineHeight: 1.7,
    letterSpacing: 0.5,
    borderTop: "1px solid var(--border)",
    whiteSpace: "pre-wrap",
  },

  // ── empty / error ────────────────────────────────────────────────────────
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
  emptyAddBtn: {
    background: "rgba(0,255,65,0.07)",
    border: "1px solid var(--phosphor)",
    color: "var(--phosphor)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "8px 16px",
    cursor: "pointer",
    marginTop: 6,
  },
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

  // ── skeleton ────────────────────────────────────────────────────────────
  skeletonCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
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

  // ── role badge ───────────────────────────────────────────────────────────
  roleBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: 7,
    letterSpacing: 2,
    border: "1px solid",
    padding: "2px 6px",
  },
};
