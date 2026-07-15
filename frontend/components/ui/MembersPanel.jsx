import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/authcontext.jsx";
import projectService from "../../services/project.service.js";
import organizationService from "../../services/organization.service.js";
import { useToast } from "./Toast.jsx";
import { Button, EmptyState, Skeleton, SectionLabel } from "./primitive.jsx";
import { EASE } from "../../motion/tokens";

const ASSIGNABLE_ROLES = ["member", "project_admin"];

const ROLE_CFG = {
  admin: { label: "Admin", color: "var(--signal)", soft: "var(--signal-soft)" },
  project_admin: { label: "Proj admin", color: "var(--brass)", soft: "var(--brass-soft)" },
  member: { label: "Member", color: "var(--text-dim)", soft: "var(--surface-2)" },
};

function RoleBadge({ role }) {
  const cfg = ROLE_CFG[role] || ROLE_CFG.member;
  return <span style={{ ...S.badge, color: cfg.color, background: cfg.soft }}>{cfg.label}</span>;
}

function Avatar({ name, email }) {
  const letter = (name || email || "?")[0].toUpperCase();
  return <div style={S.avatar}>{letter}</div>;
}

export default function MembersPanel({ projectId }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [orgMembers, setOrgMembers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState("member");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");

  const [editRole, setEditRole] = useState({});
  const [saving, setSaving] = useState({});
  const [removing, setRemoving] = useState({});

  const myRole = members.find((m) => (m.user?._id ?? m.user) === user?._id)?.role ?? null;
  const isAdmin = myRole === "admin";

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await projectService.listMembers(projectId);
      setMembers(data?.members ?? []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load members.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    (async () => {
      try {
        const data = await organizationService.listMembers();
        setOrgMembers(data?.members ?? []);
      } catch {
        setOrgMembers([]);
      }
    })();
  }, []);

  const memberIds = new Set(members.map((m) => (m.user?._id ?? m.user)?.toString()));
  const candidates = orgMembers.filter((om) => om.status === "active" && !memberIds.has(om._id?.toString()));

  const handleAdd = async () => {
    const picked = candidates.find((c) => c._id === selectedUserId);
    if (!picked) return setAddErr("Select a member to add.");
    setAddErr("");
    setAdding(true);
    try {
      await projectService.addMember(projectId, { email: picked.email, role });
      setSelectedUserId("");
      setRole("member");
      toast(`${picked.fullName || picked.username} added as ${role}`, { kind: "success" });
      await fetchMembers();
    } catch (e) {
      setAddErr(e?.response?.data?.message || "Failed to add member.");
    } finally {
      setAdding(false);
    }
  };

  const handleSaveRole = async (userId) => {
    const newRole = editRole[userId];
    if (!newRole) return;
    setSaving((s) => ({ ...s, [userId]: true }));
    try {
      await projectService.updateMemberRole(projectId, userId, { role: newRole });
      toast(`Role updated to ${newRole}`, { kind: "success" });
      setEditRole((e) => {
        const n = { ...e };
        delete n[userId];
        return n;
      });
      await fetchMembers();
    } catch (e) {
      toast(e?.response?.data?.message || "Failed to update role.", { kind: "danger" });
    } finally {
      setSaving((s) => ({ ...s, [userId]: false }));
    }
  };

  const handleRemove = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from this project?`)) return;
    setRemoving((r) => ({ ...r, [userId]: true }));
    try {
      await projectService.removeMember(projectId, userId);
      toast(`${name} removed`, { kind: "success" });
      await fetchMembers();
    } catch (e) {
      toast(e?.response?.data?.message || "Failed to remove.", { kind: "danger" });
    } finally {
      setRemoving((r) => ({ ...r, [userId]: false }));
    }
  };

  return (
    <div style={S.wrap}>
      {isAdmin && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 30 }}>
          <SectionLabel>Add member</SectionLabel>
          {candidates.length === 0 ? (
            <div style={S.hint}>
              All active org members are already on this project. Invite new people from Organization → Invites.
            </div>
          ) : (
            <div style={S.addRow}>
              <div style={S.fieldWrap}>
                <label style={S.fieldLabel}>Org member</label>
                <select
                  style={{ ...S.select, width: "100%", borderColor: addErr ? "var(--danger)" : "var(--border)" }}
                  value={selectedUserId}
                  onChange={(e) => { setSelectedUserId(e.target.value); setAddErr(""); }}
                >
                  <option value="">Select a member…</option>
                  {candidates.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.fullName || c.username} — {c.email}
                    </option>
                  ))}
                </select>
              </div>
              <div style={S.fieldWrap}>
                <label style={S.fieldLabel}>Role</label>
                <select style={S.select} value={role} onChange={(e) => setRole(e.target.value)}>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button style={{ ...S.btnAdd, opacity: adding ? 0.6 : 1 }} onClick={handleAdd} disabled={adding}>
                {adding ? "Adding…" : "+ Add"}
              </button>
            </div>
          )}
          {addErr && <div style={{ marginTop: 8 }}><span className="input-error">{addErr}</span></div>}
        </motion.div>
      )}

      <SectionLabel>Members{!loading && ` · ${members.length}`}</SectionLabel>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={44} radius="var(--r-md)" />
          ))}
        </div>
      )}

      {error && !loading && (
        <EmptyState title="Couldn't load members" description={error} action={<Button variant="ghost" onClick={fetchMembers}>Try again</Button>} />
      )}

      {!loading && !error && members.length === 0 && (
        <EmptyState title="No members yet" description="Add teammates from your organization to collaborate on this project." />
      )}

      {!loading && !error && (
        <AnimatePresence>
          {members.map((m, i) => {
            const uid = m.user?._id ?? m.user;
            const name = m.user?.fullName || m.user?.username || "";
            const email = m.user?.email || "";
            const isMe = uid === user?._id;
            const isOwner = m.role === "admin";
            const pending = editRole[uid];
            const changed = pending && pending !== m.role;

            return (
              <motion.div
                key={uid}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18, delay: Math.min(i * 0.04, 0.2), ease: EASE }}
                style={S.memberRow}
              >
                <Avatar name={name} email={email} />
                <div style={S.memberInfo}>
                  <span style={S.memberName}>
                    {name || email}
                    {isMe && <span style={S.youTag}> (you)</span>}
                  </span>
                  <span style={S.memberEmail}>{email}</span>
                </div>

                {isAdmin && !isMe && !isOwner ? (
                  <select
                    style={S.roleSelect}
                    value={pending ?? m.role}
                    onChange={(e) => setEditRole((prev) => ({ ...prev, [uid]: e.target.value }))}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <RoleBadge role={m.role} />
                )}

                {isAdmin && !isMe && !isOwner && changed && (
                  <button style={{ ...S.btnSave, opacity: saving[uid] ? 0.6 : 1 }} onClick={() => handleSaveRole(uid)} disabled={saving[uid]}>
                    {saving[uid] ? "…" : "Save"}
                  </button>
                )}

                {isAdmin && !isMe && !isOwner && (
                  <button style={{ ...S.btnRemove, opacity: removing[uid] ? 0.5 : 1 }} onClick={() => handleRemove(uid, name || email)} disabled={removing[uid]}>
                    {removing[uid] ? "…" : "Remove"}
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}

const S = {
  wrap: { padding: "20px 4px", position: "relative", maxWidth: 720 },
  hint: { fontSize: "0.82rem", color: "var(--text-dim)", lineHeight: 1.6, padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--surface)" },
  addRow: { display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontFamily: "var(--font-mono)", fontSize: "0.64rem", letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-dim)" },
  select: { fontFamily: "var(--font-sans)", fontSize: "0.84rem", background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "8px 12px", outline: "none", cursor: "pointer" },
  btnAdd: { fontFamily: "var(--font-sans)", fontSize: "0.8rem", fontWeight: 600, background: "var(--signal)", color: "var(--signal-ink)", border: "none", borderRadius: "var(--r-md)", padding: "8px 16px", cursor: "pointer", whiteSpace: "nowrap", alignSelf: "end" },
  memberRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" },
  avatar: { width: 34, height: 34, borderRadius: "50%", background: "var(--signal-soft)", color: "var(--signal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: "0.8rem", fontWeight: 600, flexShrink: 0 },
  memberInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  memberName: { fontSize: "0.86rem", color: "var(--text)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  memberEmail: { fontSize: "0.75rem", color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  youTag: { color: "var(--text-dim)", fontSize: "0.72rem", fontWeight: 400 },
  badge: { fontFamily: "var(--font-mono)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", borderRadius: "var(--r-sm)", padding: "3px 8px", whiteSpace: "nowrap" },
  roleSelect: { fontFamily: "var(--font-sans)", fontSize: "0.78rem", background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "5px 8px", cursor: "pointer", outline: "none" },
  btnSave: { fontFamily: "var(--font-sans)", fontSize: "0.72rem", fontWeight: 600, background: "var(--signal)", color: "var(--signal-ink)", border: "none", borderRadius: "var(--r-sm)", padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" },
  btnRemove: { fontFamily: "var(--font-sans)", fontSize: "0.72rem", fontWeight: 500, background: "transparent", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)", borderRadius: "var(--r-sm)", padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" },
};
