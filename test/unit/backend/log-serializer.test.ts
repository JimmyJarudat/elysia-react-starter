import { describe, expect, test } from "bun:test";
import { serializeLogValue } from "../../../backend/src/utils/log-serializer";

describe("backend serializeLogValue", () => {
  test("serializes nullish values as null", () => {
    expect(serializeLogValue(null)).toBe(null);
    expect(serializeLogValue(undefined)).toBe(null);
  });

  test("serializes bigint and Error values safely", () => {
    expect(serializeLogValue({ id: 10n })).toBe('{"id":"10"}');

    const serializedError = serializeLogValue(new Error("boom"));
    expect(serializedError?.includes('"message":"boom"')).toBe(true);
    expect(serializedError?.includes('"name":"Error"')).toBe(true);
  });

  test("marks circular references and truncates long output", () => {
    const value: { name: string; self?: unknown } = { name: "loop" };
    value.self = value;

    expect(serializeLogValue(value)).toBe('{"name":"loop","self":"[Circular]"}');
    expect(serializeLogValue({ message: "x".repeat(100) }, 40)).toBe('{"message":"xxxxxxxxxxxxx...[truncated]');
  });
});
