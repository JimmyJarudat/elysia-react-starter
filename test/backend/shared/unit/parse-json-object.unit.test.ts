import { describe, expect, test } from "bun:test";
import { parseJsonObject } from "../../../../backend/src/utils/parse-json-object";

describe("backend parseJsonObject", () => {
  test("returns an object for valid JSON objects", () => {
    expect(parseJsonObject('{"enabled":true,"count":3}')).toEqual({
      enabled: true,
      count: 3,
    });
  });

  test("returns an empty object for invalid or non-object values", () => {
    expect(parseJsonObject()).toEqual({});
    expect(parseJsonObject(null)).toEqual({});
    expect(parseJsonObject("not-json")).toEqual({});
    expect(parseJsonObject("[1,2,3]")).toEqual({});
    expect(parseJsonObject('"text"')).toEqual({});
  });
});
