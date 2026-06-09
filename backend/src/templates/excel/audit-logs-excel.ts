import ExcelJS from "exceljs";

export interface AuditLogsExcelRecord {
  id: bigint;
  timestamp: Date;
  user_id: number | null;
  username: string | null;
  action: string;
  table_name: string;
  record_id: string;
  before_data: string | null;
  after_data: string | null;
  changed_fields: string | null;
  ip_address: string | null;
  request_id: string | null;
}

export interface BuildAuditLogsExcelInput {
  rows: AsyncIterable<AuditLogsExcelRecord[]>;
  filePath: string;
  filename: string;
  totalCount: number;
  start: Date;
  end: Date;
  stats: { createCount: number; updateCount: number; deleteCount: number };
  filters: {
    search?: string;
    action?: string;
    tableName?: string;
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

const safeText = (value?: string | number | null, max = 2000) => {
  if (value === null || value === undefined || value === "") return "-";
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}…[truncated]` : s;
};

const asPercent = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";

export async function buildAuditLogsExcel(input: BuildAuditLogsExcelInput) {
  const { rows, filePath, filename, totalCount, stats, filters } = input;

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: true,
    useSharedStrings: false,
  });

  const titleFill  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F172A" } };
  const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF4F46E5" } };
  const sectionFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFDDD6FE" } };
  const subtitleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEDE9FE" } };
  const cardFill    = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
  const createFill  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFD1FAE5" } };
  const updateFill  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEF3C7" } };
  const deleteFill  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEE2E2" } };

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
  summarySheet.getCell("A1").value = "Audit Logs Export";
  summarySheet.getCell("A1").font = { ...headerFont, size: 22 };
  summarySheet.getCell("A1").fill = titleFill;
  summarySheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

  summarySheet.mergeCells("A4:F4");
  summarySheet.getCell("A4").value = "Export Details";
  summarySheet.getCell("A4").font = { bold: true, color: { argb: "FF0F172A" } };
  summarySheet.getCell("A4").fill = sectionFill;

  [
    ["Exported At", formatDT(new Date()),            "Rows Exported",   totalCount,                "Total Matching",  totalCount],
    ["Date From",   safeText(filters.startDate ?? ""), "Date To",       safeText(filters.endDate ?? ""), "Export Limit", "No limit"],
    ["Search",      safeText(filters.search),         "Action",         filters.action ?? "all",   "Table",           safeText(filters.tableName ?? "all")],
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

  ["Action", "Count", "Share", "Notes"].forEach((value, i) => {
    const cell = summarySheet.getRow(11).getCell(i + 1);
    cell.value = value;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  [
    ["CREATE", stats.createCount, asPercent(stats.createCount, totalCount), "action = CREATE", createFill],
    ["UPDATE", stats.updateCount, asPercent(stats.updateCount, totalCount), "action = UPDATE", updateFill],
    ["DELETE", stats.deleteCount, asPercent(stats.deleteCount, totalCount), "action = DELETE", deleteFill],
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

  for (let r = 1; r <= 14; r++) {
    const maxCol = r >= 10 ? 4 : 6;
    for (let c = 1; c <= maxCol; c++) {
      const cell = summarySheet.getRow(r).getCell(c);
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", wrapText: true };
    }
    summarySheet.getRow(r).commit();
  }
  summarySheet.commit();

  // ── Sheet 2: Audit Logs (streaming) ───────────────────────────────────────
  const logsSheet = workbook.addWorksheet("Audit Logs", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  logsSheet.columns = [
    { header: "#",              key: "no",            width: 8  },
    { header: "Timestamp",      key: "timestamp",     width: 24 },
    { header: "Action",         key: "action",        width: 12 },
    { header: "Table",          key: "tableName",     width: 22 },
    { header: "Record ID",      key: "recordId",      width: 18 },
    { header: "Username",       key: "username",      width: 22 },
    { header: "User ID",        key: "userId",        width: 10 },
    { header: "Changed Fields", key: "changedFields", width: 40 },
    { header: "Before Data",    key: "beforeData",    width: 50 },
    { header: "After Data",     key: "afterData",     width: 50 },
    { header: "IP Address",     key: "ipAddress",     width: 18 },
    { header: "Request ID",     key: "requestId",     width: 30 },
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
  const tableMap = new Map<string, { create: number; update: number; delete: number }>();

  for await (const batch of rows) {
    for (const log of batch) {
      rowNumber += 1;

      const ts = tableMap.get(log.table_name) ?? { create: 0, update: 0, delete: 0 };
      if (log.action === "CREATE") ts.create += 1;
      else if (log.action === "UPDATE") ts.update += 1;
      else if (log.action === "DELETE") ts.delete += 1;
      tableMap.set(log.table_name, ts);

      const row = logsSheet.addRow({
        no: rowNumber,
        timestamp: formatDT(log.timestamp),
        action: log.action,
        tableName: safeText(log.table_name),
        recordId: safeText(log.record_id),
        username: safeText(log.username),
        userId: log.user_id ?? "-",
        changedFields: safeText(log.changed_fields),
        beforeData: safeText(log.before_data, 2000),
        afterData: safeText(log.after_data, 2000),
        ipAddress: safeText(log.ip_address),
        requestId: safeText(log.request_id),
      });

      const actionCell = row.getCell("action");
      if (log.action === "CREATE") actionCell.fill = createFill;
      else if (log.action === "UPDATE") actionCell.fill = updateFill;
      else if (log.action === "DELETE") actionCell.fill = deleteFill;

      row.eachCell((cell) => { cell.alignment = { vertical: "middle", wrapText: false }; });
      row.commit();
    }
  }
  logsSheet.commit();

  // ── Sheet 3: By Table ─────────────────────────────────────────────────────
  const tableSheet = workbook.addWorksheet("By Table", { views: [{ showGridLines: false }] });
  tableSheet.columns = [
    { header: "Table",   key: "tableName", width: 30 },
    { header: "CREATE",  key: "create",    width: 14 },
    { header: "UPDATE",  key: "update",    width: 14 },
    { header: "DELETE",  key: "delete",    width: 14 },
    { header: "Total",   key: "total",     width: 14 },
  ];
  tableSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  tableSheet.getRow(1).commit();

  [...tableMap.entries()]
    .map(([tableName, stat]) => ({
      tableName,
      create: stat.create,
      update: stat.update,
      delete: stat.delete,
      total: stat.create + stat.update + stat.delete,
    }))
    .sort((a, b) => b.total - a.total)
    .forEach((value) => {
      const row = tableSheet.addRow(value);
      row.eachCell((cell) => { cell.border = thinBorder; cell.alignment = { vertical: "middle" }; });
      if (value.create > 0) row.getCell("create").fill = createFill;
      if (value.update > 0) row.getCell("update").fill = updateFill;
      if (value.delete > 0) row.getCell("delete").fill = deleteFill;
      row.commit();
    });
  tableSheet.commit();

  await workbook.commit();
  return { filePath, filename, exportedCount: rowNumber };
}
