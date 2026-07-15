import { describe, it, expect } from "vitest";
import { wouldCreateCycle } from "../src/utils/dependency-graph.js";

// Fixture task IDs — plain strings are fine, wouldCreateCycle() only ever
// calls .toString() on them, matching how Mongoose ObjectIds behave.
const A = "a";
const B = "b";
const C = "c";
const D = "d";

function task(id, dependsOn = []) {
  return { _id: id, dependsOn };
}

describe("wouldCreateCycle", () => {
  it("returns false when there is no relationship between the tasks", () => {
    const tasks = [task(A), task(B), task(C)];
    // Adding "C depends on A" where neither has any existing edges.
    expect(wouldCreateCycle(tasks, C, A)).toBe(false);
  });

  it("returns false when the new edge extends the graph without closing a loop", () => {
    // A depends on B (A → B). Adding "C depends on A" (C → A) just extends
    // the chain: C → A → B. No cycle.
    const tasks = [task(A, [B]), task(B), task(C)];
    expect(wouldCreateCycle(tasks, C, A)).toBe(false);
  });

  it("detects a direct cycle (A → B, adding B → A)", () => {
    // A depends on B already. Adding "B depends on A" closes A → B → A.
    const tasks = [task(A, [B]), task(B)];
    expect(wouldCreateCycle(tasks, B, A)).toBe(true);
  });

  it("detects an indirect cycle (A → B → C, adding C → A)", () => {
    // A depends on B, B depends on C (A → B → C). Adding "C depends on A"
    // (C → A) closes the loop: A → B → C → A.
    const tasks = [task(A, [B]), task(B, [C]), task(C)];
    expect(wouldCreateCycle(tasks, C, A)).toBe(true);
  });

  it("detects a longer indirect cycle (A → B → C → D, adding D → A)", () => {
    const tasks = [task(A, [B]), task(B, [C]), task(C, [D]), task(D)];
    expect(wouldCreateCycle(tasks, D, A)).toBe(true);
  });

  it("detects a self-reference (adding A → A)", () => {
    const tasks = [task(A)];
    expect(wouldCreateCycle(tasks, A, A)).toBe(true);
  });

  it("does not false-positive on unrelated branches of the same graph", () => {
    // A depends on B; C depends on D. These are two disconnected chains —
    // adding "C depends on A" should not be flagged as a cycle.
    const tasks = [task(A, [B]), task(B), task(C, [D]), task(D)];
    expect(wouldCreateCycle(tasks, C, A)).toBe(false);
  });

  it("handles a task with multiple existing dependencies", () => {
    // A depends on both B and C. B depends on D. Adding "D depends on A"
    // closes a cycle via the A → B → D path.
    const tasks = [task(A, [B, C]), task(B, [D]), task(C), task(D)];
    expect(wouldCreateCycle(tasks, D, A)).toBe(true);
  });
});
