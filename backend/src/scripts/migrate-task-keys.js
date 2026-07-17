// backend/src/scripts/migrate-task-keys.js
//
// Phase 1.4 (plans/ai-dod-plan.md) — one-time backfill for task keys.
// Idempotent — safe to re-run; skips any project that already has a
// keyPrefix and any task that already has a taskNumber.
//
// Rollout order (found in `/plan-ceo-review`, 2026-07-17): run this to
// completion BEFORE deploying the code path that creates tasks via $inc
// allocation (createTask in task.controllers.js). The migration and the new
// allocation logic must never run concurrently against the same project.
//
// Usage: npm run migrate:taskkeys

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../..", ".env") });

import mongoose from "mongoose";
import { Project, Task } from "../models/index.js";

function deriveKeyPrefix(name) {
  const letters = (name || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
  const base = letters.slice(0, 4) || "PROJ";
  return base.length < 2 ? base.padEnd(2, "X") : base;
}

// Derive a prefix for `project`, suffixing with a digit if it collides with
// another project's live keyPrefix/prefixAliases in the same org — collision
// is scoped to already-migrated projects seen so far in `usedInOrg`, which is
// enough since this function only ever runs against projects lacking a
// keyPrefix in the first place (migrated ones are already unique by the
// controller's own uniqueness check).
function resolveUniquePrefix(name, usedInOrg) {
  const base = deriveKeyPrefix(name);
  if (!usedInOrg.has(base)) return base;
  for (let suffix = 2; suffix < 10; suffix++) {
    const candidate = `${base.slice(0, 5)}${suffix}`.slice(0, 6);
    if (!usedInOrg.has(candidate)) return candidate;
  }
  // Extremely unlikely (10+ colliding names in one org derived to the same
  // 4-letter base) — fall back to a value that can't collide.
  return `P${Date.now().toString(36).toUpperCase()}`.slice(0, 6);
}

export async function migrateTaskKeys() {
  const projects = await Project.find({
    $or: [{ keyPrefix: { $exists: false } }, { keyPrefix: null }],
  });

  const usedByOrg = new Map(); // orgId string -> Set of prefixes already claimed this run
  for (const project of projects) {
    const orgKey = project.organization.toString();
    if (!usedByOrg.has(orgKey)) {
      const existing = await Project.find({
        organization: project.organization,
        keyPrefix: { $exists: true, $ne: null },
      }).select("keyPrefix prefixAliases");
      const used = new Set(existing.flatMap((p) => [p.keyPrefix, ...(p.prefixAliases ?? [])]));
      usedByOrg.set(orgKey, used);
    }
    const used = usedByOrg.get(orgKey);
    const prefix = resolveUniquePrefix(project.name, used);
    used.add(prefix);

    const tasks = await Task.find({
      project: project._id,
      $or: [{ taskNumber: { $exists: false } }, { taskNumber: null }],
    }).sort({ createdAt: 1 });

    const alreadyNumbered = await Task.find({
      project: project._id,
      taskNumber: { $exists: true, $ne: null },
    }).select("taskNumber");
    let counter = alreadyNumbered.reduce(
      (max, t) => Math.max(max, t.taskNumber),
      0,
    );

    for (const task of tasks) {
      counter += 1;
      await Task.updateOne({ _id: task._id }, { $set: { taskNumber: counter } });
    }

    await Project.updateOne(
      { _id: project._id },
      { $set: { keyPrefix: prefix, taskCounter: counter } },
    );
  }

  return { projectsMigrated: projects.length };
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  if (!process.env.MONGO_URI) {
    console.error("✗ MONGO_URI is not set. Aborting migration.");
    process.exit(1);
  }
  mongoose
    .connect(process.env.MONGO_URI)
    .then(async () => {
      console.log("MongoDB connected — starting task-key backfill\n");
      const { projectsMigrated } = await migrateTaskKeys();
      console.log(`✓ Projects migrated: ${projectsMigrated}`);

      const remaining = await Task.countDocuments({
        taskNumber: { $exists: false },
      });
      console.log(
        remaining === 0
          ? "✓ Every task now has a taskNumber."
          : `⚠ ${remaining} task(s) still missing a taskNumber — investigate before deploying the new allocation code path.`,
      );

      await mongoose.disconnect();
      console.log("\nDone.");
    })
    .catch(async (err) => {
      console.error("✗ Migration failed:", err);
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    });
}
