import { Activity } from "../models/index.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";

// ─── GET /activity/:projectId ─────────────────────────────────────────────────
// Returns the most recent N activity events for a project.
// All project members can read the feed (enforced by attachProject middleware).
//
// Query params:
//   ?limit=20   — how many events to return (max 50, default 20)
//   ?before=ISO — cursor-based pagination: events before this timestamp
export const getProjectActivity = asyncHandler(async (req, res) => {
  const { limit = 20, before } = req.query;

  const cap = Math.min(Number(limit) || 20, 50);

  const filter = { project: req.project._id };
  if (before) {
    const ts = new Date(before);
    if (!isNaN(ts.getTime())) {
      filter.createdAt = { $lt: ts };
    }
  }

  const events = await Activity.find(filter)
    .populate("user", "username fullName avatar")
    .sort({ createdAt: -1 })
    .limit(cap)
    .lean();

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { events, count: events.length },
        "Activity fetched",
      ),
    );
});
