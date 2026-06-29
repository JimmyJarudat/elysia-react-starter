import { describe, expect, test } from "bun:test";
import {
  checkInjection,
  checkInjectionFields,
  checkInjectionFieldsAll,
  escapeHtml,
  stripHtmlTags,
} from "../../../../frontend/src/utils/injectionGuard";

describe("frontend injection guard", () => {
  test("allows ordinary text", () => {
    expect(checkInjection("normal project note").safe).toBe(true);
  });

  test("blocks high confidence xss and sql payloads", () => {
    const xss = checkInjection('<img src=x onerror="alert(1)">');
    const sql = checkInjection("' OR 1=1--");

    expect(xss.safe).toBe(false);
    expect(xss.severity).toBe("block");
    expect(xss.type).toBe("xss");
    expect(sql.safe).toBe(false);
    expect(sql.severity).toBe("block");
    expect(sql.type).toBe("sql");
  });

  test("warns on template expressions", () => {
    const result = checkInjection("Hello {{ user.name }}");

    expect(result.safe).toBe(false);
    expect(result.severity).toBe("warn");
    expect(result.type).toBe("template");
  });

  test("returns block findings before warn findings for multi-field checks", () => {
    const result = checkInjectionFields({
      title: "Hello {{ name }}",
      body: "<script>alert(1)</script>",
    });

    expect(result?.field).toBe("body");
    expect(result?.result.severity).toBe("block");
  });

  test("collects all unsafe fields", () => {
    const results = checkInjectionFieldsAll({
      title: "safe",
      body: "Hello {{ name }}",
      comment: "' OR 1=1--",
    });

    expect(results).toHaveLength(2);
    expect(results.map((item) => item.field)).toEqual(["body", "comment"]);
  });

  test("provides basic display sanitizers", () => {
    expect(stripHtmlTags("<b>Hello</b> <script>alert(1)</script>")).toBe("Hello alert(1)");
    expect(escapeHtml(`<div class="x">Tom & Jerry's</div>`)).toBe(
      "&lt;div class=&quot;x&quot;&gt;Tom &amp; Jerry&#039;s&lt;/div&gt;",
    );
  });
});
