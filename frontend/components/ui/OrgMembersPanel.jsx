import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/authcontext.jsx";
import organizationService from "../../services/organization.service.js";
import { useToast } from "./Toast.jsx";
import { Button, EmptyState, Skeleton, SectionLabel } from "./primitive.jsx";
import { EASE } from "../../motion/tokens";

const ASSIGNABLE_ROLES = ["member", "admin"];
const ROLE_RANK = { member: 0, admin: 1, owner: 2 };

const ROLE_CFG = {
  owner: { label: "Owner", color: "var(--brass)", soft: "var(--brass-soft)" },
  admin: { label: "Org admin", color: "var(--signal)", soft: "var(--signal-soft)" },
  member: { label: "Member", color: "var(--text-dim)", soft: "var(--surface-2)" },
};

function RoleBadge({ role }) {
  const cfg = ROLE_CFG[role] || ROLE_CFG.member;
  return <span style={{ ...S.badge, color: cfg.color, background: cfg.soft }}>{cfg.label}</span>;
}

function Avatar({ name, email, dim }) {
  const letter = (name || email || "?")[0].toUpperCase();
  return <div style={{ ...S.avatar, opacity: dim ? 0.4 : 1 }}>{letter}</div>;
}

export default function OrgMembersPanel() {
  const { user, isOrgOwner, isOrgManager } = useAuth();
  const { toast } = useToast();
  const myRank = ROLE_RANK[user?.role] ?? 0;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editRole, setEditRole] = useState({});
  const [saving, setSaving] = useState({});
  const [busy, setBusy] = useState({});

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await organizationService.listMembers();
      setMembers(data?.members ?? []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load members.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSaveRole = async (userId) => {
    const newRole = editRole[userId];
    if (!newRole) return;
    setSaving((s) => ({ ...s, [userId]: true }));
    try {
      await organizationService.updateMemberRole(userId, { role: newRole });
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

  const handleDeactivate = async (userId, name) => {
    if (!window.confirm(`Deactivate ${name}? They will be logged out and unable to sign in.`)) return;
    setBusy((b) => ({ ...b, [userId]: true }));
    try {
      await organizationService.deactivateMember(userId);
      toast(`${name} deactivated`, { kind: "success" });
      await fetchMembers();
    } catch (e) {
      toast(e?.response?.data?.message || "Failed to deactivate.", { kind: "danger" });
    } finally {
      setBusy((b) => ({ ...b, [userId]: false }));
    }
  };

  return (
    <div style={S.wrap}>
      <SectionLabel>Members{!loading && ` · ${members.length}`}</SectionLabel>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={44} radius="var(--r-md)" />
          ))}
        </div>
      )}

      {error && !loading && (
        <EmptyState
          title="Couldn't load members"
          description={error}
          action={<Button variant="ghost" onClick={fetchMembers}>Try again</Button>}
        />
      )}

      {!loading && !error && members.length === 0 && (
        <EmptyState title="No members yet" description="Invite teammates from the Invites tab to build your team." />
      )}

      {!loading && !error && (
        <AnimatePresence>
          {members.map((m, i) => {
            const uid = m._id;
            const name = m.fullName || m.username || "";
            const email = m.email || "";
            const isMe = uid === user?._id;
            const isDeactivated = m.status === "deactivated";
            const targetRank = ROLE_RANK[m.role] ?? 0;
            const canEditRole = isOrgOwner && !isMe && m.role !== "owner" && !isDeactivated;
            const canDeactivate = isOrgManager && !isMe && !isDeactivated && myRank > targetRank;
            const pending = editRole[uid];
            const changed = pending && pending !== m.role;

            return (
              <motion.div
                key={uid}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18, delay: Math.min(i * 0.03, 0.2), ease: EASE }}
                style={{ ...S.memberRow, opacity: isDeactivated ? 0.55 : 1 }}
              >
                <Avatar name={name} email={email} dim={isDeactivated} />
                <div style={S.memberInfo}>
                  <span style={S.memberName}>
                    {name || email}
                    {isMe && <span style={S.youTag}> (you)</span>}
                  </span>
                  <span style={S.memberEmail}>{email}</span>
                </div>

                {isDeactivated && <span style={{ ...S.badge, color: "var(--text-dim)", background: "var(--surface-2)" }}>Deactivated</span>}

                {!isDeactivated &&
                  (canEditRole ? (
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
                  ))}

                {canEditRole && changed && (
                  <button style={{ ...S.btnSave, opacity: saving[uid] ? 0.6 : 1 }} onClick={() => handleSaveRole(uid)} disabled={saving[uid]}>
                    {saving[uid] ? "…" : "Save"}
                  </button>
                )}

                {canDeactivate && (
                  <button style={{ ...S.btnRemove, opacity: busy[uid] ? 0.5 : 1 }} onClick={() => handleDeactivate(uid, name || email)} disabled={busy[uid]}>
                    {busy[uid] ? "…" : "Deactivate"}
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
  memberRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "var(--signal-soft)",
    color: "var(--signal)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    fontWeight: 600,
    flexShrink: 0,
  },
  memberInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  memberName: { fontSize: "0.86rem", color: "var(--text)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  memberEmail: { fontSize: "0.75rem", color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  youTag: { color: "var(--text-dim)", fontSize: "0.72rem", fontWeight: 400 },
  badge: { fontFamily: "var(--font-mono)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", borderRadius: "var(--r-sm)", padding: "3px 8px", whiteSpace: "nowrap" },
  roleSelect: { fontFamily: "var(--font-sans)", fontSize: "0.78rem", background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "5px 8px", cursor: "pointer", outline: "none" },
  btnSave: { fontFamily: "var(--font-sans)", fontSize: "0.72rem", fontWeight: 600, background: "var(--signal)", color: "var(--signal-ink)", border: "none", borderRadius: "var(--r-sm)", padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" },
  btnRemove: { fontFamily: "var(--font-sans)", fontSize: "0.72rem", fontWeight: 500, background: "transparent", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)", borderRadius: "var(--r-sm)", padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" },
};
