// backend/src/scripts/migrate-organizations.js
//
// One-time migration to introduce Organizations (Phase 1).
//
// What it does (idempotent — safe to re-run):
//   1. Ensures a single default Organization exists for existing data.
//   2. Backfills `organization` on every User missing it.
//   3. Backfills `organization` on every Project missing it.
//
// Run BEFORE flipping the `organization` fields to `required: true`.
//
// Usage:  npm run migrate:orgs
//
// NOTE: At this stage the `organization` fields on User/Project are still
// optional, so existing documents load fine. After this script reports 0
// remaining un-scoped docs, flip both fields to `required: true` and redeploy.

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// scripts -> src -> backend -> project root (.env lives at project root)
dotenv.config({ path: path.resolve(__dirname, "../../..", ".env") });

import mongoose from "mongoose";
import { Organization, User, Project } from "../models/index.js";

const DEFAULT_ORG_NAME = "Default Organization";
const DEFAULT_ORG_SLUG = "default";

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("✗ MONGO_URI is not set. Aborting migration.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected — starting organization backfill\n");

  // ── Step 1: find or create the default organization ─────────────────────────
  let org = await Organization.findOne({ slug: DEFAULT_ORG_SLUG });

  if (!org) {
    // createdBy is required on the schema — anchor it to the oldest user if one
    // exists, otherwise leave it to be created by the first real signup later.
    const firstUser = await User.findOne().sort({ createdAt: 1 }).select("_id");

    if (!firstUser) {
      console.log(
        "No users found — nothing to backfill. Skipping default org creation.",
      );
      await mongoose.disconnect();
      return;
    }

    org = await Organization.create({
      name: DEFAULT_ORG_NAME,
      slug: DEFAULT_ORG_SLUG,
      createdBy: firstUser._id,
      status: "active",
    });
    console.log(`✓ Created default organization "${org.name}" (${org._id})`);
  } else {
    console.log(`✓ Reusing existing default organization (${org._id})`);
  }

  // ── Step 2: backfill users without an organization ──────────────────────────
  const userResult = await User.updateMany(
    { organization: { $in: [null, undefined] } },
    { $set: { organization: org._id } },
  );
  console.log(`✓ Users backfilled: ${userResult.modifiedCount}`);

  // ── Step 3: backfill projects without an organization ───────────────────────
  const projectResult = await Project.updateMany(
    { organization: { $in: [null, undefined] } },
    { $set: { organization: org._id } },
  );
  console.log(`✓ Projects backfilled: ${projectResult.modifiedCount}`);

  // ── Step 3b: backfill org-role VALUES on existing users (Phase 2) ────────────
  // The org role enum is owner/admin/member — it has no `project_admin`, and no
  // existing user is an `owner`. Map:
  //   - the org creator            -> owner
  //   - legacy `project_admin`     -> member (that global gate is retired;
  //                                   project creation is now org admin/owner only)
  //   - `admin` / `member`         -> unchanged (valid under the org enum)
  const ownerResult = await User.updateOne(
    { _id: org.createdBy },
    { $set: { role: "owner" } },
  );
  const projectAdminResult = await User.updateMany(
    { role: "project_admin" },
    { $set: { role: "member" } },
  );
  console.log(
    `✓ Org roles backfilled — owner set: ${ownerResult.modifiedCount}, project_admin→member: ${projectAdminResult.modifiedCount}`,
  );

  // ── Verify nothing remains un-scoped ────────────────────────────────────────
  const remainingUsers = await User.countDocuments({
    organization: { $in: [null, undefined] },
  });
  const remainingProjects = await Project.countDocuments({
    organization: { $in: [null, undefined] },
  });

  console.log(
    `\nRemaining un-scoped — users: ${remainingUsers}, projects: ${remainingProjects}`,
  );

  if (remainingUsers === 0 && remainingProjects === 0) {
    console.log(
      "✓ All users and projects are scoped. Safe to flip `organization` to required.",
    );
  } else {
    console.warn(
      "⚠ Some documents are still un-scoped. Do NOT flip to required yet.",
    );
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

run().catch(async (err) => {
  console.error("✗ Migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
