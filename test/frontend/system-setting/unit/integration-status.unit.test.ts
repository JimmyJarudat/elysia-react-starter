import { describe, expect, test } from "bun:test";
import {
  getIntegrationStatus,
  rowStatusCls,
  statusCls,
} from "../../../../frontend/src/pages/system-setting/integrations/constants";

describe("frontend integration status", () => {
  test("prioritizes loading before enabled and connection state", () => {
    expect(getIntegrationStatus(true, "ok", true)).toEqual({
      label: "กำลังตรวจสอบการเชื่อมต่อ",
      tone: "loading",
      connected: false,
    });
  });

  test("maps disabled, connected, error, and enabled states", () => {
    expect(getIntegrationStatus(false, "ok", false)).toEqual({
      label: "ปิดใช้งาน",
      tone: "disabled",
      connected: false,
    });
    expect(getIntegrationStatus(true, "ok", false).connected).toBe(true);
    expect(getIntegrationStatus(true, "error", false).tone).toBe("error");
    expect(getIntegrationStatus(true, "idle", false).tone).toBe("enabled");
  });

  test("returns class names for status badges", () => {
    expect(statusCls("ok").includes("emerald")).toBe(true);
    expect(statusCls("error").includes("red")).toBe(true);
    expect(statusCls("idle").includes("amber")).toBe(true);

    expect(rowStatusCls("connected").includes("emerald")).toBe(true);
    expect(rowStatusCls("enabled").includes("sky")).toBe(true);
    expect(rowStatusCls("error").includes("red")).toBe(true);
    expect(rowStatusCls("loading").includes("amber")).toBe(true);
    expect(rowStatusCls("disabled").includes("text-light-text-muted")).toBe(true);
  });
});
