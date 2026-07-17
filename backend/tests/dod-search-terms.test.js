import { describe, it, expect } from "vitest";
import { extractSearchTerms } from "../src/dod/github/search-terms.js";

describe("extractSearchTerms", () => {
  it("extracts deterministic, deduped terms from requirement text, skipping stopwords and short words", () => {
    const requirements = [
      { text: "Route uses verifyJWT middleware" },
      { text: "Invalid token returns 401 for the request" },
    ];

    const terms = extractSearchTerms(requirements);

    expect(terms).toContain("verifyJWT");
    expect(terms).toContain("middleware");
    expect(terms).toContain("token");
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("for");
  });

  it("is stable across repeated calls on the same requirements (order and content)", () => {
    const requirements = [{ text: "Refresh token is issued on login" }];
    expect(extractSearchTerms(requirements)).toEqual(extractSearchTerms(requirements));
  });

  it("caps the number of terms", () => {
    const requirements = [
      { text: "alpha bravo charlie delta echo foxtrot golf hotel india juliet" },
    ];
    const terms = extractSearchTerms(requirements, { maxTerms: 3 });
    expect(terms).toHaveLength(3);
  });
});
