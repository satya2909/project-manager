import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";
import TaskCard from "./TaskCard";

const COLUMNS = [
  { id: "todo", label: "TODO", code: "T-01" },
  { id: "in_progress", label: "IN PROGRESS", code: "T-02" },
  { id: "done", label: "DONE", code: "T-03" },
];

const COLUMN_COLORS = {
  todo: "var(--muted)",
  in_progress: "var(--amber)",
  done: "var(--phosphor)",
};

// ─── group helper ─────────────────────────────────────────────────────────────
function groupByStatus(tasks = []) {
  const grouped = { todo: [], in_progress: [], done: [] };
  tasks.forEach((t) => {
    if (grouped[t.status]) grouped[t.status].push(t);
  });
  return grouped;
}

// ─── DroppableColumn ──────────────────────────────────────────────────────────
function DroppableColumn({ column, tasks, onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const taskIds = tasks.map((t) => t._id);

  return (
    <motion.div
      animate={{
        borderColor: isOver ? COLUMN_COLORS[column.id] : "var(--border)",
        boxShadow: isOver
          ? `0 0 20px ${
              column.id === "todo"
                ? "rgba(120,120,120,0.15)"
                : column.id === "in_progress"
                  ? "rgba(245, 166, 35, 0.15)"
                  : "rgba(0, 217, 126, 0.15)"
            }`
          : "none",
      }}
      transition={{ duration: 0.15 }}
      style={{
        ...colStyles.column,
        borderColor: isOver ? COLUMN_COLORS[column.id] : "var(--border)",
      }}
    >
      <ColumnHeader column={column} count={tasks.length} isOver={isOver} />

      <div ref={setNodeRef} style={colStyles.dropZone}>
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <AnimatePresence>
            {tasks.map((task, i) => (
              <motion.div
                key={task._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
              >
                <TaskCard task={task} onClick={() => onTaskClick?.(task)} />
              </motion.div>
            ))}
          </AnimatePresence>

          {tasks.length === 0 && (
            <div style={{ ...colStyles.emptyState, opacity: isOver ? 0.8 : 0.3 }}>
              <div style={colStyles.emptyIcon}>◫</div>
              <span>DROP TASKS HERE</span>
            </div>
          )}
        </SortableContext>
      </div>
    </motion.div>
  );
}

// ─── ColumnHeader ─────────────────────────────────────────────────────────────
function ColumnHeader({ column, count, isOver }) {
  const [hovered, setHovered] = useState(false);
  const showSweep = hovered || isOver;

  return (
    <div
      style={colStyles.header}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={colStyles.headerLeft}>
        <span
          style={{
            ...colStyles.headerDot,
            background: COLUMN_COLORS[column.id],
            boxShadow: `0 0 6px ${COLUMN_COLORS[column.id]}`,
          }}
        />
        <span
          style={{ ...colStyles.headerLabel, color: COLUMN_COLORS[column.id] }}
        >
          {column.label}
        </span>
        <span style={colStyles.headerCode}>{column.code}</span>
      </div>
      <span
        style={{ ...colStyles.headerCount, color: COLUMN_COLORS[column.id] }}
      >
        {String(count).padStart(2, "0")}
      </span>

      {showSweep && (
        <motion.div
          key="sweep"
          initial={{ x: "-100%" }}
          animate={{ x: "200%" }}
          transition={{ duration: 0.6, ease: "linear" }}
          style={colStyles.headerSweep}
        />
      )}
    </div>
  );
}

// ─── KanbanBoard ──────────────────────────────────────────────────────────────
export default function KanbanBoard({
  tasks = [],
  onTaskMove,
  onTaskClick,
  onCreateTask,
}) {
  const [items, setItems] = useState(() => groupByStatus(tasks));
  const [activeTask, setActiveTask] = useState(null);

  // Guard: don't sync from props while a drag is in progress — it would
  // teleport the card back to its original column mid-gesture.
  const isDragging = useRef(false);

  // The column a card started in when the drag began. handleDragOver mutates
  // `items` mid-gesture (moving the card + rewriting its status), so by drop
  // time `items` no longer knows where the card came from. We capture the
  // origin here so handleDragEnd can reliably detect a cross-column move and
  // persist it — otherwise the move lives only in local state and reverts on
  // the next tasks-prop change (e.g. creating a task).
  const dragOrigin = useRef(null);

  // ── THE FIX: sync items whenever the tasks prop changes ───────────────────
  // This is what was missing. The original lazy useState initialiser only ran
  // once at mount, so when useTasks resolved asynchronously the board stayed
  // empty forever. useEffect with [tasks] re-groups on every tasks update,
  // but only when no drag is active (isDragging guard).
  useEffect(() => {
    if (isDragging.current) return;
    setItems(groupByStatus(tasks));
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findColumnOfTask = useCallback(
    (taskId) => {
      return Object.entries(items).find(([, ts]) =>
        ts.some((t) => t._id === taskId),
      )?.[0];
    },
    [items],
  );

  const handleDragStart = ({ active }) => {
    isDragging.current = true;
    const colId = findColumnOfTask(active.id);
    dragOrigin.current = colId ?? null;
    if (colId) {
      const task = items[colId].find((t) => t._id === active.id);
      setActiveTask(task);
    }
  };

  const handleDragOver = ({ active, over }) => {
    if (!over) return;
    const fromCol = findColumnOfTask(active.id);
    const toCol = COLUMNS.find((c) => c.id === over.id)
      ? over.id
      : findColumnOfTask(over.id);

    if (!fromCol || !toCol || fromCol === toCol) return;

    setItems((prev) => {
      const sourceItems = [...prev[fromCol]];
      const destItems = [...prev[toCol]];
      const taskIndex = sourceItems.findIndex((t) => t._id === active.id);
      const [moved] = sourceItems.splice(taskIndex, 1);
      const updatedTask = { ...moved, status: toCol };
      destItems.push(updatedTask);
      return { ...prev, [fromCol]: sourceItems, [toCol]: destItems };
    });
  };

  const handleDragEnd = ({ active, over }) => {
    // Mark drag as finished — future tasks prop updates can now sync again
    isDragging.current = false;
    setActiveTask(null);

    // The column the card started in — captured at drag start, before
    // handleDragOver mutated `items`. This is our source of truth for whether
    // a real cross-column move happened.
    const fromCol = dragOrigin.current;
    dragOrigin.current = null;

    if (!over) return;

    const toCol = COLUMNS.find((c) => c.id === over.id)
      ? over.id
      : findColumnOfTask(over.id);

    if (!fromCol || !toCol) return;

    if (fromCol === toCol) {
      setItems((prev) => {
        const col = [...prev[fromCol]];
        const oldIdx = col.findIndex((t) => t._id === active.id);
        const newIdx = col.findIndex((t) => t._id === over.id);
        if (oldIdx === -1 || newIdx === -1) return prev;
        return { ...prev, [fromCol]: arrayMove(col, oldIdx, newIdx) };
      });
      return;
    }

    // Cross-column move: the card's new column differs from where it started,
    // so persist the status change. `items` already shows it in the
    // destination (from handleDragOver), which is why we compare against the
    // captured origin column rather than the mutated items.
    onTaskMove?.(active.id, toCol);
  };

  const handleDragCancel = () => {
    // Drag cancelled (e.g. Escape key): release the guard and re-sync
    isDragging.current = false;
    dragOrigin.current = null;
    setActiveTask(null);
    setItems(groupByStatus(tasks));
  };

  const totalTasks = Object.values(items).flat().length;

  return (
    <div style={boardStyles.root}>
      {/* Board header */}
      <div style={boardStyles.boardHeader}>
        <div style={boardStyles.boardTitle}>
          <span style={boardStyles.boardTitleText}>TASK MATRIX</span>
          <span style={boardStyles.boardCount}>[{totalTasks} TOTAL]</span>
        </div>
        <button onClick={onCreateTask} style={boardStyles.addBtn}>
          + NEW TASK
        </button>
      </div>

      {/* Kanban grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div style={boardStyles.grid}>
          {COLUMNS.map((col) => (
            <DroppableColumn
              key={col.id}
              column={col}
              tasks={items[col.id] || []}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div style={{ transform: "rotate(3deg)", opacity: 0.95 }}>
              <TaskCard task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const boardStyles = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    gap: 16,
  },
  boardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  boardTitle: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
  },
  boardTitleText: {
    color: "var(--text)",
    fontFamily: "var(--font-display)",
    fontSize: 18,
    letterSpacing: 3,
  },
  boardCount: {
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 2,
  },
  addBtn: {
    background: "linear-gradient(135deg, rgba(0, 217, 126, 0.15), rgba(0, 191, 120, 0.08))",
    border: "1px solid rgba(0, 217, 126, 0.3)",
    borderRadius: "var(--r-lg)",
    color: "var(--phosphor)",
    fontFamily: "var(--font-sans)",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 1,
    padding: "10px 18px",
    cursor: "pointer",
    transition: "all 160ms cubic-bezier(0.16, 1, 0.3, 1)",
  },
  addBtn_hover: {
    background: "linear-gradient(135deg, rgba(0, 217, 126, 0.25), rgba(0, 191, 120, 0.15))",
    border: "1px solid rgba(0, 217, 126, 0.5)",
    boxShadow: "0 4px 12px rgba(0, 217, 126, 0.2)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    flex: 1,
    overflow: "hidden",
    minHeight: 0,
  },
};

const colStyles = {
  column: {
    background: "var(--surface)",
    borderRadius: "var(--r-md)",
    border: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    transition: "border-color 0.15s",
  },
  header: {
    padding: "12px 14px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    cursor: "default",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
  },
  headerLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 600,
  },
  headerCode: {
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 1,
    background: "rgba(255,255,255,0.04)",
    padding: "2px 6px",
    borderRadius: "3px",
  },
  headerCount: {
    fontFamily: "var(--font-mono)",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  headerSweep: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "40%",
    height: "100%",
    background:
      "linear-gradient(90deg, transparent, rgba(0, 217, 126, 0.08), transparent)",
    pointerEvents: "none",
  },
  dropZone: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 10px",
    minHeight: 120,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 40,
    color: "var(--muted)",
    fontFamily: "var(--font-sans)",
    fontSize: 10,
    letterSpacing: 1,
    transition: "opacity 0.15s",
  },
  emptyIcon: {
    fontSize: 28,
    opacity: 0.5,
  },
};