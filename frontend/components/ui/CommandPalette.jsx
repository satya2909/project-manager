import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, LayoutGrid, CheckSquare, Users, Plus, FolderOpenDot } from "lucide-react";
import { EASE } from "../../motion/tokens";
import { useMyTasks } from "../../hooks/index.js";
import { Kbd } from "./primitive.jsx";

const GROUP_ORDER = ["Actions", "Projects", "Tasks"];

// Inner content — only mounted while the palette is open, so useMyTasks fetches
// on first open rather than on every app load.
function PaletteContent({ projects, onOpenProject, onNavigate, onCreateProject, canCreateProject, isOrgManager, close }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const { tasks } = useMyTasks();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 40);
  }, []);

  const commands = useMemo(() => {
    const list = [];
    list.push({ group: "Actions", id: "go-dashboard", label: "Go to Dashboard", icon: LayoutGrid, run: () => onNavigate("dashboard") });
    list.push({ group: "Actions", id: "go-tasks", label: "Go to My Tasks", icon: CheckSquare, run: () => onNavigate("tasks") });
    if (isOrgManager)
      list.push({ group: "Actions", id: "go-org", label: "Go to Organization", icon: Users, run: () => onNavigate("organization") });
    if (canCreateProject)
      list.push({ group: "Actions", id: "new-project", label: "Create new project", icon: Plus, run: () => onCreateProject() });

    projects.forEach((p) =>
      list.push({ group: "Projects", id: "p-" + p._id, label: p.name, icon: FolderOpenDot, run: () => onOpenProject(p) }),
    );

    tasks.forEach((t) => {
      const pid = String(t.project?._id || t.project || "");
      const proj = projects.find((p) => String(p._id) === pid);
      if (proj)
        list.push({ group: "Tasks", id: "t-" + t._id, label: t.title, hint: proj.name, icon: CheckSquare, run: () => onOpenProject(proj) });
    });
    return list;
  }, [projects, tasks, isOrgManager, canCreateProject, onNavigate, onOpenProject, onCreateProject]);

  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q))
      : commands;
    return [...filtered].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  }, [commands, query]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const run = (cmd) => {
    if (!cmd) return;
    cmd.run();
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => (ordered.length ? (s + 1) % ordered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => (ordered.length ? (s - 1 + ordered.length) % ordered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(ordered[selected]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  // group boundaries for rendering headers
  let lastGroup = null;

  return (
    <>
      <div style={S.inputWrap}>
        <Search size={16} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a project, task, or action…"
          style={S.input}
          aria-label="Command palette search"
        />
        <Kbd>Esc</Kbd>
      </div>

      <div style={S.list} className="scroll-area">
        {ordered.length === 0 && (
          <div style={S.empty}>
            <span>No matches for “{query}”</span>
            {canCreateProject && (
              <button style={S.createRow} onClick={() => run({ run: onCreateProject })}>
                <Plus size={15} style={{ color: "var(--signal)" }} /> Create a new project
              </button>
            )}
          </div>
        )}

        {ordered.map((cmd, i) => {
          const showHeader = cmd.group !== lastGroup;
          lastGroup = cmd.group;
          const active = i === selected;
          const Icon = cmd.icon;
          return (
            <div key={cmd.id}>
              {showHeader && <div style={S.groupLabel}>{cmd.group}</div>}
              <button
                style={{ ...S.item, background: active ? "var(--surface-2)" : "transparent", color: active ? "var(--text)" : "var(--text-soft)" }}
                onMouseEnter={() => setSelected(i)}
                onClick={() => run(cmd)}
              >
                {Icon && <Icon size={15} style={{ color: "var(--text-dim)", flexShrink: 0 }} />}
                <span style={S.itemLabel}>{cmd.label}</span>
                {cmd.hint && <span style={S.itemHint}>{cmd.hint}</span>}
                {active && <span style={S.enter}>↵</span>}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function CommandPalette({
  open,
  setOpen,
  projects = [],
  onOpenProject,
  onNavigate,
  onCreateProject,
  canCreateProject,
  isOrgManager,
}) {
  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const close = () => setOpen(false);
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          onMouseDown={close}
          style={S.veil}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.28, ease: EASE }}
            onMouseDown={(e) => e.stopPropagation()}
            style={S.panel}
          >
            <PaletteContent
              projects={projects}
              onOpenProject={onOpenProject}
              onNavigate={onNavigate}
              onCreateProject={onCreateProject}
              canCreateProject={canCreateProject}
              isOrgManager={isOrgManager}
              close={close}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const S = {
  veil: {
    position: "fixed",
    inset: 0,
    background: "rgba(6,7,8,.7)",
    backdropFilter: "blur(3px)",
    zIndex: 1500,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "14vh",
  },
  panel: {
    width: 540,
    maxWidth: "92vw",
    background: "var(--panel)",
    border: "1px solid var(--border-hi)",
    borderRadius: "var(--r-lg)",
    boxShadow: "var(--shadow-xl)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    maxHeight: "70vh",
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 16px",
    borderBottom: "1px solid var(--border)",
  },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.95rem",
  },
  list: { padding: 8, overflowY: "auto" },
  groupLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.62rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--muted)",
    padding: "8px 10px 4px",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "9px 10px",
    border: "none",
    borderRadius: "var(--r-sm)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.85rem",
    cursor: "pointer",
    textAlign: "left",
  },
  itemLabel: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  itemHint: { fontFamily: "var(--font-mono)", fontSize: "0.66rem", color: "var(--text-dim)", flexShrink: 0 },
  enter: { fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-dim)", flexShrink: 0 },
  empty: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "flex-start",
    padding: "24px 16px",
    color: "var(--text-dim)",
    fontSize: "0.85rem",
  },
  createRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "8px 12px",
    color: "var(--text)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.83rem",
    cursor: "pointer",
    width: "100%",
  },
};
