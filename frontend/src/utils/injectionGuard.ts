/**
 * Frontend injection guard — defense-in-depth layer.
 * ไม่ใช่แนวรับหลัก (backend + Prisma parameterized queries คือแนวรับจริง)
 * แต่ให้ user เห็น warning ทันทีก่อน submit ถึง server
 *
 * ห้ามใช้กับ: type="password", type="email", type="date", type="number", type="url", type="file"
 * ใช้กับ: text inputs, search inputs, textarea, form fields ที่รับข้อความเสรี
 */

export type InjectionType = "xss" | "sql" | "template";
export type InjectionSeverity = "block" | "warn";

export interface InjectionResult {
  safe: boolean;
  severity?: InjectionSeverity;
  type?: InjectionType;
  message: string | null;
}

// ---------------------------------------------------------------------------
// XSS Patterns
// ---------------------------------------------------------------------------

/**
 * HIGH confidence — block ทันที
 * pattern เหล่านี้แทบไม่มีทาง false positive ในข้อความทั่วไป
 */
const XSS_BLOCK_PATTERNS: RegExp[] = [
  // <script ...> / </script>
  /<script[\s\S]*?>/i,
  /<\/script\s*>/i,

  // javascript: / vbscript: URI scheme (รวม whitespace และ encoded colon)
  /j[\s\u0000-\u001f]*a[\s\u0000-\u001f]*v[\s\u0000-\u001f]*a[\s\u0000-\u001f]*s[\s\u0000-\u001f]*c[\s\u0000-\u001f]*r[\s\u0000-\u001f]*i[\s\u0000-\u001f]*p[\s\u0000-\u001f]*t[\s\u0000-\u001f]*\s*:/i,
  /vbscript\s*:/i,

  // data:text/html URI
  /data\s*:\s*text\/html/i,

  // SVG vectors — onload, onbegin etc.
  /<svg[\s\S]*?>/i,

  // inline event handlers (on* = "...") — รองรับ whitespace/newline ระหว่าง attr กับ =
  /\bon\w+[\s\n\r\t]*=[\s\n\r\t]*["'`{(]/i,

  // อันตรายสูง: <iframe>, <object>, <embed>, <applet>
  /<\s*(iframe|object|embed|applet)\b/i,

  // <img onerror=...> / <img onload=...>
  /<img[^>]*\bon\w+\s*=/i,

  // CSS expression() — IE legacy
  /expression\s*\(/i,

  // eval / setTimeout / setInterval ที่รับ string
  /\beval\s*\(/i,
  /\bset(?:Timeout|Interval)\s*\(\s*["'`]/i,

  // document.cookie / document.write / innerHTML
  /document\s*\.\s*(cookie|write|writeln|domain|location)\b/i,
  /\.innerHTML\s*=/i,

  // URL-encoded < > ที่รูปแบบชัดเจนว่าเป็น tag
  /%3c\s*script/i,
  /%3c\s*\/\s*script/i,
  /%3c\s*(iframe|object|embed|svg)\b/i,

  // Unicode/hex escape ของ < > ในรูปแบบ \uXXXX หรือ \xXX
  /\\u003c.*?script/i,
  /\\x3c.*?script/i,

  // HTML entity encoded <script>
  /&#\s*(?:60|x3c)\s*;.*?script/i,

  // srcdoc attribute (iframe bypass)
  /\bsrcdoc\s*=/i,

  // style attribute ที่มี url(...) — CSS injection
  /\bstyle\s*=\s*["'][^"']*url\s*\(/i,

  // -moz-binding (old Firefox CSS injection)
  /-moz-binding\s*:/i,

  // base href injection
  /<base\s[^>]*href\s*=/i,
];

/**
 * MEDIUM confidence — warn แต่ไม่ block
 * อาจเป็น false positive ได้ในบางบริบท
 */
const XSS_WARN_PATTERNS: RegExp[] = [
  // HTML entities ทั่วไปที่อาจเป็น encoding bypass
  /&#x?[0-9a-f]{1,6};/i,

  // Unicode escape sequence
  /\\u00[3-9][0-9a-fA-F]/,

  // <form action=...> injection
  /<form\b[^>]*\baction\s*=/i,

  // <link rel=... href=...>
  /<link\b[^>]*\bhref\s*=/i,

  // <meta http-equiv=...>
  /<meta\b[^>]*\bhttp-equiv\s*=/i,
];

// ---------------------------------------------------------------------------
// SQL Patterns
// ---------------------------------------------------------------------------

/**
 * HIGH confidence — block ทันที
 */
const SQL_BLOCK_PATTERNS: RegExp[] = [
  // UNION SELECT (classic)
  /\bUNION\s+(?:ALL\s+)?SELECT\b/i,

  // stacked query + DDL: '; DROP TABLE ...
  /['"`]\s*;\s*(?:DROP|DELETE|TRUNCATE|ALTER|CREATE)\s+(?:TABLE|DATABASE|INDEX|VIEW)\b/i,

  // comment-based auth bypass: ' OR 1=1--  / ' OR 1=1#
  /'\s*(?:OR|AND)\s+['"\d(].*?(?:--|#|\/\*)/i,

  // Boolean-based: ' OR '1'='1  / ' OR 1=1
  /'\s*(?:OR|AND)\s+(?:'?\d+'?\s*=\s*'?\d+'?|true\b)/i,

  // Time-based blind
  /\bSLEEP\s*\(\s*\d+\s*\)/i,
  /\bWAITFOR\s+DELAY\s+['"`]/i,
  /\bPG_SLEEP\s*\(\s*\d+\s*\)/i,

  // MySQL BENCHMARK
  /\bBENCHMARK\s*\(\s*\d+\s*,/i,

  // LOAD_FILE / INTO OUTFILE / DUMPFILE
  /\bLOAD_FILE\s*\(/i,
  /\bINTO\s+(?:OUT|DUMP)FILE\b/i,

  // Information schema leak
  /\binformation_schema\b/i,
  /\bsys\.tables\b/i,
  /\bsysobjects\b/i,

  // xp_cmdshell (MSSQL)
  /\bxp_cmdshell\b/i,

  // EXEC / EXECUTE + sp_ (MSSQL stored proc)
  /\bEXEC(?:UTE)?\s+(?:sp_|xp_)/i,

  // hex-encoded string bypass
  /0x[0-9a-fA-F]{4,}/,

  // CHAR() concat bypass: CHAR(39)||CHAR(79)...
  /\bCHAR\s*\(\s*\d+\s*\)(?:\s*[+|,]\s*\bCHAR\s*\()/i,
];

/**
 * MEDIUM confidence — warn แต่ไม่ block
 * เช่น -- ใช้ทั่วไป, # ใช้เป็น hashtag
 */
const SQL_WARN_PATTERNS: RegExp[] = [
  // single quote + comment (อาจเป็น truncation attempt)
  /'\s*--/,
  /'\s*#/,

  // bare UNION SELECT (ไม่มี quote นำ)
  /\bUNION\s+SELECT\b/i,

  // subquery pattern
  /'\s*;\s*SELECT\b/i,

  // HAVING / GROUP BY injection
  /\bHAVING\s+\d+\s*=\s*\d+/i,

  // ORDER BY injection
  /\bORDER\s+BY\s+\d+\b/i,
];

// ---------------------------------------------------------------------------
// Template Injection Patterns
// ---------------------------------------------------------------------------

/**
 * Server-side template injection (SSTI) — ถ้า frontend ส่งค่าไปต่อให้ template engine
 * เช่น Jinja2, Twig, Freemarker, Velocity, Handlebars, EJS
 */
const TEMPLATE_WARN_PATTERNS: RegExp[] = [
  // Jinja2 / Twig: {{7*7}} / {{config}}
  /\{\{[\s\S]*?\}\}/,

  // Jinja2 block: {% ... %}
  /\{%[\s\S]*?%\}/,

  // Ruby ERB / EJS: <%= ... %>
  /<%=[\s\S]*?%>/,

  // Freemarker: ${...} / #{...}
  /\$\{[\s\S]*?\}/,
  /#\{[\s\S]*?\}/,

  // Velocity: #set / #foreach
  /#(?:set|foreach|if|include|parse)\s*\(/i,

  // Smarty: {$var} / {func arg}
  /\{\$\w+\}/,
];

// ---------------------------------------------------------------------------
// Core check function
// ---------------------------------------------------------------------------

function matchPatterns(
  value: string,
  blockPatterns: RegExp[],
  warnPatterns: RegExp[],
  type: InjectionType,
  blockMessage: string,
  warnMessage: string,
): InjectionResult | null {
  for (const pattern of blockPatterns) {
    if (pattern.test(value)) {
      return { safe: false, severity: "block", type, message: blockMessage };
    }
  }
  for (const pattern of warnPatterns) {
    if (pattern.test(value)) {
      return { safe: false, severity: "warn", type, message: warnMessage };
    }
  }
  return null;
}

/**
 * ตรวจ string เดียว — คืน InjectionResult
 * ลำดับ: XSS → SQL → Template
 */
export function checkInjection(value: string): InjectionResult {
  if (!value || value.trim() === "") return { safe: true, message: null };

  // XSS
  const xss = matchPatterns(
    value,
    XSS_BLOCK_PATTERNS,
    XSS_WARN_PATTERNS,
    "xss",
    "พบรูปแบบที่อาจเป็นอันตราย (XSS) — กรุณาแก้ไขข้อความ",
    "พบรูปแบบที่อาจเป็น HTML/Script — กรุณาตรวจสอบอีกครั้ง",
  );
  if (xss) return xss;

  // SQL
  const sql = matchPatterns(
    value,
    SQL_BLOCK_PATTERNS,
    SQL_WARN_PATTERNS,
    "sql",
    "พบรูปแบบที่อาจเป็นอันตราย (SQL injection) — กรุณาแก้ไขข้อความ",
    "พบรูปแบบที่อาจเป็น SQL — กรุณาตรวจสอบอีกครั้ง",
  );
  if (sql) return sql;

  // Template injection
  const tmpl = matchPatterns(
    value,
    [], // ไม่มี block-level สำหรับ template (เพราะ false positive สูง)
    TEMPLATE_WARN_PATTERNS,
    "template",
    "",
    "พบรูปแบบที่อาจเป็น template expression — กรุณาตรวจสอบอีกครั้ง",
  );
  if (tmpl) return tmpl;

  return { safe: true, message: null };
}

// ---------------------------------------------------------------------------
// Multi-field helper
// ---------------------------------------------------------------------------

/**
 * ตรวจหลาย fields พร้อมกัน
 * - คืน field แรกที่ severity === "block" ก่อนเสมอ
 * - ถ้าไม่มี block คืน field แรกที่ severity === "warn"
 * - คืน null ถ้าปลอดภัยทุก field
 */
export function checkInjectionFields(
  fields: Record<string, string | null | undefined>,
): { field: string; result: InjectionResult } | null {
  let firstWarn: { field: string; result: InjectionResult } | null = null;

  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const result = checkInjection(value);
    if (!result.safe) {
      if (result.severity === "block") return { field, result };
      if (!firstWarn) firstWarn = { field, result };
    }
  }

  return firstWarn ?? null;
}

// ---------------------------------------------------------------------------
// Batch check (report ทุก field ที่มีปัญหา)
// ---------------------------------------------------------------------------

export interface FieldViolation {
  field: string;
  result: InjectionResult;
}

/**
 * คืน array ของทุก field ที่ไม่ปลอดภัย — ใช้เมื่อต้องการแสดง error หลาย field พร้อมกัน
 */
export function checkInjectionFieldsAll(
  fields: Record<string, string | null | undefined>,
): FieldViolation[] {
  const violations: FieldViolation[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const result = checkInjection(value);
    if (!result.safe) violations.push({ field, result });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Sanitize helper (strip อันตรายออก แทนที่จะ block — ใช้กับ display-only fields)
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags ออกทั้งหมด — ใช้สำหรับ display เท่านั้น
 * ไม่ใช้กับค่าที่จะส่งเข้า database โดยตรง
 */
export function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

/**
 * Escape HTML entities — ใช้ก่อน render ลง DOM โดยไม่ผ่าน React
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}