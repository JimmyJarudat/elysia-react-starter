import { describe, expect, test } from "bun:test";
import {
  getSortByFromParams,
  getSortOrderFromParams,
  nextSortParams,
} from "../../../../frontend/src/utils/sortParams";

describe("frontend sort params", () => {
  test("reads sort order with desc fallback", () => {
    expect(getSortOrderFromParams(new URLSearchParams("sortOrder=asc"))).toBe("asc");
    expect(getSortOrderFromParams(new URLSearchParams("sortOrder=desc"))).toBe("desc");
    expect(getSortOrderFromParams(new URLSearchParams("sortOrder=invalid"))).toBe("desc");
  });

  test("reads only allowed sort fields", () => {
    const fields = ["username", "created_at"] as const;

    expect(getSortByFromParams(new URLSearchParams("sortBy=username"), fields, "created_at")).toBe("username");
    expect(getSortByFromParams(new URLSearchParams("sortBy=email"), fields, "created_at")).toBe("created_at");
  });

  test("builds the next sort params and resets page", () => {
    const next = nextSortParams(
      new URLSearchParams("page=3&filter=active&sortBy=username&sortOrder=asc"),
      "username",
      "username",
      "asc",
      "created_at",
    );

    expect(next.toString()).toBe("filter=active&sortBy=username");
  });

  test("removes default sort params", () => {
    const next = nextSortParams(
      new URLSearchParams("sortBy=username&sortOrder=desc&page=2"),
      "created_at",
      "username",
      "desc",
      "created_at",
    );

    expect(next.toString()).toBe("sortOrder=asc");
  });
});
