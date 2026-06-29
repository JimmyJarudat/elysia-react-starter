import { describe, expect, test } from "bun:test";
import { getCurrentUserFromHeaders } from "../../../backend/src/utils/get-current-user";

describe("backend getCurrentUserFromHeaders", () => {
  test("returns parsed user data from x-user-data", () => {
    const user = {
      id: 1,
      username: "admin",
      email: "admin@example.com",
      roles: ["SUPERADMIN"],
      permissions: ["users.read"],
      sessionId: 10,
      profile: null,
    };
    const request = new Request("http://localhost/api/users", {
      headers: { "x-user-data": JSON.stringify(user) },
    });

    expect(getCurrentUserFromHeaders(request)).toEqual(user);
  });

  test("returns null when the header is missing", () => {
    const request = new Request("http://localhost/api/users");

    expect(getCurrentUserFromHeaders(request)).toBe(null);
  });
});
