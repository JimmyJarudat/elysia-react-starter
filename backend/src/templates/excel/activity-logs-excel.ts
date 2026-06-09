import ExcelJS from "exceljs";
import { formatSystemDateSync } from "@/utils/date-formatter";

export interface ActivityLogsExcelRecord {
  id: bigint;
  timestamp: Date;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  metadata: string | null;
}

export interface BuildActivityLogsExcelInput {
  rows: AsyncIterable<ActivityLogsExcelRecord[]>;
  filePath: string;
  filename: string;
  totalCount: number;
  start: Date;
  end: Date;
  stats: { successCount: number; failedCount: number; exportCount: number };
  filters: {
    search?: string;
    action?: string;
    resourceType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  };
}

const formatDT = (date?: Date | null) => {
  if (!date) return "-";
  return formatSystemDateSync(date);
};

const safeText = (value?: string | number | null, max = 2000) => {
  if (value === null || value === undefined || value === "") return "-";
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}...[truncated]` : s;
};

const asPercent = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";

export async function buildActivityLogsExcel(input: BuildActivityLogsExcelInput) {
  const { rows, filePath, filename, totalCount, stats, filters } = input;

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: true,
    useSharedStrings: false,
  });

  const titleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F172A" } };
  const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF2563EB" } };
  const sectionFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFDBEAFE" } };
  const subtitleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEFF6FF" } };
  const cardFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
  const successFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFD1FAE5" } };
  const failedFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEE2E2" } };
  const exportFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEDE9FE" } };

  const border = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
  const thinBorder = { top: border, left: border, bottom: border, right: border };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" } };
  const labelFont = { bold: true, color: { argb: "FF334155" } };

  const summarySheet = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  summarySheet.columns = [{ width: 24 }, { width: 32 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  summarySheet.mergeCells("A1:F2");
  summarySheet.getCell("A1").value = "Activity Logs Export";
  summarySheet.getCell("A1").font = { ...headerFont, size: 22 };
  summarySheet.getCell("A1").fill = titleFill;
  summarySheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

  summarySheet.mergeCells("A4:F4");
  summarySheet.getCell("A4").value = "Export Details";
  summarySheet.getCell("A4").font = { bold: true, color: { argb: "FF0F172A" } };
  summarySheet.getCell("A4").fill = sectionFill;

  [
    ["Exported At", formatDT(new Date()), "Rows Exported", totalCount, "Total Matching", totalCount],
    ["Date From", safeText(filters.startDate ?? ""), "Date To", safeText(filters.endDate ?? ""), "Export Limit", "No limit"],
    ["Search", safeText(filters.search), "Action", safeText(filters.action ?? "all"), "Status", safeText(filters.status ?? "all")],
    ["Resource", safeText(filters.resourceType ?? "all"), "", "", "", ""],
  ].forEach((values, index) => {
    const row = summarySheet.getRow(5 + index);
    values.forEach((value, vi) => { row.getCell(vi + 1).value = value; });
    [1, 3, 5].forEach((col) => { row.getCell(col).font = labelFont; row.getCell(col).fill = subtitleFill; });
    [2, 4, 6].forEach((col) => { row.getCell(col).fill = cardFill; });
  });

  summarySheet.mergeCells("A11:D11");
  summarySheet.getCell("A11").value = "Key Metrics";
  summarySheet.getCell("A11").font = { bold: true, color: { argb: "FF0F172A" } };
  summarySheet.getCell("A11").fill = sectionFill;

  ["Metric", "Count", "Share", "Notes"].forEach((value, i) => {
    const cell = summarySheet.getRow(12).getCell(i + 1);
    cell.value = value;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  [
    ["Success", stats.successCount, asPercent(stats.successCount, totalCount), "status = success", successFill],
    ["Failed", stats.failedCount, asPercent(stats.failedCount, totalCount), "status = failed", failedFill],
    ["Export", stats.exportCount, asPercent(stats.exportCount, totalCount), "action = EXPORT", exportFill],
  ].forEach((values, index) => {
    const row = summarySheet.getRow(13 + index);
    const [label, count, share, notes, fill] = values;
    row.getCell(1).value = label as string;
    row.getCell(2).value = count as number;
    row.getCell(3).value = share as string;
    row.getCell(4).value = notes as string;
    row.getCell(1).font = labelFont;
    row.eachCell((cell) => { cell.fill = fill as ExcelJS.Fill; });
  });

  for (let r = 1; r <= 15; r++) {
    const maxCol = r >= 11 ? 4 : 6;
    for (let c = 1; c <= maxCol; c++) {
      const cell = summarySheet.getRow(r).getCell(c);
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", wrapText: true };
    }
    summarySheet.getRow(r).commit();
  }
  summarySheet.commit();

  const logsSheet = workbook.addWorksheet("Activity Logs", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  logsSheet.columns = [
    { header: "#", key: "no", width: 8 },
    { header: "Timestamp", key: "timestamp", width: 24 },
    { header: "Action", key: "action", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "Resource Type", key: "resourceType", width: 24 },
    { header: "Resource ID", key: "resourceId", width: 18 },
    { header: "Username", key: "username", width: 22 },
    { header: "User ID", key: "userId", width: 10 },
    { header: "Description", key: "description", width: 50 },
    { header: "IP Address", key: "ipAddress", width: 18 },
    { header: "User Agent", key: "userAgent", width: 45 },
    { header: "Metadata", key: "metadata", width: 55 },
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
  const actionMap = new Map<string, number>();
  const resourceMap = new Map<string, { success: number; failed: number }>();

  for await (const batch of rows) {
    for (const log of batch) {
      rowNumber += 1;
      actionMap.set(log.action, (actionMap.get(log.action) ?? 0) + 1);
      const resource = resourceMap.get(log.resource_type) ?? { success: 0, failed: 0 };
      if (log.status === "failed") resource.failed += 1;
      else resource.success += 1;
      resourceMap.set(log.resource_type, resource);

      const row = logsSheet.addRow({
        no: rowNumber,
        timestamp: formatDT(log.timestamp),
        action: log.action,
        status: log.status,
        resourceType: safeText(log.resource_type),
        resourceId: safeText(log.resource_id),
        username: safeText(log.username),
        userId: log.user_id ?? "-",
        description: safeText(log.description, 2000),
        ipAddress: safeText(log.ip_address),
        userAgent: safeText(log.user_agent, 1000),
        metadata: safeText(log.metadata, 2000),
      });

      row.getCell("status").fill = log.status === "failed" ? failedFill : successFill;
      if (log.action === "EXPORT") row.getCell("action").fill = exportFill;
      row.eachCell((cell) => { cell.alignment = { vertical: "middle", wrapText: false }; });
      row.commit();
    }
  }
  logsSheet.commit();

  const actionSheet = workbook.addWorksheet("By Action", { views: [{ showGridLines: false }] });
  actionSheet.columns = [
    { header: "Action", key: "action", width: 24 },
    { header: "Count", key: "count", width: 14 },
    { header: "Share", key: "share", width: 14 },
  ];
  actionSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  actionSheet.getRow(1).commit();

  [...actionMap.entries()]
    .map(([action, count]) => ({ action, count, share: asPercent(count, rowNumber) }))
    .sort((a, b) => b.count - a.count)
    .forEach((value) => {
      const row = actionSheet.addRow(value);
      row.eachCell((cell) => { cell.border = thinBorder; cell.alignment = { vertical: "middle" }; });
      if (value.action === "EXPORT") row.getCell("action").fill = exportFill;
      row.commit();
    });
  actionSheet.commit();

  const resourceSheet = workbook.addWorksheet("By Resource", { views: [{ showGridLines: false }] });
  resourceSheet.columns = [
    { header: "Resource Type", key: "resourceType", width: 30 },
    { header: "Success", key: "success", width: 14 },
    { header: "Failed", key: "failed", width: 14 },
    { header: "Total", key: "total", width: 14 },
  ];
  resourceSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  resourceSheet.getRow(1).commit();

  [...resourceMap.entries()]
    .map(([resourceType, stat]) => ({
      resourceType,
      success: stat.success,
      failed: stat.failed,
      total: stat.success + stat.failed,
    }))
    .sort((a, b) => b.total - a.total)
    .forEach((value) => {
      const row = resourceSheet.addRow(value);
      row.eachCell((cell) => { cell.border = thinBorder; cell.alignment = { vertical: "middle" }; });
      if (value.success > 0) row.getCell("success").fill = successFill;
      if (value.failed > 0) row.getCell("failed").fill = failedFill;
      row.commit();
    });
  resourceSheet.commit();

  await workbook.commit();
  return { filePath, filename, exportedCount: rowNumber };
}
