import { Organization } from "../models/index.js";

// Turn an arbitrary name into a URL-safe slug base.
// "Acme, Inc." -> "acme-inc"
const slugify = (input) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens

// Produce a slug that is unique across Organizations. Falls back to a random
// suffix if the name slugifies to an empty string (e.g. all punctuation), and
// appends -2, -3, … on collision.
export const generateUniqueOrgSlug = async (name) => {
  let base = slugify(name);
  if (!base) {
    base = `org-${Math.random().toString(36).slice(2, 8)}`;
  }

  let slug = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Organization.exists({ slug })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
};
