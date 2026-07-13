// Temporary end-to-end smoke test for org multi-tenancy. Drives the live server
// over HTTP and uses a direct Mongo connection only to (a) verify emails (no SMTP
// in dev) and (b) set up/tear down test fixtures. Deletes all test data at the end.
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const BASE = `http://localhost:${process.env.PORT || 3000}/api/v1`;
const stamp = Date.now();
const results = [];
const created = { orgIds: [], userEmails: [], projectIds: [] };

function ok(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

// ── tiny cookie-jar fetch ─────────────────────────────────────────────────────
async function req(method, p, { body, jar } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (jar?.cookie) headers.Cookie = jar.cookie;
  const res = await fetch(BASE + p, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (jar && setCookies.length) {
    for (const c of setCookies) {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      jar[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
    jar.cookie = Object.entries(jar)
      .filter(([k]) => k !== "cookie")
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const verifyEmail = (email) =>
    db.collection("users").updateOne({ email }, { $set: { isEmailVerified: true } });

  const A = { username: `smoke_a_${stamp}`, email: `smoke-a-${stamp}@test.local`, password: "Password123", organizationName: `Smoke Org A ${stamp}` };
  const B = { username: `smoke_b_${stamp}`, email: `smoke-b-${stamp}@test.local`, password: "Password123", organizationName: `Smoke Org B ${stamp}` };
  created.userEmails.push(A.email, B.email);
  const jarA = {}, jarB = {}, jarM = {};

  // 1. New-org signup (owner)
  let r = await req("POST", "/auth/register", { body: A });
  ok("register A creates org+owner (201)", r.status === 201, `status ${r.status}`);
  await verifyEmail(A.email);

  // 2. Login A, current-user shows owner + organization
  r = await req("POST", "/auth/login", { body: { email: A.email, password: A.password }, jar: jarA });
  ok("login A (200)", r.status === 200, `status ${r.status}`);
  r = await req("GET", "/auth/current-user", { jar: jarA });
  const orgAId = r.data?.data?.user?.organization;
  const userAId = r.data?.data?.user?._id;
  ok("A is owner with an organization", r.data?.data?.user?.role === "owner" && !!orgAId, `role ${r.data?.data?.user?.role}`);
  if (orgAId) created.orgIds.push(orgAId);

  // 3. Create project as owner
  r = await req("POST", "/projects", { body: { name: `Smoke Project ${stamp}`, description: "smoke" }, jar: jarA });
  const projectId = r.data?.data?.project?._id;
  ok("owner creates project (201) scoped to org", r.status === 201 && r.data?.data?.project?.organization === orgAId, `status ${r.status}`);
  if (projectId) created.projectIds.push(projectId);

  // 3b. Insert a plain member M directly into org A, then confirm member is 403 on create
  const mEmail = `smoke-m-${stamp}@test.local`;
  created.userEmails.push(mEmail);
  await db.collection("users").insertOne({
    username: `smoke_m_${stamp}`, email: mEmail, fullName: "Smoke Member",
    password: await bcrypt.hash("Password123", 12),
    organization: new mongoose.Types.ObjectId(orgAId), role: "member",
    isEmailVerified: true, status: "active", createdAt: new Date(), updatedAt: new Date(),
  });
  r = await req("POST", "/auth/login", { body: { email: mEmail, password: "Password123" }, jar: jarM });
  ok("login member M (200)", r.status === 200, `status ${r.status}`);
  r = await req("POST", "/projects", { body: { name: "should fail", description: "x" }, jar: jarM });
  ok("member BLOCKED from creating project (403)", r.status === 403, `status ${r.status}`);
  const mId = (await db.collection("users").findOne({ email: mEmail }))?._id;

  // 4. Org endpoints
  r = await req("GET", "/organizations/me", { jar: jarA });
  ok("GET /organizations/me (200)", r.status === 200 && !!r.data?.data?.organization?.name);
  r = await req("GET", "/organizations/members", { jar: jarA });
  ok("org members lists owner + member", r.status === 200 && (r.data?.data?.members?.length ?? 0) >= 2, `count ${r.data?.data?.members?.length}`);
  r = await req("PUT", "/organizations", { body: { name: `Smoke Org A ${stamp} RENAMED` }, jar: jarA });
  ok("owner renames org (200)", r.status === 200 && /RENAMED/.test(r.data?.data?.organization?.name || ""));

  // invites: create → list → revoke
  r = await req("POST", "/invites", { body: { email: `invitee-${stamp}@test.local`, role: "member" }, jar: jarA });
  ok("create invite (201)", r.status === 201);
  r = await req("GET", "/invites", { jar: jarA });
  const inviteId = r.data?.data?.invites?.[0]?._id;
  ok("list pending invites (>=1)", r.status === 200 && (r.data?.data?.invites?.length ?? 0) >= 1, `count ${r.data?.data?.invites?.length}`);
  r = await req("DELETE", `/invites/${inviteId}`, { jar: jarA });
  ok("revoke invite (200)", r.status === 200);
  r = await req("GET", "/invites", { jar: jarA });
  ok("no pending invites after revoke", (r.data?.data?.invites?.length ?? -1) === 0, `count ${r.data?.data?.invites?.length}`);
  // invite owner role rejected
  r = await req("POST", "/invites", { body: { email: `x-${stamp}@test.local`, role: "owner" }, jar: jarA });
  ok("invite role=owner rejected (403)", r.status === 403, `status ${r.status}`);

  // 5. CROSS-ORG ISOLATION — B cannot see A's project
  r = await req("POST", "/auth/register", { body: B });
  ok("register B (201)", r.status === 201);
  await verifyEmail(B.email);
  r = await req("POST", "/auth/login", { body: { email: B.email, password: B.password }, jar: jarB });
  ok("login B (200)", r.status === 200);
  r = await req("GET", `/projects/${projectId}`, { jar: jarB });
  ok("B gets 404 on A's project (tenant isolation)", r.status === 404, `status ${r.status}`);
  const orgBId = (await req("GET", "/organizations/me", { jar: jarB })).data?.data?.organization?._id;
  if (orgBId) created.orgIds.push(orgBId);

  // 6. Deactivate member → they can no longer log in
  r = await req("DELETE", `/organizations/members/${mId}`, { jar: jarA });
  ok("owner deactivates member (200)", r.status === 200, `status ${r.status}`);
  r = await req("POST", "/auth/login", { body: { email: mEmail, password: "Password123" } });
  ok("deactivated member BLOCKED from login (403)", r.status === 403, `status ${r.status}`);

  // 7. Delete org — blocked while non-empty, succeeds when empty
  r = await req("DELETE", "/organizations", { jar: jarA });
  ok("delete org BLOCKED while non-empty (409)", r.status === 409, `status ${r.status}`);
  // empty it: remove member row + project, then delete succeeds (also deletes owner)
  await db.collection("users").deleteOne({ _id: mId });
  await req("DELETE", `/projects/${projectId}`, { jar: jarA });
  r = await req("DELETE", "/organizations", { jar: jarA });
  ok("delete empty org succeeds (200)", r.status === 200, `status ${r.status}`);
  r = await req("GET", "/auth/current-user", { jar: jarA });
  ok("owner account gone after org delete (401)", r.status === 401, `status ${r.status}`);
};

const cleanup = async () => {
  try {
    const db = mongoose.connection.db;
    const orgIds = created.orgIds.map((id) => new mongoose.Types.ObjectId(id));
    const projIds = created.projectIds.map((id) => new mongoose.Types.ObjectId(id));
    await db.collection("users").deleteMany({ email: { $in: created.userEmails } });
    await db.collection("users").deleteMany({ organization: { $in: orgIds } });
    await db.collection("organizations").deleteMany({ _id: { $in: orgIds } });
    await db.collection("projects").deleteMany({ organization: { $in: orgIds } });
    await db.collection("invites").deleteMany({ organization: { $in: orgIds } });
    if (projIds.length) await db.collection("activities").deleteMany({ project: { $in: projIds } });
    console.log("\n[cleanup] test data removed");
  } catch (e) {
    console.log("[cleanup] error:", e.message);
  }
};

run()
  .catch((e) => console.log("RUNNER ERROR:", e.message))
  .finally(async () => {
    await cleanup();
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n==== SMOKE RESULT: ${passed}/${results.length} passed ====`);
    const fails = results.filter((r) => !r.pass);
    if (fails.length) console.log("FAILURES:", fails.map((f) => f.name).join(" | "));
    await mongoose.disconnect();
    process.exit(fails.length ? 1 : 0);
  });
