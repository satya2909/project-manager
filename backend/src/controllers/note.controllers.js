import { ProjectNote } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";

// ─── GET /notes/:projectId ────────────────────────────────────────────────────
// All project members can read notes.
export const getProjectNotes = asyncHandler(async (req, res) => {
  const notes = await ProjectNote.find({ project: req.project._id })
    .populate("createdBy", "username fullName avatar")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponses(200, { notes }, "Notes fetched"));
});

// ─── POST /notes/:projectId ───────────────────────────────────────────────────
// Admin only — enforced by route middleware.
export const createNote = asyncHandler(async (req, res) => {
  const { content } = req.body;

  const note = await ProjectNote.create({
    content,
    project: req.project._id,
    createdBy: req.user._id,
  });

  const populated = await ProjectNote.findById(note._id).populate(
    "createdBy",
    "username fullName avatar",
  );

  return res
    .status(201)
    .json(new ApiResponses(201, { note: populated }, "Note created"));
});

// ─── GET /notes/:projectId/n/:noteId ─────────────────────────────────────────
// All members can read individual notes.
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
// Admin only.
export const updateNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;
  const { content } = req.body;

  const note = await ProjectNote.findOneAndUpdate(
    { _id: noteId, project: req.project._id },
    { $set: { content } },
    { new: true, runValidators: true },
  ).populate("createdBy", "username fullName avatar");

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  return res.status(200).json(new ApiResponses(200, { note }, "Note updated"));
});

// ─── DELETE /notes/:projectId/n/:noteId ──────────────────────────────────────
// Admin only.
export const deleteNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;

  const note = await ProjectNote.findOneAndDelete({
    _id: noteId,
    project: req.project._id,
  });

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  return res.status(200).json(new ApiResponses(200, {}, "Note deleted"));
});
