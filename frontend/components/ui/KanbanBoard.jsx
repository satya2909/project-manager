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
import { Button } from "./primitive.jsx";
import { EASE } from "../../motion/tokens";

const COLUMNS = [
  { id: "todo", label: "To do", dot: "var(--muted)" },
  { id: "in_progress", label: "In progress", dot: "var(--brass)" },
  { id: "done", label: "Done", dot: "var(--signal)" },
];

// ─── group helper ───────────────────────────────────────────────────────────────
function groupByStatus(tasks = []) {
  const grouped = { todo: [], in_progress: [], done: [] };
  tasks.forEach((t) => {
    if (grouped[t.status]) grouped[t.status].push(t);
  });
  return grouped;
}

// ─── RollingCount — counter re-tallies immediately on change ────────────────────
function RollingCount({ count }) {
  return (
    <span style={S.count}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={count}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          style={{ display: "inline-block" }}
        >
          {String(count).padStart(2, "0")}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ─── DroppableColumn ────────────────────────────────────────────────────────────
function DroppableColumn({ column, tasks, onTaskClick, onToggleComplete }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const taskIds = tasks.map((t) => t._id);

  return (
    <div
      style={{
        ...S.column,
        borderColor: isOver ? "var(--signal)" : "var(--border)",
        background: isOver ? "var(--signal-soft)" : "var(--surface)",
      }}
    >
      <div style={S.colHead}>
        <span style={{ ...S.dot, background: column.dot }} />
        <span style={S.colLabel}>{column.label}</span>
        <RollingCount count={tasks.length} />
      </div>

      <div ref={setNodeRef} style={S.dropZone} className="scroll-area">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <motion.div
                key={task._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <TaskCard
                  task={task}
                  onClick={() => onTaskClick?.(task)}
                  onToggleComplete={onToggleComplete}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {tasks.length === 0 && (
            <div style={{ ...S.empty, borderColor: isOver ? "var(--signal-line)" : "var(--border)" }}>
              {isOver ? "Drop here" : "No tasks"}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// ─── KanbanBoard ────────────────────────────────────────────────────────────────
export default function KanbanBoard({
  tasks = [],
  onTaskMove,
  onTaskClick,
  onCreateTask,
  canCreate = true,
}) {
  const [items, setItems] = useState(() => groupByStatus(tasks));
  const [activeTask, setActiveTask] = useState(null);

  // Guard: don't sync from props while a drag is in progress — it would
  // teleport the card back to its original column mid-gesture.
  const isDragging = useRef(false);

  // The column a card started in when the drag began. handleDragOver mutates
  // `items` mid-gesture, so by drop time `items` no longer knows the origin.
  const dragOrigin = useRef(null);

  // THE FIX: re-group whenever the tasks prop changes, unless a drag is active.
  useEffect(() => {
    if (isDragging.current) return;
    setItems(groupByStatus(tasks));
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumnOfTask = useCallback(
    (taskId) =>
      Object.entries(items).find(([, ts]) => ts.some((t) => t._id === taskId))?.[0],
    [items],
  );

  const handleDragStart = ({ active }) => {
    isDragging.current = true;
    const colId = findColumnOfTask(active.id);
    dragOrigin.current = colId ?? null;
    if (colId) setActiveTask(items[colId].find((t) => t._id === active.id));
  };

  const handleDragOver = ({ active, over }) => {
    if (!over) return;
    const fromCol = findColumnOfTask(active.id);
    const toCol = COLUMNS.find((c) => c.id === over.id) ? over.id : findColumnOfTask(over.id);
    if (!fromCol || !toCol || fromCol === toCol) return;

    setItems((prev) => {
      const sourceItems = [...prev[fromCol]];
      const destItems = [...prev[toCol]];
      const taskIndex = sourceItems.findIndex((t) => t._id === active.id);
      const [moved] = sourceItems.splice(taskIndex, 1);
      destItems.push({ ...moved, status: toCol });
      return { ...prev, [fromCol]: sourceItems, [toCol]: destItems };
    });
  };

  const handleDragEnd = ({ active, over }) => {
    isDragging.current = false;
    setActiveTask(null);

    const fromCol = dragOrigin.current;
    dragOrigin.current = null;
    if (!over) return;

    const toCol = COLUMNS.find((c) => c.id === over.id) ? over.id : findColumnOfTask(over.id);
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

    // Cross-column move: persist the status change.
    onTaskMove?.(active.id, toCol);
  };

  const handleDragCancel = () => {
    isDragging.current = false;
    dragOrigin.current = null;
    setActiveTask(null);
    setItems(groupByStatus(tasks));
  };

  // Quick-complete checkbox: reuse the existing move persistence.
  const handleToggleComplete = (task) => {
    onTaskMove?.(task._id, task.status === "done" ? "todo" : "done");
  };

  const totalTasks = Object.values(items).flat().length;

  return (
    <div style={S.root}>
      <div style={S.boardHead}>
        <div style={S.boardTitle}>
          Board
          <span style={S.boardCount}>[{String(totalTasks).padStart(2, "0")} tasks]</span>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={onCreateTask}>
            <PlusIcon /> New task
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div style={S.gridWrap} className="scroll-area">
          <div style={S.grid}>
            {COLUMNS.map((col) => (
              <DroppableColumn
                key={col.id}
                column={col}
                tasks={items[col.id] || []}
                onTaskClick={onTaskClick}
                onToggleComplete={handleToggleComplete}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeTask ? (
            <div style={{ transform: "rotate(2deg)", opacity: 0.95 }}>
              <TaskCard task={activeTask} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

// ─── styles (token-driven) ──────────────────────────────────────────────────────
const S = {
  root: { display: "flex", flexDirection: "column", height: "100%", gap: 16 },
  boardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  boardTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  boardCount: { fontFamily: "var(--font-mono)", fontSize: "0.7rem", fontWeight: 400, color: "var(--text-dim)" },

  gridWrap: { flex: 1, minHeight: 0, overflowX: "auto" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(240px, 1fr))",
    gap: 14,
    height: "100%",
    minHeight: 320,
  },

  column: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "var(--shadow-sm)",
    transition: "border-color .2s var(--ease), background .2s var(--ease)",
  },
  colHead: {
    padding: "12px 14px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  dot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  colLabel: {
    fontSize: "0.76rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--text-soft)",
  },
  count: {
    marginLeft: "auto",
    fontFamily: "var(--font-mono)",
    fontSize: "0.78rem",
    color: "var(--text-dim)",
    minWidth: "2ch",
    textAlign: "right",
    display: "inline-block",
  },
  dropZone: { flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", minHeight: 120 },
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px dashed var(--border)",
    borderRadius: "var(--r-md)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.68rem",
    letterSpacing: "0.05em",
    color: "var(--muted)",
    minHeight: 80,
    transition: "border-color .2s var(--ease)",
  },
};
