// ─── CLASSNAMES HELPER ────────────────────────────────────────────────────────
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
export function getAvatarInitials(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarSeed(str = "") {
  // Deterministic color seed 0–4 from string
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 5;
}

// ─── DATE ─────────────────────────────────────────────────────────────────────
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelative(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date; // ms

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── STATUS ───────────────────────────────────────────────────────────────────
export const STATUS_LABELS = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
};

export const STATUS_BADGE_CLASS = {
  todo: "badge-todo",
  in_progress: "badge-progress",
  done: "badge-done",
};

export const STATUS_BAR_CLASS = {
  todo: "status-bar-todo",
  in_progress: "status-bar-progress",
  done: "status-bar-done",
};

export const ROLE_BADGE_CLASS = {
  admin: "badge-admin",
  project_admin: "badge-project-admin",
  member: "badge-member",
};

export const ROLE_LABELS = {
  admin: "Admin",
  project_admin: "Proj. Admin",
  member: "Member",
};

// ─── FILE SIZE ────────────────────────────────────────────────────────────────
export function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

// ─── DUE DATE STATUS ──────────────────────────────────────────────────────────
// "overdue" | "due_soon" | null. Client-local timezone (Date.now(), the
// viewer's browser clock) — matches how every other timestamp in this app
// already renders; not server time or an org-level timezone setting.
export function getDueDateStatus(task) {
  if (!task?.dueDate || task.status === "done") return null;

  const dueMs = new Date(task.dueDate).getTime();
  const hoursUntilDue = (dueMs - Date.now()) / (1000 * 60 * 60);

  if (hoursUntilDue < 0) return "overdue";
  if (hoursUntilDue <= 48) return "due_soon";
  return null;
}

// ─── TASK PROGRESS ────────────────────────────────────────────────────────────
export function getTaskProgress(subtasks = []) {
  if (!subtasks.length) return null;
  const done = subtasks.filter((s) => s.isCompleted).length;
  return {
    done,
    total: subtasks.length,
    pct: Math.round((done / subtasks.length) * 100),
  };
}

// ─── GROUP TASKS BY STATUS ────────────────────────────────────────────────────
export function groupTasksByStatus(tasks = []) {
  return {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "done"),
  };
}

// ─── TRUNCATE ─────────────────────────────────────────────────────────────────
export function truncate(str = "", len = 80) {
  if (str.length <= len) return str;
  return str.slice(0, len) + "…";
}

// ─── MIME TYPE ICON ───────────────────────────────────────────────────────────
export function getMimeIcon(mimeType = "") {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "📦";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  return "📎";
}

// ─── DEBOUNCE ─────────────────────────────────────────────────────────────────
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─── GENERATE TEMP ID ─────────────────────────────────────────────────────────
export function tempId() {
  return `tmp_${Math.random().toString(36).slice(2, 9)}`;
}
