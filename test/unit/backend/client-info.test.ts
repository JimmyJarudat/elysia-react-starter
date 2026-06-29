import { describe, expect, test } from "bun:test";
import {
  getClientIP,
  getClientInfo,
  getClientSummary,
  getUserAgent,
  isAPITool,
  isMobileDevice,
  parseUserAgent,
} from "../../../backend/src/utils/clientInfo";

describe("backend getClientIP", () => {
  test("returns 127.0.0.1 when the request has no headers", () => {
    expect(getClientIP({})).toBe("127.0.0.1");
    expect(getClientIP(null)).toBe("127.0.0.1");
  });

  test("prefers a private IP from x-forwarded-for over a public one", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.5" },
    });

    expect(getClientIP(request)).toBe("10.0.0.5");
  });

  test("falls back to the public IP when no usable private IP exists", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.20" },
    });

    expect(getClientIP(request)).toBe("203.0.113.10");
  });

  test("ignores loopback/invalid private candidates", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "127.0.0.1, 203.0.113.10" },
    });

    expect(getClientIP(request)).toBe("203.0.113.10");
  });

  test("parses RFC 7239 Forwarded header with for= entries", () => {
    const request = new Request("http://localhost", {
      headers: { forwarded: 'for="192.168.1.5";proto=https, for=203.0.113.10' },
    });

    expect(getClientIP(request)).toBe("192.168.1.5");
  });

  test("normalizes IPv6-mapped IPv4 addresses", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "::ffff:203.0.113.10" },
    });

    expect(getClientIP(request)).toBe("203.0.113.10");
  });

  test("supports plain object headers (non-Headers instance)", () => {
    const request = { headers: { "x-forwarded-for": "203.0.113.10" } };

    expect(getClientIP(request)).toBe("203.0.113.10");
  });

  test("falls back to request.ip when no usable header is present", () => {
    const request = { headers: {}, ip: "203.0.113.99" };

    expect(getClientIP(request)).toBe("203.0.113.99");
  });

  test("defaults to 127.0.0.1 when nothing else is available", () => {
    const request = { headers: {} };

    expect(getClientIP(request)).toBe("127.0.0.1");
  });
});

describe("backend getUserAgent", () => {
  test("reads user-agent from a Headers-like request", () => {
    const request = new Request("http://localhost", {
      headers: { "user-agent": "curl/8.0" },
    });

    expect(getUserAgent(request)).toBe("curl/8.0");
  });

  test("reads user-agent from a plain object request", () => {
    expect(getUserAgent({ headers: { "user-agent": "Mozilla/5.0" } })).toBe("Mozilla/5.0");
  });

  test("returns null when missing", () => {
    expect(getUserAgent({ headers: {} })).toBe(null);
    expect(getUserAgent(null)).toBe(null);
  });
});

describe("backend parseUserAgent", () => {
  test("returns Unknown defaults for a null user agent", () => {
    expect(parseUserAgent(null)).toEqual({
      browser: "Unknown",
      os: "Unknown",
      device_type: "Unknown",
      platform: "Unknown",
    });
  });

  test("detects common desktop browsers and OS", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      ),
    ).toEqual({ browser: "Chrome", os: "Windows", device_type: "Desktop", platform: "Web" });

    expect(
      parseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15"),
    ).toEqual({ browser: "Safari", os: "macOS", device_type: "Desktop", platform: "Web" });

    expect(parseUserAgent("Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0")).toEqual({
      browser: "Firefox",
      os: "Linux",
      device_type: "Desktop",
      platform: "Web",
    });
  });

  test("distinguishes Edge from Chrome", () => {
    expect(parseUserAgent("Mozilla/5.0 Chrome/120.0 Edg/120.0").browser).toBe("Edge");
  });

  test("detects mobile and tablet devices", () => {
    expect(
      parseUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Chrome/120.0").device_type,
    ).toBe("Mobile");

    expect(parseUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0)").device_type).toBe("Tablet");
    expect(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)").os).toBe("iOS");
  });

  test("detects API tooling clients", () => {
    expect(parseUserAgent("PostmanRuntime/7.36.0")).toEqual({
      browser: "Postman",
      os: "Unknown",
      device_type: "API Tool",
      platform: "API Testing",
    });

    expect(parseUserAgent("curl/8.4.0").platform).toBe("API Testing");
    expect(parseUserAgent("insomnia/2023.5.0").browser).toBe("Insomnia");
  });
});

describe("backend getClientInfo / getClientSummary / helpers", () => {
  test("combines IP and user-agent parsing into a single object", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
        "user-agent": "curl/8.0",
      },
    });

    expect(getClientInfo(request)).toEqual({
      ip_address: "203.0.113.10",
      user_agent: "curl/8.0",
      browser: "cURL",
      os: "Unknown",
      device_type: "API Tool",
      platform: "API Testing",
    });
  });

  test("getClientSummary highlights API testing tools", () => {
    expect(
      getClientSummary({
        ip_address: "1.2.3.4",
        user_agent: "curl/8.0",
        browser: "cURL",
        os: "Unknown",
        device_type: "API Tool",
        platform: "API Testing",
      }),
    ).toBe("cURL (API Testing)");
  });

  test("getClientSummary formats regular device info", () => {
    expect(
      getClientSummary({
        ip_address: "1.2.3.4",
        user_agent: "ua",
        browser: "Chrome",
        os: "Windows",
        device_type: "Desktop",
        platform: "Web",
      }),
    ).toBe("Desktop - Chrome on Windows");
  });

  test("isAPITool and isMobileDevice flag the right platforms", () => {
    const apiClient = { ip_address: "", user_agent: null, browser: "", os: "", device_type: "API Tool", platform: "API Testing" };
    const mobileClient = { ip_address: "", user_agent: null, browser: "", os: "", device_type: "Mobile", platform: "Web" };
    const tabletClient = { ip_address: "", user_agent: null, browser: "", os: "", device_type: "Tablet", platform: "Web" };
    const desktopClient = { ip_address: "", user_agent: null, browser: "", os: "", device_type: "Desktop", platform: "Web" };

    expect(isAPITool(apiClient)).toBe(true);
    expect(isAPITool(desktopClient)).toBe(false);
    expect(isMobileDevice(mobileClient)).toBe(true);
    expect(isMobileDevice(tabletClient)).toBe(true);
    expect(isMobileDevice(desktopClient)).toBe(false);
  });
});
