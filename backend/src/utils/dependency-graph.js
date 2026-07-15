// ─── Dependency cycle detection ────────────────────────────────────────────
// `dependsOn` edges form a DAG: task X depends on task Y means X → Y (X is
// blocked by Y). Adding a new edge taskId → newDependsOnId is only safe if
// newDependsOnId cannot already reach taskId by following existing edges —
// otherwise the new edge closes a cycle.
//
//   Example: A depends on B, B depends on C (A → B → C already exists).
//   Adding "C depends on A" (C → A) would close the loop: A → B → C → A.
//   wouldCreateCycle(tasks, taskId="C", newDependsOnId="A") walks from A
//   through its existing dependsOn chain (A → B → C) and finds C === taskId,
//   so it returns true.
//
// `tasks` is the project's full task set (already fetched by the caller —
// this function does NOT query the database, so cycle checks never cost
// more than one DB round trip regardless of chain depth).

export function wouldCreateCycle(tasks, taskId, newDependsOnId) {
  const taskIdStr = taskId.toString();
  const newDependsOnIdStr = newDependsOnId.toString();

  // Self-reference is trivially a cycle (A → A).
  if (taskIdStr === newDependsOnIdStr) {
    return true;
  }

  const adjacency = new Map();
  for (const t of tasks) {
    const id = t._id.toString();
    const deps = (t.dependsOn || []).map((d) => d.toString());
    adjacency.set(id, deps);
  }

  // Walk from newDependsOnId through its existing dependsOn chain. If that
  // walk ever reaches taskId, adding taskId → newDependsOnId would close a
  // cycle back to where it started.
  const visited = new Set();
  const stack = [newDependsOnIdStr];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === taskIdStr) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const deps = adjacency.get(current) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        stack.push(dep);
      }
    }
  }

  return false;
}
