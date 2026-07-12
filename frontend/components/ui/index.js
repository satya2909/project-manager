// UI barrel — re-exports shared presentational primitives.
// Data hooks (useProjects, useTasks, useNotes, etc.) live in ../../hooks/index.js;
// they used to be duplicated here but were removed to keep a single source of truth.
export { Spinner, InlineError, InlineSuccess } from "./primitive.jsx";
