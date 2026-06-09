import ExcelJS from "exceljs";

export interface ErrorLogsExcelRecord {
  id: bigint;
  timestamp: Date;
  level: string;
  message: string;
  stack_trace: string | null;
  source: string | null;
  code: string | null;
  user_id: number | null;
  username: string | null;
  request_path: string | null;
  request_method: string | null;
  ip_address: string | null;
  context: string | null;
  resolved: boolean;
  resolved_at: Date | null;
}

export interface BuildErrorLogsExcelInput {
  rows: AsyncIterable<ErrorLogsExcelRecord[]>;
  filePath: string;
  filename: string;
  totalCount: number;
  start: Date;
  end: Date;
  stats: { errorCount: number; warnCount: number; fatalCount: number; resolvedCount: number };
  filters: {
    search?: string;
    level?: string;
    resolved?: string;
    startDate?: string;
    endDate?: string;
  };
}

const formatDT = (date?: Date | null) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(date);
};

const safeText = (value?: string | number | boolean | null, max = 1000) => {
  if (value === null || value === undefined || value === "") return "-";
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}…[truncated]` : s;
};

const asPercent = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";

export async function buildErrorLogsExcel(input: BuildErrorLogsExcelInput) {
  const { rows, filePath, filename, totalCount, stats, filters } = input;

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: true,
    useSharedStrings: false,
  });

  const titleFill    = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F172A" } };
  const headerFill   = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF4F46E5" } };
  const sectionFill  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFCE7F3" } };
  const subtitleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFDF2F8" } };
  const cardFill     = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
  const errorFill    = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEE2E2" } };
  const warnFill     = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEF3C7" } };
  const fatalFill    = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFDE8FF" } };
  const resolvedFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFD1FAE5" } };

  const border = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
  const thinBorder = { top: border, left: border, bottom: border, right: border };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" } };
  const labelFont  = { bold: true, color: { argb: "FF334155" } };

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  summarySheet.columns = [{ width: 24 }, { width: 32 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  summarySheet.mergeCells("A1:F2");
  summarySheet.getCell("A1").value = "Error Logs Export";
  summarySheet.getCell("A1").font = { ...headerFont, size: 22 };
  summarySheet.getCell("A1").fill = titleFill;
  summarySheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

  summarySheet.mergeCells("A4:F4");
  summarySheet.getCell("A4").value = "Export Details";
  summarySheet.getCell("A4").font = { bold: true, color: { argb: "FF0F172A" } };
  summarySheet.getCell("A4").fill = sectionFill;

  [
    ["Exported At", formatDT(new Date()),              "Rows Exported",  totalCount,                         "Total Matching", totalCount],
    ["Date From",   safeText(filters.startDate ?? ""), "Date To",        safeText(filters.endDate ?? ""),    "Export Limit",   "No limit"],
    ["Search",      safeText(filters.search),          "Level",          filters.level ?? "all",             "Resolved",       filters.resolved ?? "all"],
  ].forEach((values, index) => {
    const row = summarySheet.getRow(5 + index);
    values.forEach((value, vi) => { row.getCell(vi + 1).value = value; });
    [1, 3, 5].forEach((col) => { row.getCell(col).font = labelFont; row.getCell(col).fill = subtitleFill; });
    [2, 4, 6].forEach((col) => { row.getCell(col).fill = cardFill; });
  });

  summarySheet.mergeCells("A10:D10");
  summarySheet.getCell("A10").value = "Key Metrics";
  summarySheet.getCell("A10").font = { bold: true, color: { argb: "FF0F172A" } };
  summarySheet.getCell("A10").fill = sectionFill;

  ["Level / Status", "Count", "Share", "Notes"].forEach((value, i) => {
    const cell = summarySheet.getRow(11).getCell(i + 1);
    cell.value = value;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const unresolvedCount = totalCount - stats.resolvedCount;
  [
    ["ERROR",      stats.errorCount,   asPercent(stats.errorCount, totalCount),   "level = error",    errorFill],
    ["WARN",       stats.warnCount,    asPercent(stats.warnCount, totalCount),    "level = warn",     warnFill],
    ["FATAL",      stats.fatalCount,   asPercent(stats.fatalCount, totalCount),   "level = fatal",    fatalFill],
    ["Resolved",   stats.resolvedCount, asPercent(stats.resolvedCount, totalCount), "resolved = true", resolvedFill],
    ["Unresolved", unresolvedCount,    asPercent(unresolvedCount, totalCount),    "resolved = false", errorFill],
  ].forEach((values, index) => {
    const row = summarySheet.getRow(12 + index);
    const [label, count, share, notes, fill] = values;
    row.getCell(1).value = label as string;
    row.getCell(2).value = count as number;
    row.getCell(3).value = share as string;
    row.getCell(4).value = notes as string;
    row.getCell(1).font = labelFont;
    row.eachCell((cell) => { cell.fill = fill as ExcelJS.Fill; });
  });

  for (let r = 1; r <= 16; r++) {
    const maxCol = r >= 10 ? 4 : 6;
    for (let c = 1; c <= maxCol; c++) {
      const cell = summarySheet.getRow(r).getCell(c);
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", wrapText: true };
    }
    summarySheet.getRow(r).commit();
  }
  summarySheet.commit();

  // ── Sheet 2: Error Logs (streaming) ───────────────────────────────────────
  const logsSheet = workbook.addWorksheet("Error Logs", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  logsSheet.columns = [
    { header: "#",              key: "no",            width: 8  },
    { header: "Timestamp",      key: "timestamp",     width: 24 },
    { header: "Level",          key: "level",         width: 10 },
    { header: "Message",        key: "message",       width: 60 },
    { header: "Source",         key: "source",        width: 22 },
    { header: "Code",           key: "code",          width: 18 },
    { header: "Username",       key: "username",      width: 22 },
    { header: "Request",        key: "request",       width: 36 },
    { header: "IP Address",     key: "ipAddress",     width: 18 },
    { header: "Resolved",       key: "resolved",      width: 12 },
    { header: "Resolved At",    key: "resolvedAt",    width: 24 },
    { header: "Stack Trace",    key: "stackTrace",    width: 60 },
  ];
  logsSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  logsSheet.autoFilter = { from: "A1", to: "L1" };
  logsSheet.getRow(1).commit();

  let rowNumber = 0;
  const sourceMap = new Map<string, { error: number; warn: number; fatal: number }>();

  for await (const batch of rows) {
    for (const log of batch) {
      rowNumber += 1;

      const src = log.source ?? "(unknown)";
      const ts = sourceMap.get(src) ?? { error: 0, warn: 0, fatal: 0 };
      if (log.level === "error") ts.error += 1;
      else if (log.level === "warn") ts.warn += 1;
      else if (log.level === "fatal") ts.fatal += 1;
      sourceMap.set(src, ts);

      const row = logsSheet.addRow({
        no: rowNumber,
        timestamp: formatDT(log.timestamp),
        level: log.level.toUpperCase(),
        message: safeText(log.message, 500),
        source: safeText(log.source),
        code: safeText(log.code),
        username: safeText(log.username),
        request: log.request_method && log.request_path ? `${log.request_method} ${log.request_path}` : safeText(log.request_path),
        ipAddress: safeText(log.ip_address),
        resolved: log.resolved ? "Yes" : "No",
        resolvedAt: formatDT(log.resolved_at),
        stackTrace: safeText(log.stack_trace, 1000),
      });

      const levelCell = row.getCell("level");
      if (log.level === "error") levelCell.fill = errorFill;
      else if (log.level === "warn") levelCell.fill = warnFill;
      else if (log.level === "fatal") levelCell.fill = fatalFill;

      if (log.resolved) row.getCell("resolved").fill = resolvedFill;

      row.eachCell((cell) => { cell.alignment = { vertical: "middle", wrapText: false }; });
      row.commit();
    }
  }
  logsSheet.commit();

  // ── Sheet 3: By Source ────────────────────────────────────────────────────
  const sourceSheet = workbook.addWorksheet("By Source", { views: [{ showGridLines: false }] });
  sourceSheet.columns = [
    { header: "Source",  key: "source",  width: 30 },
    { header: "ERROR",   key: "error",   width: 14 },
    { header: "WARN",    key: "warn",    width: 14 },
    { header: "FATAL",   key: "fatal",   width: 14 },
    { header: "Total",   key: "total",   width: 14 },
  ];
  sourceSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  sourceSheet.getRow(1).commit();

  [...sourceMap.entries()]
    .map(([source, stat]) => ({
      source,
      error: stat.error,
      warn: stat.warn,
      fatal: stat.fatal,
      total: stat.error + stat.warn + stat.fatal,
    }))
    .sort((a, b) => b.total - a.total)
    .forEach((value) => {
      const row = sourceSheet.addRow(value);
      row.eachCell((cell) => { cell.border = thinBorder; cell.alignment = { vertical: "middle" }; });
      if (value.error > 0) row.getCell("error").fill = errorFill;
      if (value.warn > 0) row.getCell("warn").fill = warnFill;
      if (value.fatal > 0) row.getCell("fatal").fill = fatalFill;
      row.commit();
    });
  sourceSheet.commit();

  await workbook.commit();
  return { filePath, filename, exportedCount: rowNumber };
}
