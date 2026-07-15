import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { useTimeline } from "../../hooks/index.js";
import { Skeleton, Avatar, DueDateBadge } from "./primitive.jsx";
import { useToast } from "./Toast.jsx";
import { formatDate } from "../../utils/index.js";
import { EASE } from "../../motion/tokens";

// ─── timeline open/closed preference (per project, localStorage) ──────────────
// Same try/catch pattern as ProjectPage's TASK_VIEW_PREFIX — private browsing
// / full storage must never crash the page, just means it won't persist.
const TIMELINE_OPEN_PREFIX = "timelineOpen:";

function getStoredOpen(projectId) {
  try {
    return localStorage.getItem(TIMELINE_OPEN_PREFIX + projectId) === "true";
  } catch {
    return false;
  }
}

function setStoredOpen(projectId, open) {
  try {
    localStorage.setItem(TIMELINE_OPEN_PREFIX + projectId, String(open));
  } catch {
    /* storage unavailable — open/closed choice just won't persist */
  }
}

// ─── zoom levels (Phase 7) ──────────────────────────────────────────────────
// A global preference (not per-project) — a display density choice, not
// project-specific data.
const ZOOM_LEVELS = {
  day: { label: "Day", dayWidth: 48, windowLength: 14, daysBefore: 3 },
  week: { label: "Week", dayWidth: 34, windowLength: 28, daysBefore: 7 },
  month: { label: "Month", dayWidth: 14, windowLength: 90, daysBefore: 14 },
};
const DEFAULT_ZOOM = "week";
const ZOOM_STORAGE_KEY = "timelineZoom";

function getStoredZoom() {
  try {
    const v = localStorage.getItem(ZOOM_STORAGE_KEY);
    return ZOOM_LEVELS[v] ? v : DEFAULT_ZOOM;
  } catch {
    return DEFAULT_ZOOM;
  }
}

function setStoredZoom(zoom) {
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, zoom);
  } catch {
    /* storage unavailable — zoom choice just won't persist */
  }
}

// ─── narrow-width detector (mobile fallback, <768px per §4) ───────────────────
function useIsNarrow(breakpoint = 768) {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < breakpoint,
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (e) => setIsNarrow(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isNarrow;
}

// ─── date grid math ────────────────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_HEIGHT = 40;

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function shiftDate(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function buildDateWindow(windowLength, daysBefore) {
  const today = startOfDay(new Date());
  const first = new Date(today.getTime() - daysBefore * DAY_MS);
  return Array.from({ length: windowLength }, (_, i) => new Date(first.getTime() + i * DAY_MS));
}

// Day-index (0-based, may be negative or >= windowLength for out-of-range
// dates) of a task date relative to the window's first day.
function dayIndex(date, windowStart) {
  return Math.round((startOfDay(date).getTime() - windowStart.getTime()) / DAY_MS);
}

// dnd-kit KeyboardSensor default coordinate getter moves in ~25px increments,
// which doesn't line up with a day column — a custom getter makes one
// arrow-key press move exactly one day, matching the pointer-drag snap.
// dayWidth changes with zoom, so this reads a ref rather than closing over a
// fixed value (keeps one stable sensor instance across zoom changes).
function makeKeyboardCoordinateGetter(dayWidthRef) {
  return (event, { currentCoordinates }) => {
    switch (event.code) {
      case "ArrowRight":
        return { ...currentCoordinates, x: currentCoordinates.x + dayWidthRef.current };
      case "ArrowLeft":
        return { ...currentCoordinates, x: currentCoordinates.x - dayWidthRef.current };
      default:
        return undefined;
    }
  };
}

// ─── TimelineSection ────────────────────────────────────────────────────────
// Phase 3 (read-only grid) + Phase 4 (drag-to-reschedule/resize, drag from
// the unscheduled tray onto the grid) + Phase 5 (dependency creation) +
// Phase 6 (click-drag on empty grid space to create a task) + Phase 7
// (zoom levels, assignee/status filters). Collapsible panel below Board/
// Table, rendered inside ProjectPage's TasksTab.
export default function TimelineSection({ projectId, canManage = false }) {
  const [open, setOpen] = useState(() => getStoredOpen(projectId));
  const {
    tasks,
    loading,
    error,
    refetch,
    rescheduleTask,
    updateDependencies,
    createTask,
  } = useTimeline(projectId, { enabled: open });
  const { toast } = useToast();
  const isNarrow = useIsNarrow();
  const gridRef = useRef(null);
  const [linkPickerTaskId, setLinkPickerTaskId] = useState(null);
  const [zoom, setZoom] = useState(getStoredZoom);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [draftRange, setDraftRange] = useState(null); // { colStart, colEnd } — live drag preview
  const [pendingCreate, setPendingCreate] = useState(null); // { colStart, colEnd } — awaiting a title
  const draftStartColRef = useRef(0);

  const { dayWidth, windowLength, daysBefore } = ZOOM_LEVELS[zoom];
  const dayWidthRef = useRef(dayWidth);
  useEffect(() => {
    dayWidthRef.current = dayWidth;
  }, [dayWidth]);
  const keyboardCoordinateGetter = useMemo(() => makeKeyboardCoordinateGetter(dayWidthRef), []);

  // Cleans up the Phase 6 create-drag's window listeners if the component
  // unmounts mid-gesture (e.g. switching from the Tasks tab to Members/Notes
  // while still holding the pointer down) — otherwise the eventual pointerup
  // fires setState against an unmounted component and the listener leaks
  // until the window-level pointerup never comes.
  const gridGestureCleanupRef = useRef(null);
  useEffect(() => {
    return () => {
      gridGestureCleanupRef.current?.();
      gridGestureCleanupRef.current = null;
    };
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    setStoredOpen(projectId, next);
  };

  const handleZoomChange = (next) => {
    setZoom(next);
    setStoredZoom(next);
  };

  const dateWindow = useMemo(
    () => buildDateWindow(windowLength, daysBefore),
    [windowLength, daysBefore],
  );
  const windowStart = dateWindow[0];
  const todayIndex = dayIndex(new Date(), windowStart);

  const assigneeOptions = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (t.assignedTo?._id) {
        map.set(t.assignedTo._id, t.assignedTo.fullName || t.assignedTo.username);
      }
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [tasks]);

  // Filters apply to what's rendered on the grid/tray, not to dependency-link
  // candidates (LinkPickerPopover always sees the full `tasks` list) — you
  // should be able to link to any task in the project regardless of the
  // current filter view.
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterAssignee === "unassigned" && t.assignedTo) return false;
      if (
        filterAssignee !== "all" &&
        filterAssignee !== "unassigned" &&
        t.assignedTo?._id !== filterAssignee
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, filterStatus, filterAssignee]);

  const { scheduled, unscheduled } = useMemo(() => {
    const sched = [];
    const unsched = [];
    for (const t of filteredTasks) {
      if (t.dueDate) sched.push(t);
      else unsched.push(t);
    }
    sched.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return { scheduled: sched, unscheduled: unsched };
  }, [filteredTasks]);

  // Bars only render for tasks whose date range overlaps the visible window —
  // the fixed default view, not full free-form panning.
  const bars = useMemo(() => {
    return scheduled
      .map((t, i) => {
        const dueIdx = dayIndex(t.dueDate, windowStart);
        const startIdx = t.startDate ? dayIndex(t.startDate, windowStart) : dueIdx;
        const colStart = Math.max(0, Math.min(startIdx, dueIdx));
        const colEnd = Math.min(windowLength - 1, Math.max(startIdx, dueIdx));
        if (colEnd < 0 || colStart >= windowLength) return null; // fully out of window
        return { task: t, row: i, colStart, colEnd };
      })
      .filter(Boolean);
  }, [scheduled, windowStart, windowLength]);

  const barByTaskId = useMemo(() => {
    const map = new Map();
    bars.forEach((b) => map.set(b.task._id, b));
    return map;
  }, [bars]);

  // Dependency lines only draw between two bars that are both rendered in the
  // current window/filter — an edge to an off-screen or filtered-out task is
  // simply not drawn. Lines redraw after a drag/resize commits but don't
  // follow the bar frame-by-frame mid-gesture (P3 transition polish, plan
  // T11, deliberately deferred).
  const dependencyLines = useMemo(() => {
    const lines = [];
    for (const bar of bars) {
      for (const dep of bar.task.dependsOn || []) {
        const source = barByTaskId.get(dep._id);
        if (!source) continue;
        lines.push({ key: `${dep._id}->${bar.task._id}`, from: source, to: bar });
      }
    }
    return lines;
  }, [bars, barByTaskId]);

  const gridWidth = windowLength * dayWidth;
  const gridHeight = Math.max(1, bars.length) * ROW_HEIGHT;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinateGetter }),
  );

  const applyReschedule = async (task, updates) => {
    const result = await rescheduleTask(task._id, updates);
    if (!result.success) {
      toast(`Couldn't reschedule "${task.title}" — ${result.error}`, { kind: "danger" });
    }
  };

  // targetTaskId gets a new predecessor (newSourceId) added to its
  // dependsOn. The backend's cycle check runs server-side; on 409 the
  // ApiError message ("This would create a circular dependency") is
  // specific enough to surface as-is — matches the plan's "toast +
  // snap-back" spec, and updateDependencies() already rolls the optimistic
  // state back on any failure.
  const applyLinkDependency = async (targetTaskId, newSourceId) => {
    const targetTask = tasks.find((t) => t._id === targetTaskId);
    if (!targetTask) return;
    const currentIds = (targetTask.dependsOn || []).map((d) => d._id);
    if (currentIds.includes(newSourceId)) return;
    const result = await updateDependencies(targetTaskId, [...currentIds, newSourceId]);
    if (!result.success) {
      toast(result.error, { kind: "danger" });
    }
  };

  const removeDependencyLink = async (taskId, removeId) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;
    const nextIds = (task.dependsOn || []).map((d) => d._id).filter((id) => id !== removeId);
    const result = await updateDependencies(taskId, nextIds);
    if (!result.success) {
      toast(result.error, { kind: "danger" });
    }
  };

  const handleDragEnd = (event) => {
    const { active, delta, over } = event;
    const id = String(active.id);

    if (id.startsWith("link-")) {
      if (!over || !String(over.id).startsWith("bar-drop-")) return;
      const sourceTaskId = id.slice(5);
      const targetTaskId = String(over.id).slice(9);
      if (sourceTaskId === targetTaskId) return;
      applyLinkDependency(targetTaskId, sourceTaskId);
      return;
    }

    if (id.startsWith("bar-")) {
      const dayDelta = Math.round(delta.x / dayWidth);
      if (dayDelta === 0) return;
      const taskId = id.slice(4);
      const task = tasks.find((t) => t._id === taskId);
      if (!task) return;
      const newDue = shiftDate(task.dueDate, dayDelta);
      const updates = { dueDate: newDue.toISOString() };
      if (task.startDate) {
        updates.startDate = shiftDate(task.startDate, dayDelta).toISOString();
      }
      applyReschedule(task, updates);
      return;
    }

    if (id.startsWith("tray-")) {
      if (over?.id !== "grid-dropzone" || !gridRef.current) return;
      const taskId = id.slice(5);
      const task = tasks.find((t) => t._id === taskId);
      if (!task) return;
      const gridRect = gridRef.current.getBoundingClientRect();
      const translatedLeft = active.rect.current.translated?.left ?? gridRect.left;
      const offsetX = translatedLeft - gridRect.left;
      const dayIdx = Math.max(0, Math.min(windowLength - 1, Math.floor(offsetX / dayWidth)));
      const date = new Date(windowStart.getTime() + dayIdx * DAY_MS);
      applyReschedule(task, { startDate: date.toISOString(), dueDate: date.toISOString() });
    }
  };

  // Phase 6: click-drag on empty grid background creates a new task over
  // that date range. Guarded by target===currentTarget so clicking/dragging
  // an existing bar (a descendant) never triggers this.
  const handleGridPointerDown = (e) => {
    if (!canManage) return; // inline creation is manager-only, matches PATCH /schedule
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return;
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const clampCol = (x) => Math.max(0, Math.min(windowLength - 1, Math.floor((x - rect.left) / dayWidth)));
    const startCol = clampCol(e.clientX);
    draftStartColRef.current = startCol;
    setDraftRange({ colStart: startCol, colEnd: startCol });

    const onMove = (moveEvent) => {
      const col = clampCol(moveEvent.clientX);
      setDraftRange({
        colStart: Math.min(draftStartColRef.current, col),
        colEnd: Math.max(draftStartColRef.current, col),
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      gridGestureCleanupRef.current = null;
      setDraftRange((range) => {
        if (range) setPendingCreate(range);
        return null;
      });
    };
    gridGestureCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleCreateSubmit = async (title) => {
    if (!pendingCreate) return;
    const startDate = new Date(windowStart.getTime() + pendingCreate.colStart * DAY_MS);
    const dueDate = new Date(windowStart.getTime() + pendingCreate.colEnd * DAY_MS);
    const result = await createTask({
      title,
      startDate: startDate.toISOString(),
      dueDate: dueDate.toISOString(),
    });
    if (!result.success) {
      toast(`Couldn't create task — ${result.error}`, { kind: "danger" });
    }
    setPendingCreate(null);
  };

  return (
    <div style={S.wrap}>
      <button type="button" onClick={handleToggle} style={S.header}>
        <span style={S.chevron}>{open ? "▼" : "▶"}</span>
        <span style={S.headerLabel}>Timeline</span>
        {open && !loading && !error && (
          <span style={S.headerCount}>
            {scheduled.length} scheduled · {unscheduled.length} unscheduled
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <div style={S.body}>
              {loading && <TimelineSkeleton />}

              {!loading && error && (
                <div style={S.errorBanner}>
                  <span style={S.errorMsg}>{error}</span>
                  <button onClick={refetch} style={S.retryBtn}>
                    ↻ Retry
                  </button>
                </div>
              )}

              {!loading && !error && isNarrow && (
                <MobileTimelineList tasks={scheduled} unscheduled={unscheduled} />
              )}

              {!loading && !error && !isNarrow && (
                <>
                  <div style={S.toolbar}>
                    <div style={S.zoomToggle}>
                      {Object.entries(ZOOM_LEVELS).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => handleZoomChange(key)}
                          style={{
                            ...S.zoomBtn,
                            color: zoom === key ? "var(--text)" : "var(--text-dim)",
                            background: zoom === key ? "var(--surface-2)" : "transparent",
                          }}
                        >
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="input-field"
                      style={S.filterSelect}
                      aria-label="Filter by status"
                    >
                      <option value="all">All statuses</option>
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                    <select
                      value={filterAssignee}
                      onChange={(e) => setFilterAssignee(e.target.value)}
                      className="input-field"
                      style={S.filterSelect}
                      aria-label="Filter by assignee"
                    >
                      <option value="all">All assignees</option>
                      <option value="unassigned">Unassigned</option>
                      {assigneeOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <div style={S.gridScroll} className="scroll-area">
                      <GridDropzone gridRef={gridRef} width={gridWidth}>
                        <DateHeader dateWindow={dateWindow} todayIndex={todayIndex} dayWidth={dayWidth} />

                        <div
                          style={{
                            position: "relative",
                            height: gridHeight,
                            cursor: canManage ? "crosshair" : "default",
                          }}
                          onPointerDown={handleGridPointerDown}
                        >
                          {/* today column accent — the primary visual anchor */}
                          {todayIndex >= 0 && todayIndex < windowLength && (
                            <div
                              style={{
                                ...S.todayColumn,
                                left: todayIndex * dayWidth,
                                width: dayWidth,
                              }}
                            />
                          )}

                          {bars.length === 0 && !draftRange && (
                            <div style={S.emptyGridHint}>
                              Drag tasks from below onto the grid to schedule them, or
                              click-drag on an empty date range to create one.
                            </div>
                          )}

                          {bars.map((b) => (
                            <TimelineBar
                              key={b.task._id}
                              bar={b}
                              dayWidth={dayWidth}
                              canManage={canManage}
                              onReschedule={applyReschedule}
                              onOpenLinkPicker={setLinkPickerTaskId}
                            />
                          ))}

                          {draftRange && (
                            <div
                              style={{
                                ...S.draftBar,
                                left: draftRange.colStart * dayWidth,
                                top: bars.length * ROW_HEIGHT + 6,
                                width: (draftRange.colEnd - draftRange.colStart + 1) * dayWidth - 4,
                              }}
                            />
                          )}

                          <svg width={gridWidth} height={gridHeight} style={S.svgOverlay}>
                            {dependencyLines.map((line) => (
                              <DependencyPath key={line.key} from={line.from} to={line.to} dayWidth={dayWidth} />
                            ))}
                          </svg>

                          {linkPickerTaskId && barByTaskId.get(linkPickerTaskId) && (
                            <LinkPickerPopover
                              bar={barByTaskId.get(linkPickerTaskId)}
                              allTasks={tasks}
                              dayWidth={dayWidth}
                              onClose={() => setLinkPickerTaskId(null)}
                              onAdd={(sourceId) => applyLinkDependency(linkPickerTaskId, sourceId)}
                              onRemove={(removeId) => removeDependencyLink(linkPickerTaskId, removeId)}
                            />
                          )}

                          {pendingCreate && (
                            <CreateTaskPopover
                              range={pendingCreate}
                              row={bars.length}
                              dayWidth={dayWidth}
                              onCancel={() => setPendingCreate(null)}
                              onSubmit={handleCreateSubmit}
                            />
                          )}
                        </div>
                      </GridDropzone>
                    </div>

                    <UnscheduledTray tasks={unscheduled} canManage={canManage} />
                  </DndContext>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── grid dropzone wrapper ──────────────────────────────────────────────────
// The one drop target for tray → grid drags. Its bounding rect (via gridRef)
// is what a dropped tray chip's screen position gets measured against to
// compute which day column it landed on — also reused for the Phase 6
// click-drag-to-create pointer math.
function GridDropzone({ gridRef, width, children }) {
  const { setNodeRef } = useDroppable({ id: "grid-dropzone" });
  return (
    <div
      ref={(el) => {
        gridRef.current = el;
        setNodeRef(el);
      }}
      style={{ width }}
    >
      {children}
    </div>
  );
}

// ─── date header row ────────────────────────────────────────────────────────
function DateHeader({ dateWindow, todayIndex, dayWidth }) {
  return (
    <div style={S.dateHeader}>
      {dateWindow.map((d, i) => {
        const isToday = i === todayIndex;
        return (
          <div
            key={d.toISOString()}
            style={{
              ...S.dateCell,
              width: dayWidth,
              color: isToday ? "var(--signal-ink)" : "var(--text-dim)",
              background: isToday ? "var(--signal)" : "transparent",
              fontWeight: isToday ? 700 : 500,
            }}
          >
            <span style={S.dateCellDay}>{d.getDate()}</span>
            <span style={S.dateCellDow}>
              {d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── task bar — draggable (reschedule), resizable at both edges, and a
// connector handle for dependency creation (drag onto another bar, or
// click/Enter to open the non-drag "Depends on" picker) ────────────────────
function TimelineBar({ bar, dayWidth, canManage, onReschedule, onOpenLinkPicker }) {
  const { task, row, colStart, colEnd } = bar;
  const { toast } = useToast();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bar-${task._id}`,
    disabled: !canManage,
  });
  // The drop target (accepting an incoming dependency link) stays enabled
  // regardless of whether THIS viewer can manage — the drag SOURCE side is
  // what's gated, so a manager can still link into a bar even though that
  // bar itself doesn't render its own drag handles for a non-manager viewer.
  const { setNodeRef: setDropRef, isOver: isLinkDropTarget } = useDroppable({
    id: `bar-drop-${task._id}`,
  });
  const {
    listeners: linkListeners,
    setNodeRef: setLinkNodeRef,
    transform: linkTransform,
    isDragging: isLinking,
  } = useDraggable({ id: `link-${task._id}`, disabled: !canManage });
  // Local-only preview state for an in-progress resize — never derived from
  // `tasks`, so a prop update mid-gesture (e.g. someone else's edit landing
  // via refetch) can't clobber it. Cleared on pointerup either way.
  const [resize, setResize] = useState(null); // { edge: "start" | "end", deltaDays }
  // Cleans up the resize gesture's listeners if this bar unmounts mid-drag
  // (e.g. switching tabs, or the task getting filtered out mid-resize) —
  // same reasoning as the grid's create-drag cleanup in the parent.
  const resizeCleanupRef = useRef(null);
  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
    };
  }, []);

  const left = colStart * dayWidth;
  const baseWidth = Math.max((colEnd - colStart + 1) * dayWidth - 4, dayWidth - 4);
  const minWidth = dayWidth - 4;
  const maxShrinkDays = Math.floor((baseWidth - minWidth) / dayWidth);

  let renderLeft = left;
  let renderWidth = baseWidth;
  if (resize?.edge === "start") {
    const clamped = Math.min(resize.deltaDays, maxShrinkDays);
    renderLeft = left + clamped * dayWidth;
    renderWidth = baseWidth - clamped * dayWidth;
  } else if (resize?.edge === "end") {
    const clamped = Math.max(resize.deltaDays, -maxShrinkDays);
    renderWidth = baseWidth + clamped * dayWidth;
  }

  const dragTransformX = !resize && transform ? transform.x : 0;

  const commitResize = (edge, deltaDays) => {
    if (!deltaDays) return;
    if (edge === "start") {
      const base = task.startDate || task.dueDate;
      const newStart = shiftDate(base, deltaDays);
      if (newStart > new Date(task.dueDate)) {
        // Every other mutation path in this file surfaces failures via
        // toast — this guard was the one silent exception (the bar just
        // snapped back with no explanation, especially confusing on the
        // keyboard-arrow path where there's no live visual feedback).
        toast("Can't move the start date past the due date", { kind: "info" });
        return;
      }
      onReschedule(task, { startDate: newStart.toISOString() });
    } else {
      const newDue = shiftDate(task.dueDate, deltaDays);
      if (task.startDate && newDue < new Date(task.startDate)) {
        toast("Can't move the due date before the start date", { kind: "info" });
        return;
      }
      onReschedule(task, { dueDate: newDue.toISOString() });
    }
  };

  const startPointerResize = (edge) => (e) => {
    // Stop this from also triggering the bar's own dnd-kit drag (its
    // pointerdown listener is on the parent element these handles sit
    // inside) — resize and whole-bar-move are mutually exclusive gestures.
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    const onMove = (moveEvent) => {
      setResize({ edge, deltaDays: Math.round((moveEvent.clientX - startX) / dayWidth) });
    };
    const onUp = (upEvent) => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      resizeCleanupRef.current = null;
      const deltaDays = Math.round((upEvent.clientX - startX) / dayWidth);
      setResize(null);
      commitResize(edge, deltaDays);
    };
    resizeCleanupRef.current = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* already released or handle gone — nothing to clean up */
      }
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  const handleKeyResize = (edge) => (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      commitResize(edge, -1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      commitResize(edge, 1);
    }
  };

  const assigneeName = task.assignedTo?.fullName || task.assignedTo?.username;

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        setDropRef(el);
      }}
      {...attributes}
      {...listeners}
      style={{
        ...S.bar,
        left: renderLeft,
        top: row * ROW_HEIGHT + 6,
        width: renderWidth,
        transform: dragTransformX ? `translateX(${dragTransformX}px)` : undefined,
        cursor: !canManage ? "default" : isDragging ? "grabbing" : "grab",
        zIndex: isDragging || resize ? 5 : 1,
        boxShadow: isDragging || resize ? "var(--shadow-lg)" : S.bar.boxShadow,
        outline: isLinkDropTarget ? "2px solid var(--brass)" : "none",
        outlineOffset: 2,
        touchAction: "none",
      }}
      title={`${task.title} — ${formatDate(task.startDate || task.dueDate)} to ${formatDate(task.dueDate)}`}
    >
      {/* Resize + connector handles are manager-only (matches PATCH
          /schedule and /dependencies both being checkProjectRole-gated) —
          a member sees a read-only bar instead of drag affordances that
          would just 403. Resize handles: 44px-tall hit area (extends
          above/below the visibly thin edge via negative top/bottom offset)
          — width is capped by dayWidth itself, so a 44px-wide handle would
          swallow a whole 1-day bar at narrower zoom levels; 16px is the
          widest that still leaves room for a single-day task to remain
          draggable by its middle. */}
      {canManage && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Resize ${task.title} start date`}
          onPointerDown={startPointerResize("start")}
          onKeyDown={handleKeyResize("start")}
          style={{ ...S.resizeHandle, left: -6 }}
        />
      )}
      <span style={S.barTitle}>{task.title}</span>
      {assigneeName && <Avatar name={assigneeName} size={14} />}
      {/* Connector handle — drag onto another bar to link a dependency, or
          click/Enter for the non-drag "Depends on" picker (the accessible
          fallback per §4: connecting two arbitrary bars by keyboard-only
          drag isn't practical, so Enter opens the picker instead of
          starting a dnd-kit keyboard drag on this handle). */}
      {canManage && (
        <span
          ref={setLinkNodeRef}
          role="button"
          tabIndex={0}
          aria-label={`Link ${task.title} to another task`}
          onPointerDown={(e) => {
            e.stopPropagation();
            linkListeners?.onPointerDown?.(e);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenLinkPicker(task._id);
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenLinkPicker(task._id);
          }}
          style={{
            ...S.connectorHandle,
            transform: linkTransform ? `translate(${linkTransform.x}px, ${linkTransform.y}px)` : undefined,
            opacity: isLinking ? 0.6 : 1,
          }}
        />
      )}
      {canManage && (
      <span
        role="button"
        tabIndex={0}
        aria-label={`Resize ${task.title} due date`}
        onPointerDown={startPointerResize("end")}
        onKeyDown={handleKeyResize("end")}
        style={{ ...S.resizeHandle, right: -6 }}
      />
      )}
    </div>
  );
}

// ─── dependency link picker (non-drag fallback, §4) ────────────────────────
function LinkPickerPopover({ bar, allTasks, dayWidth, onClose, onAdd, onRemove }) {
  const { task, row, colStart } = bar;
  const currentIds = new Set((task.dependsOn || []).map((d) => d._id));
  const candidates = allTasks.filter((t) => t._id !== task._id && !currentIds.has(t._id));

  return (
    <div
      role="dialog"
      aria-label={`Dependencies for ${task.title}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      style={{
        ...S.linkPicker,
        left: Math.max(0, colStart * dayWidth),
        top: row * ROW_HEIGHT + ROW_HEIGHT + 4,
      }}
    >
      <div style={S.linkPickerHeader}>
        <span style={S.linkPickerTitle}>Depends on</span>
        <button onClick={onClose} style={S.linkPickerClose} aria-label="Close">
          ×
        </button>
      </div>

      {(task.dependsOn || []).length === 0 ? (
        <span style={S.trayEmpty}>No dependencies yet.</span>
      ) : (
        <ul style={S.linkPickerList}>
          {task.dependsOn.map((dep) => (
            <li key={dep._id} style={S.linkPickerItem}>
              <span>{dep.title}</span>
              <button
                onClick={() => onRemove(dep._id)}
                style={S.linkPickerClose}
                aria-label={`Remove dependency on ${dep.title}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onAdd(e.target.value);
        }}
        className="input-field"
        style={S.linkPickerSelect}
      >
        <option value="">+ Add dependency…</option>
        {candidates.map((t) => (
          <option key={t._id} value={t._id}>
            {t.title}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── inline task-creation popover (Phase 6) ────────────────────────────────
function CreateTaskPopover({ range, row, dayWidth, onCancel, onSubmit }) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const canSubmit = title.trim().length >= 3 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit(title.trim());
    setSubmitting(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Create task"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter") submit();
      }}
      style={{
        ...S.linkPicker,
        left: Math.max(0, range.colStart * dayWidth),
        top: row * ROW_HEIGHT + ROW_HEIGHT + 4,
      }}
    >
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title…"
        className="input-field"
        maxLength={150}
      />
      <div style={S.createPopoverActions}>
        <button onClick={onCancel} style={S.linkPickerClose}>
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{ ...S.createSubmitBtn, opacity: canSubmit ? 1 : 0.5 }}
        >
          {submitting ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  );
}

// ─── dependency line (static — line follow-during-drag is P3 polish) ──────
function DependencyPath({ from, to, dayWidth }) {
  const fromX = (from.colEnd + 1) * dayWidth;
  const fromY = from.row * ROW_HEIGHT + ROW_HEIGHT / 2;
  const toX = to.colStart * dayWidth;
  const toY = to.row * ROW_HEIGHT + ROW_HEIGHT / 2;
  const midX = fromX + Math.max(8, (toX - fromX) / 2);

  // Elbow connector (circuit-trace styling), not a soft curve — the
  // deliberate on-brand divergence called out in §4.
  const d = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;

  return <path d={d} className="timeline-dependency-path" fill="none" />;
}

// ─── unscheduled tray ───────────────────────────────────────────────────────
// Horizontal strip below the grid (Layout decision, §4). Always rendered —
// on a fresh project this IS the "expanded by default" empty state the
// interaction-state table requires. Chips are draggable onto the grid.
function UnscheduledTray({ tasks, canManage }) {
  return (
    <div style={S.tray}>
      <span style={S.trayLabel}>Unscheduled ({tasks.length})</span>
      {tasks.length === 0 ? (
        <span style={S.trayEmpty}>Every task has a date.</span>
      ) : (
        <div style={S.trayList}>
          {tasks.map((t) => (
            <TrayChip key={t._id} task={t} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrayChip({ task, canManage }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    disabled: !canManage,
    id: `tray-${task._id}`,
  });
  return (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={task.title}
      style={{
        ...S.trayChip,
        cursor: canManage ? "grab" : "default",
        opacity: isDragging ? 0.5 : 1,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        touchAction: "none",
        zIndex: isDragging ? 10 : "auto",
      }}
    >
      {task.title}
    </span>
  );
}

// ─── mobile fallback (<768px) ───────────────────────────────────────────────
// Read-only list sorted by date, reusing TaskTable's row visual language
// instead of attempting the drag/zoom grid on a touch-narrow viewport — no
// drag here even for unscheduled tasks, matches the plan's mobile fallback.
function MobileTimelineList({ tasks, unscheduled }) {
  if (tasks.length === 0 && unscheduled.length === 0) {
    return <div style={S.trayEmpty}>No tasks yet.</div>;
  }
  return (
    <div style={S.mobileList}>
      {tasks.map((t) => (
        <div key={t._id} style={S.mobileRow}>
          <div style={S.mobileRowTop}>
            <span style={S.mobileRowTitle}>{t.title}</span>
            <DueDateBadge task={t} />
          </div>
          <span style={S.mobileRowDate}>
            {formatDate(t.startDate || t.dueDate)} → {formatDate(t.dueDate)}
          </span>
        </div>
      ))}
      {unscheduled.length > 0 && (
        <div style={S.mobileUnscheduled}>
          <span style={S.trayLabel}>Unscheduled ({unscheduled.length})</span>
          <div style={S.trayList}>
            {unscheduled.map((t) => (
              <span key={t._id} style={S.trayChip}>
                {t.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── loading skeleton ───────────────────────────────────────────────────────
function TimelineSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0" }}>
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} width={`${70 - i * 10}%`} height={24} />
      ))}
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────
const S = {
  wrap: {
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    background: "var(--surface)",
    marginTop: 12,
    flexShrink: 0,
  },
  header: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "none",
    border: "none",
    padding: "10px 14px",
    cursor: "pointer",
    textAlign: "left",
  },
  chevron: { color: "var(--text-dim)", fontSize: "0.6rem", flexShrink: 0 },
  headerLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "var(--text)",
  },
  headerCount: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.66rem",
    color: "var(--text-dim)",
    marginLeft: "auto",
  },
  body: { padding: "0 14px 14px" },

  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: "var(--r-md)",
    background: "var(--danger-soft)",
    border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)",
  },
  errorMsg: { fontSize: "0.82rem", color: "var(--danger)", flex: 1 },
  retryBtn: {
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--text-soft)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.76rem",
    borderRadius: "var(--r-sm)",
    padding: "4px 10px",
    cursor: "pointer",
    flexShrink: 0,
  },

  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  zoomToggle: {
    display: "flex",
    gap: 2,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: 2,
  },
  zoomBtn: {
    border: "none",
    borderRadius: "var(--r-sm)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.74rem",
    fontWeight: 500,
    padding: "4px 10px",
    cursor: "pointer",
    transition: "all .15s var(--ease)",
  },
  filterSelect: { fontSize: "0.76rem", padding: "5px 8px", width: "auto" },

  gridScroll: {
    overflowX: "auto",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    background: "var(--surface-2)",
  },
  dateHeader: { display: "flex" },
  dateCell: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 0",
    fontFamily: "var(--font-mono)",
    fontSize: "0.66rem",
    borderRight: "1px solid var(--border)",
    borderBottom: "1px solid var(--border)",
  },
  dateCellDay: { lineHeight: 1.2 },
  dateCellDow: { fontSize: "0.56rem", opacity: 0.8, textTransform: "uppercase" },
  todayColumn: {
    position: "absolute",
    top: 0,
    bottom: 0,
    background: "var(--signal-soft)",
    pointerEvents: "none",
  },
  svgOverlay: { position: "absolute", top: 0, left: 0, pointerEvents: "none" },
  emptyGridHint: {
    position: "absolute",
    top: 8,
    left: 8,
    fontSize: "0.78rem",
    color: "var(--text-dim)",
    fontStyle: "italic",
    pointerEvents: "none",
    maxWidth: "80%",
  },
  draftBar: {
    position: "absolute",
    height: ROW_HEIGHT - 12,
    borderRadius: "var(--r-md)",
    background: "var(--signal-soft)",
    border: "1.5px dashed var(--signal)",
    pointerEvents: "none",
  },
  bar: {
    position: "absolute",
    height: ROW_HEIGHT - 12,
    borderRadius: "var(--r-md)",
    background: "var(--panel)",
    border: "1px solid var(--border-hi)",
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 10px",
    overflow: "visible",
    boxShadow: "var(--shadow-sm)",
    transition: "box-shadow .15s var(--ease)",
  },
  barTitle: {
    fontSize: "0.72rem",
    color: "var(--text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    flex: 1,
  },
  resizeHandle: {
    position: "absolute",
    top: -8,
    bottom: -8,
    width: 16,
    cursor: "ew-resize",
    touchAction: "none",
  },
  connectorHandle: {
    flexShrink: 0,
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "var(--brass)",
    border: "2px solid var(--panel)",
    cursor: "grab",
    touchAction: "none",
  },

  linkPicker: {
    position: "absolute",
    zIndex: 20,
    width: 220,
    padding: 10,
    borderRadius: "var(--r-md)",
    background: "var(--panel-hi)",
    border: "1px solid var(--border-hi)",
    boxShadow: "var(--shadow-xl)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  linkPickerHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  linkPickerTitle: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.64rem",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
  },
  linkPickerClose: {
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    cursor: "pointer",
    fontSize: "0.9rem",
    lineHeight: 1,
    padding: "0 2px",
  },
  linkPickerList: { display: "flex", flexDirection: "column", gap: 4, margin: 0, padding: 0, listStyle: "none" },
  linkPickerItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "0.78rem",
    color: "var(--text)",
    background: "var(--surface-2)",
    borderRadius: "var(--r-sm)",
    padding: "4px 8px",
  },
  linkPickerSelect: { fontSize: "0.78rem" },

  createPopoverActions: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  createSubmitBtn: {
    background: "var(--signal)",
    border: "none",
    color: "var(--signal-ink)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.78rem",
    fontWeight: 600,
    borderRadius: "var(--r-sm)",
    padding: "5px 12px",
    cursor: "pointer",
  },

  tray: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: "var(--r-md)",
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
  },
  trayLabel: {
    display: "block",
    fontFamily: "var(--font-mono)",
    fontSize: "0.64rem",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
    marginBottom: 8,
  },
  trayEmpty: { fontSize: "0.78rem", color: "var(--text-dim)", fontStyle: "italic" },
  trayList: { display: "flex", flexWrap: "wrap", gap: 6 },
  trayChip: {
    fontSize: "0.76rem",
    color: "var(--text-soft)",
    background: "var(--panel)",
    border: "1px solid var(--border-hi)",
    borderRadius: "var(--r-sm)",
    padding: "4px 9px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 220,
    cursor: "grab",
    display: "inline-block",
  },

  mobileList: { display: "flex", flexDirection: "column", gap: 8 },
  mobileRow: {
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "8px 10px",
    background: "var(--surface-2)",
  },
  mobileRowTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  mobileRowTitle: { fontSize: "0.83rem", color: "var(--text)", fontWeight: 500 },
  mobileRowDate: { fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--text-dim)" },
  mobileUnscheduled: { marginTop: 6 },
};
