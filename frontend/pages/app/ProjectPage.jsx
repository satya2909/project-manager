import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import KanbanBoard from "../../components/ui/KanbanBoard.jsx";
import TaskTable from "../../components/ui/TaskTable.jsx";
import TimelineSection from "../../components/ui/TimelineSection.jsx";
import CreateTaskModal from "../../components/ui/CreateTaskModal.jsx";
import TaskDetailDrawer from "../../components/ui/TaskDetailDrawer.jsx";
import { useTasks, useMembers, useNotes } from "../../hooks/index.js";
import { useAuth } from "../../context/authcontext.jsx";
import { projectsApi, parseApiError } from "../../api/index.js";
import MembersPanel from "../../components/ui/MembersPanel.jsx";
import { Button, Label, InlineError, InlineSuccess } from "../../components/ui/primitive.jsx";

// ── task view preference (per project, localStorage) ───────────────────────────
// Wrapped in try/catch: private browsing / full storage must never crash the
// page — it just means the view choice won't persist across visits.
const TASK_VIEW_PREFIX = "taskView:";

function getStoredTaskView(projectId) {
  try {
    return localStorage.getItem(TASK_VIEW_PREFIX + projectId) || "kanban";
  } catch {
    return "kanban";
  }
}

function setStoredTaskView(projectId, view) {
  try {
    localStorage.setItem(TASK_VIEW_PREFIX + projectId, view);
  } catch {
    /* storage unavailable — view choice just won't persist, non-fatal */
  }
}

function ViewToggle({ view, onChange }) {
  const OPTIONS = [
    { value: "kanban", label: "Board" },
    { value: "table", label: "Table" },
  ];
  return (
    <div style={PS.viewToggle}>
      {OPTIONS.map((o) => {
        const active = view === o.value;
        return (
          <button
            key={o.value}
            onClick={() => !active && onChange(o.value)}
            style={{
              ...PS.viewToggleBtn,
              color: active ? "var(--text)" : "var(--text-dim)",
              background: active ? "var(--surface-2)" : "transparent",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── role badges ───────────────────────────────────────────────────────────────
// Project-level role (this user's role within THIS project). Greenish palette.
const ROLE_CFG = {
  admin: { label: "Project admin", color: "var(--signal)", soft: "var(--signal-soft)" },
  project_admin: { label: "Project PM", color: "var(--text-soft)", soft: "var(--surface-2)" },
  member: { label: "Member", color: "var(--text-dim)", soft: "var(--surface-2)" },
};

// Org-level role (owner/admin) — distinct from a project role.
const ORG_ROLE_CFG = {
  owner: { label: "Org owner", color: "var(--brass)", soft: "var(--brass-soft)" },
  admin: { label: "Org admin", color: "var(--signal)", soft: "var(--signal-soft)" },
};

function RoleBadge({ role }) {
  const cfg = ROLE_CFG[role] || ROLE_CFG.member;
  return <span style={{ ...PS.roleBadge, color: cfg.color, background: cfg.soft }}>{cfg.label}</span>;
}

function OrgRoleBadge({ role }) {
  const cfg = ORG_ROLE_CFG[role];
  if (!cfg) return null;
  return <span style={{ ...PS.roleBadge, color: cfg.color, background: cfg.soft }}>{cfg.label}</span>;
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
              background: pct === 100 ? "var(--signal)" : "var(--brass)",
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
      style={PS.tabContent}
    >
      <MembersPanel projectId={projectId} />
    </motion.div>
  );
}

// ── settings tab ──────────────────────────────────────────────────────────────
function SettingsTab({ project, onProjectUpdate }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [keyPrefix, setKeyPrefix] = useState(project.keyPrefix || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const prefixChanged = keyPrefix.trim().toUpperCase() !== project.keyPrefix;
  const prefixValid = /^[A-Z]{2,6}$/.test(keyPrefix.trim().toUpperCase());
  const canSubmit =
    name.trim().length >= 3 && (!prefixChanged || prefixValid) && !saving;

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const { data } = await projectsApi.update(project._id, {
        name: name.trim(),
        description: description.trim(),
        keyPrefix: keyPrefix.trim().toUpperCase(),
      });
      const updated = data?.data?.project;
      onProjectUpdate?.(updated);
      setSuccess("Project updated");
      setTimeout(() => setSuccess(null), 2400);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ ...PS.settingsTabContent, maxWidth: 480 }}
    >
      <div style={PS.settingsField}>
        <Label>Project name</Label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field"
          maxLength={100}
        />
      </div>

      <div style={PS.settingsField}>
        <Label>Description</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-field textarea-field"
          rows={3}
          maxLength={500}
        />
      </div>

      <div style={PS.settingsField}>
        <Label>Key prefix</Label>
        <input
          value={keyPrefix}
          onChange={(e) => setKeyPrefix(e.target.value.toUpperCase())}
          className="input-field"
          style={{ fontFamily: "var(--font-mono)", maxWidth: 140, textTransform: "uppercase" }}
          maxLength={6}
        />
        {prefixChanged && (
          <p style={PS.settingsPrefixWarning}>
            {prefixValid ? (
              <>
                Renaming to <strong>{keyPrefix.trim().toUpperCase()}</strong> will show every task
                as <strong>{keyPrefix.trim().toUpperCase()}-1</strong> … immediately. Existing{" "}
                <strong>{project.keyPrefix}-*</strong> branches and PRs will keep working.
              </>
            ) : (
              "Key prefix must be 2-6 letters."
            )}
          </p>
        )}
      </div>

      {error && <InlineError message={error} />}
      {success && <InlineSuccess message={success} />}

      <Button onClick={handleSave} disabled={!canSubmit} style={{ alignSelf: "flex-start" }}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
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
      <div style={PS.noteFormHeader}>
        <span style={PS.noteFormLabel}>{initial ? "Edit note" : "New note"}</span>
      </div>

      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        className="input-field"
        maxLength={150}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your note…"
        rows={5}
        className="input-field textarea-field"
        style={{ lineHeight: 1.7 }}
        maxLength={10000}
      />
      <div style={PS.noteFormFooter}>
        <span style={PS.noteFormCount}>{content.length}/10000</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} className="btn btn-ghost" disabled={saving} style={{ fontSize: "0.8rem" }}>
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onSave({ title: title.trim(), content: content.trim() })}
            className="btn btn-primary"
            style={{ fontSize: "0.8rem", opacity: canSubmit && !saving ? 1 : 0.4, cursor: canSubmit && !saving ? "pointer" : "not-allowed" }}
            disabled={!canSubmit || saving}
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Post note"}
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
      style={PS.tabContent}
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
  const [view, setView] = useState(() => getStoredTaskView(projectId));

  const handleViewChange = (next) => {
    setView(next);
    setStoredTaskView(projectId, next);
  };

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
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={PS.tasksToolbar}>
          <ViewToggle view={view} onChange={handleViewChange} />
          {view === "table" && canManage && (
            <Button variant="primary" onClick={() => setShowCreateTask(true)}>
              + New task
            </Button>
          )}
        </div>

        {view === "kanban" ? (
          <KanbanBoard
            tasks={tasks}
            onTaskMove={handleTaskMove}
            onTaskClick={handleTaskClick}
            onCreateTask={() => setShowCreateTask(true)}
            canCreate={canManage}
          />
        ) : (
          <TaskTable
            tasks={tasks}
            onTaskClick={handleTaskClick}
            emptyMessage={
              canManage ? "Create your first task to get started." : "No tasks yet."
            }
          />
        )}

        {/* Collapsible, below whichever of Board/Table is selected — not a
            third ViewToggle tab. Per-project only (no org-wide timeline). */}
        <TimelineSection projectId={projectId} canManage={canManage} />
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
export default function ProjectPage({ project, onBack, onProjectUpdate }) {
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
  // Settings needs the full canManage check (project admin OR org owner/admin)
  // — canAdmin alone is the pre-existing gap tracked in TODOS.md (an org
  // owner who isn't a project member can't manage). Not fixing that bug's
  // other occurrences in this file (Kanban/Table create gating) here — that's
  // the separate, focused fix TODOS.md already scopes; this is just not
  // propagating it into a brand-new tab.
  const canManageSettings = canAdmin || myOrgRole === "owner" || myOrgRole === "admin";

  const TABS = [
    { id: "tasks", label: "Tasks" },
    { id: "members", label: "Members" },
    { id: "notes", label: "Notes" },
    ...(canManageSettings ? [{ id: "settings", label: "Settings" }] : []),
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
        <button onClick={onBack} style={PS.backBtn}>← Projects</button>
        <div style={PS.titleRow}>
          <h1 style={PS.projTitle}>{project.name}</h1>
          {myOrgRole && <OrgRoleBadge role={myOrgRole} />}
          {myRole && <RoleBadge role={myRole} />}
        </div>
        {project.description && <p style={PS.projDesc}>{project.description}</p>}
      </motion.div>

      {/* stats strip — driven by live task + member data */}
      <ProjectStats project={project} tasks={tasks} members={members} />

      {/* tab bar */}
      <div style={PS.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ ...PS.tabBtn, color: activeTab === tab.id ? "var(--text)" : "var(--text-dim)" }}
          >
            {tab.label}
            {activeTab === tab.id && <motion.div layoutId="project-tab-underline" style={PS.tabUnderline} />}
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
          {activeTab === "settings" && canManageSettings && (
            <SettingsTab key="settings" project={project} onProjectUpdate={onProjectUpdate} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const PS = {
  // No height/overflow ownership here — AppShell's <main> (S.content in
  // AppShell.jsx) is already the one page-level scroll container. Claiming
  // height:100% + overflow:hidden here created a second, nested scroll
  // region that fought the outer one: header/stats/tabs read as pinned
  // (clipped to the inner container's fitted height) and short content left
  // a forced gap at the bottom (ProjectPage was always exactly as tall as
  // the outer viewport, never its natural content height).
  page: { display: "flex", flexDirection: "column" },
  pageHeader: { marginBottom: 14 },
  backBtn: {
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: "0.78rem",
    cursor: "pointer",
    padding: 0,
    marginBottom: 6,
    transition: "color 0.15s var(--ease)",
  },
  titleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  projTitle: { fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 },
  projDesc: { color: "var(--text-dim)", fontSize: "0.84rem", margin: "6px 0 0" },

  // stats strip
  statsStrip: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    flexWrap: "wrap",
    rowGap: 10,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "12px 18px",
    marginBottom: 16,
    boxShadow: "var(--shadow-sm)",
  },
  statItem: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  statValue: { fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 600, lineHeight: 1 },
  statLabel: { fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", lineHeight: 1 },
  statDivider: { width: 1, height: 24, background: "var(--border)", margin: "0 18px" },
  completionWrap: { display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", flexShrink: 0 },
  completionTrack: { width: 120, height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" },
  completionFill: { height: "100%", borderRadius: 2 },
  completionPct: { fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-dim)", width: 32, textAlign: "right", flexShrink: 0 },

  // tasks toolbar (view toggle + table-view create button)
  tasksToolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 },
  viewToggle: { display: "flex", gap: 2, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 2 },
  viewToggleBtn: {
    border: "none",
    borderRadius: "var(--r-sm)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.78rem",
    fontWeight: 500,
    padding: "5px 12px",
    cursor: "pointer",
    transition: "all .15s var(--ease)",
  },

  // tabs
  tabBar: { display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0, marginBottom: 20 },
  tabBtn: {
    position: "relative",
    background: "none",
    border: "none",
    fontFamily: "var(--font-sans)",
    fontSize: "0.85rem",
    fontWeight: 500,
    padding: "10px 16px",
    cursor: "pointer",
    transition: "color 0.2s var(--ease)",
  },
  tabUnderline: { position: "absolute", left: 8, right: 8, bottom: -1, height: 2, background: "var(--signal)", borderRadius: 2 },
  tabRest: { flex: 1 },
  contentArea: {},
  tabContent: {},

  // settings tab — dedicated layout, not sharing tabContent's (empty, by
  // design) style so other tabs' existing internal layouts aren't affected.
  settingsTabContent: { display: "flex", flexDirection: "column", gap: 16 },
  settingsField: { display: "flex", flexDirection: "column", gap: 6 },
  settingsPrefixWarning: {
    fontSize: "0.76rem",
    lineHeight: 1.5,
    color: "var(--text-dim)",
    margin: "6px 0 0",
    maxWidth: 400,
  },

  // notes toolbar
  notesToolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--border)" },
  notesToolbarLabel: { fontFamily: "var(--font-mono)", fontSize: "0.66rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" },
  notesAddBtn: {
    background: "var(--signal)",
    border: "none",
    color: "var(--signal-ink)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.78rem",
    fontWeight: 600,
    borderRadius: "var(--r-md)",
    padding: "7px 14px",
    cursor: "pointer",
  },

  // note form
  noteForm: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "16px",
    marginBottom: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  noteFormHeader: { marginBottom: 2 },
  noteFormLabel: { fontFamily: "var(--font-mono)", fontSize: "0.64rem", letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-dim)" },
  noteFormFooter: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  noteFormCount: { fontFamily: "var(--font-mono)", fontSize: "0.64rem", color: "var(--text-dim)" },

  // notes list
  notesList: { display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" },
  noteCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", transition: "border-color 0.2s var(--ease)" },
  noteHeader: { display: "flex", alignItems: "center", gap: 0 },
  noteHeaderBtn: { flex: 1, background: "none", border: "none", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", cursor: "pointer", textAlign: "left", minWidth: 0 },
  noteChevron: { color: "var(--text-dim)", fontSize: "0.6rem", flexShrink: 0 },
  noteTitle: { color: "var(--text)", fontSize: "0.88rem", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },
  noteEdited: { color: "var(--brass)", fontFamily: "var(--font-mono)", fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--brass-soft)", borderRadius: "var(--r-sm)", padding: "1px 5px", flexShrink: 0 },
  noteAuthor: { color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "0.64rem", flexShrink: 0 },
  noteDate: { color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "0.62rem", flexShrink: 0 },
  noteActions: { display: "flex", alignItems: "center", gap: 2, paddingRight: 10, flexShrink: 0 },
  noteActionBtn: { background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "0.86rem", padding: "4px 7px", lineHeight: 1 },
  noteBody: { padding: "12px 16px 16px 36px", color: "var(--text-soft)", fontSize: "0.83rem", lineHeight: 1.7, borderTop: "1px solid var(--border)", whiteSpace: "pre-wrap" },

  // empty / error
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "48px 20px", color: "var(--text-dim)", fontSize: "0.84rem" },
  emptyIcon: { fontSize: 26, opacity: 0.4 },
  emptyAddBtn: {
    background: "var(--signal)",
    border: "none",
    color: "var(--signal-ink)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.8rem",
    fontWeight: 600,
    borderRadius: "var(--r-md)",
    padding: "8px 16px",
    cursor: "pointer",
    marginTop: 6,
  },
  errorState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 20px" },
  errorIcon: { color: "var(--danger)", fontSize: 22 },
  errorMsg: { color: "var(--text-dim)", fontSize: "0.84rem" },
  retryBtn: { background: "none", border: "1px solid var(--border)", color: "var(--text-soft)", fontFamily: "var(--font-sans)", fontSize: "0.8rem", borderRadius: "var(--r-md)", padding: "7px 14px", cursor: "pointer" },

  // skeleton
  skeletonCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 16 },
  skeletonLine: {
    height: 10,
    background: "linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)",
    backgroundSize: "200% auto",
    animation: "shimmer 1.5s linear infinite",
    borderRadius: 2,
  },

  // role badge (soft chip)
  roleBadge: { fontFamily: "var(--font-mono)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", borderRadius: "var(--r-sm)", padding: "3px 8px", whiteSpace: "nowrap" },
};
