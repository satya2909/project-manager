import { ProjectNote, Activity } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";

// ─── helper ───────────────────────────────────────────────────────────────────
const log = (projectId, userId, action, target = "", metadata = {}) => {
  Activity.create({
    project: projectId,
    user: userId,
    action,
    target,
    metadata,
  }).catch((e) => console.error("[Activity]", e.message));
};

// ─── GET /notes/:projectId ────────────────────────────────────────────────────
export const getProjectNotes = asyncHandler(async (req, res) => {
  const notes = await ProjectNote.find({ project: req.project._id })
    .populate("createdBy", "username fullName avatar")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponses(200, { notes }, "Notes fetched"));
});

// ─── POST /notes/:projectId ───────────────────────────────────────────────────
export const createNote = asyncHandler(async (req, res) => {
  const { title, content } = req.body;

  const note = await ProjectNote.create({
    title,
    content,
    project: req.project._id,
    createdBy: req.user._id,
  });

  const populated = await ProjectNote.findById(note._id).populate(
    "createdBy",
    "username fullName avatar",
  );

  log(
    req.project._id,
    req.user._id,
    "created_note",
    title || content?.slice(0, 60),
  );

  return res
    .status(201)
    .json(new ApiResponses(201, { note: populated }, "Note created"));
});

// ─── GET /notes/:projectId/n/:noteId ─────────────────────────────────────────
export const getNoteById = asyncHandler(async (req, res) => {
  const { noteId } = req.params;

  const note = await ProjectNote.findOne({
    _id: noteId,
    project: req.project._id,
  }).populate("createdBy", "username fullName avatar");

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  return res.status(200).json(new ApiResponses(200, { note }, "Note fetched"));
});

// ─── PUT /notes/:projectId/n/:noteId ─────────────────────────────────────────
export const updateNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;
  const { title, content } = req.body;

  const note = await ProjectNote.findOneAndUpdate(
    { _id: noteId, project: req.project._id },
    { $set: { title, content } },
    { new: true, runValidators: true },
  ).populate("createdBy", "username fullName avatar");

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  log(req.project._id, req.user._id, "updated_note", title || note.title);

  return res.status(200).json(new ApiResponses(200, { note }, "Note updated"));
});

// ─── DELETE /notes/:projectId/n/:noteId ──────────────────────────────────────
export const deleteNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;

  const note = await ProjectNote.findOneAndDelete({
    _id: noteId,
    project: req.project._id,
  });

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  log(req.project._id, req.user._id, "deleted_note", note.title || "note");

  return res.status(200).json(new ApiResponses(200, {}, "Note deleted"));
});
