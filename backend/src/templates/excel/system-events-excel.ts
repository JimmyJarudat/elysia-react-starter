import ExcelJS from "exceljs";

export interface SystemEventsExcelRecord {
  id: bigint;
  timestamp: Date;
  event_type: string;
  event_name: string;
  status: string;
  duration_ms: number | null;
  message: string | null;
  details: string | null;
  triggered_by: string | null;
}

export interface BuildSystemEventsExcelInput {
  rows: AsyncIterable<SystemEventsExcelRecord[]>;
  filePath: string;
  filename: string;
  totalCount: number;
  start: Date;
  end: Date;
  stats: { successCount: number; failedCount: number; skippedCount: number };
  filters: {
    search?: string;
    eventType?: string;
    status?: string;
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

const safeText = (value?: string | number | null, max = 1000) => {
  if (value === null || value === undefined || value === "") return "-";
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}…[truncated]` : s;
};

const formatDuration = (ms: number | null) => {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const asPercent = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";

export async function buildSystemEventsExcel(input: BuildSystemEventsExcelInput) {
  const { rows, filePath, filename, totalCount, stats, filters } = input;

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: true,
    useSharedStrings: false,
  });

  const titleFill    = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F172A" } };
  const headerFill   = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF4F46E5" } };
  const sectionFill  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE0F2FE" } };
  const subtitleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF0F9FF" } };
  const cardFill     = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
  const successFill  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFD1FAE5" } };
  const failedFill   = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEE2E2" } };
  const skippedFill  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEF3C7" } };
  const runningFill  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE0F2FE" } };

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
  summarySheet.getCell("A1").value = "System Events Export";
  summarySheet.getCell("A1").font = { ...headerFont, size: 22 };
  summarySheet.getCell("A1").fill = titleFill;
  summarySheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

  summarySheet.mergeCells("A4:F4");
  summarySheet.getCell("A4").value = "Export Details";
  summarySheet.getCell("A4").font = { bold: true, color: { argb: "FF0F172A" } };
  summarySheet.getCell("A4").fill = sectionFill;

  [
    ["Exported At", formatDT(new Date()),              "Rows Exported", totalCount,                     "Total Matching", totalCount],
    ["Date From",   safeText(filters.startDate ?? ""), "Date To",       safeText(filters.endDate ?? ""), "Export Limit",  "No limit"],
    ["Search",      safeText(filters.search),          "Event Type",    filters.eventType ?? "all",      "Status",        filters.status ?? "all"],
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

  ["Status", "Count", "Share", "Notes"].forEach((value, i) => {
    const cell = summarySheet.getRow(11).getCell(i + 1);
    cell.value = value;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const otherCount = totalCount - stats.successCount - stats.failedCount - stats.skippedCount;
  [
    ["success", stats.successCount, asPercent(stats.successCount, totalCount), "status = success", successFill],
    ["failed",  stats.failedCount,  asPercent(stats.failedCount, totalCount),  "status = failed",  failedFill],
    ["skipped", stats.skippedCount, asPercent(stats.skippedCount, totalCount), "status = skipped", skippedFill],
    ["other",   otherCount,         asPercent(otherCount, totalCount),         "running / etc.",   runningFill],
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

  for (let r = 1; r <= 15; r++) {
    const maxCol = r >= 10 ? 4 : 6;
    for (let c = 1; c <= maxCol; c++) {
      const cell = summarySheet.getRow(r).getCell(c);
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", wrapText: true };
    }
    summarySheet.getRow(r).commit();
  }
  summarySheet.commit();

  // ── Sheet 2: System Events (streaming) ────────────────────────────────────
  const eventsSheet = workbook.addWorksheet("System Events", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  eventsSheet.columns = [
    { header: "#",            key: "no",          width: 8  },
    { header: "Timestamp",    key: "timestamp",   width: 24 },
    { header: "Event Type",   key: "eventType",   width: 18 },
    { header: "Event Name",   key: "eventName",   width: 30 },
    { header: "Status",       key: "status",      width: 12 },
    { header: "Duration",     key: "duration",    width: 14 },
    { header: "Message",      key: "message",     width: 50 },
    { header: "Triggered By", key: "triggeredBy", width: 22 },
    { header: "Details",      key: "details",     width: 50 },
  ];
  eventsSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  eventsSheet.autoFilter = { from: "A1", to: "I1" };
  eventsSheet.getRow(1).commit();

  let rowNumber = 0;
  const typeMap = new Map<string, { success: number; failed: number; skipped: number; other: number }>();

  for await (const batch of rows) {
    for (const event of batch) {
      rowNumber += 1;

      const et = typeMap.get(event.event_type) ?? { success: 0, failed: 0, skipped: 0, other: 0 };
      if (event.status === "success") et.success += 1;
      else if (event.status === "failed") et.failed += 1;
      else if (event.status === "skipped") et.skipped += 1;
      else et.other += 1;
      typeMap.set(event.event_type, et);

      const row = eventsSheet.addRow({
        no: rowNumber,
        timestamp: formatDT(event.timestamp),
        eventType: event.event_type,
        eventName: event.event_name,
        status: event.status,
        duration: formatDuration(event.duration_ms),
        message: safeText(event.message),
        triggeredBy: safeText(event.triggered_by),
        details: safeText(event.details, 500),
      });

      const statusCell = row.getCell("status");
      if (event.status === "success") statusCell.fill = successFill;
      else if (event.status === "failed") statusCell.fill = failedFill;
      else if (event.status === "skipped") statusCell.fill = skippedFill;
      else if (event.status === "running") statusCell.fill = runningFill;

      row.eachCell((cell) => { cell.alignment = { vertical: "middle", wrapText: false }; });
      row.commit();
    }
  }
  eventsSheet.commit();

  // ── Sheet 3: By Event Type ────────────────────────────────────────────────
  const typeSheet = workbook.addWorksheet("By Event Type", { views: [{ showGridLines: false }] });
  typeSheet.columns = [
    { header: "Event Type", key: "eventType", width: 24 },
    { header: "success",    key: "success",   width: 14 },
    { header: "failed",     key: "failed",    width: 14 },
    { header: "skipped",    key: "skipped",   width: 14 },
    { header: "other",      key: "other",     width: 14 },
    { header: "Total",      key: "total",     width: 14 },
  ];
  typeSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  typeSheet.getRow(1).commit();

  [...typeMap.entries()]
    .map(([eventType, stat]) => ({
      eventType,
      success: stat.success,
      failed: stat.failed,
      skipped: stat.skipped,
      other: stat.other,
      total: stat.success + stat.failed + stat.skipped + stat.other,
    }))
    .sort((a, b) => b.total - a.total)
    .forEach((value) => {
      const row = typeSheet.addRow(value);
      row.eachCell((cell) => { cell.border = thinBorder; cell.alignment = { vertical: "middle" }; });
      if (value.success > 0) row.getCell("success").fill = successFill;
      if (value.failed > 0) row.getCell("failed").fill = failedFill;
      if (value.skipped > 0) row.getCell("skipped").fill = skippedFill;
      row.commit();
    });
  typeSheet.commit();

  await workbook.commit();
  return { filePath, filename, exportedCount: rowNumber };
}
