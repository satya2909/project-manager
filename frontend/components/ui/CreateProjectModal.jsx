import { useState, useEffect } from "react";
import { Modal, ModalHeader } from "./Modal.jsx";
import { Button, Field, Input, Spinner } from "./primitive.jsx";

export default function CreateProjectModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({ name: "", description: "" });
      setErrors({});
      setSubmitted(false);
    }
  }, [isOpen]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Project name is required";
    else if (form.name.trim().length < 3) errs.name = "Use at least 3 characters";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true);
    try {
      await onSubmit?.({ name: form.name.trim(), description: form.description.trim() });
      setSubmitted(true);
      setTimeout(onClose, 500);
    } catch (e) {
      setErrors({ submit: e?.message || "Couldn't create the project. Try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={460} labelledBy="create-project-title">
      <ModalHeader
        id="create-project-title"
        title="New project"
        subtitle="Give it a name and an optional description"
        onClose={onClose}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
        <Field label="Project name" error={errors.name}>
          <Input
            value={form.name}
            onChange={set("name")}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="e.g. Website redesign"
            maxLength={60}
            autoFocus
          />
        </Field>

        <Field label="Description">
          <Input
            as="textarea"
            value={form.description}
            onChange={set("description")}
            placeholder="What is this project about?"
            rows={4}
            maxLength={500}
          />
          <span style={{ alignSelf: "flex-end", fontFamily: "var(--font-mono)", fontSize: "0.64rem", color: "var(--text-dim)" }}>
            {form.description.length}/500
          </span>
        </Field>

        {errors.submit && <span className="input-error">{errors.submit}</span>}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading || submitted}>
          {submitted ? "Created" : loading ? <><Spinner size="sm" /> Creating…</> : "Create project"}
        </Button>
      </div>
    </Modal>
  );
}
