import ExcelJS from "exceljs";

export interface AuthLogsExcelRecord {
  id: number;
  created_at: Date;
  user_id: number | null;
  username: string;
  auth_type: string;
  auth_status: string;
  failure_reason: string | null;
  ip_address: string | null;
  browser: string | null;
  os: string | null;
  device_info: string | null;
  auth_source: string | null;
  two_factor_used: boolean;
  remember_me: boolean;
  session_duration: number | null;
  logout_time: Date | null;
}

export interface BuildAuthLogsExcelInput {
  rows: AsyncIterable<AuthLogsExcelRecord[]>;
  filePath: string;
  filename: string;
  totalCount: number;
  start: Date;
  end: Date;
  stats: {
    successCount: number;
    failedCount: number;
    twoFactorCount: number;
  };
  filters: {
    search?: string;
    authType?: string;
    authStatus?: string;
    startDate?: string;
    endDate?: string;
  };
}

const formatDateTimeForExcel = (date?: Date | null) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(date);
};

const safeText = (value?: string | number | null, maxLength = 4000) => {
  if (value === null || value === undefined || value === "") return "-";
  const text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}... [truncated]` : text;
};

const asPercent = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return "-";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

export async function buildAuthLogsExcel(input: BuildAuthLogsExcelInput) {
  const { rows, filePath, filename, totalCount, start, end, stats, filters } = input;
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: true,
    useSharedStrings: false,
  });

  const titleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F172A" } };
  const subtitleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEDE9FE" } };
  const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF4F46E5" } };
  const sectionFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFDDD6FE" } };
  const cardFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
  const border = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" } };
  const labelFont = { bold: true, color: { argb: "FF334155" } };
  const thinBorder = { top: border, left: border, bottom: border, right: border };

  const successFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFD1FAE5" } };
  const failedFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEE2E2" } };

  // ── Sheet 1: Summary (ใช้ pre-computed stats เขียนได้เลยก่อน loop) ─────────
  const summarySheet = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  summarySheet.columns = [
    { width: 24 },
    { width: 32 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  summarySheet.mergeCells("A1:F2");
  summarySheet.getCell("A1").value = "Authentication Logs Export";
  summarySheet.getCell("A1").font = { ...headerFont, size: 22 };
  summarySheet.getCell("A1").fill = titleFill;
  summarySheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

  summarySheet.mergeCells("A4:F4");
  summarySheet.getCell("A4").value = "Export Details";
  summarySheet.getCell("A4").font = { bold: true, color: { argb: "FF0F172A" } };
  summarySheet.getCell("A4").fill = sectionFill;

  [
    ["Exported At", formatDateTimeForExcel(new Date()), "Rows Exported", totalCount,                "Total Matching",  totalCount],
    ["Date From",   safeText(filters.startDate ?? ""),  "Date To",       safeText(filters.endDate ?? ""), "Export Limit", "No limit"],
    ["Search",      safeText(filters.search),           "Auth Type",     filters.authType ?? "all", "Auth Status",     filters.authStatus ?? "all"],
  ].forEach((values, index) => {
    const row = summarySheet.getRow(5 + index);
    values.forEach((value, valueIndex) => {
      row.getCell(valueIndex + 1).value = value;
    });
    [1, 3, 5].forEach((col) => {
      row.getCell(col).font = labelFont;
      row.getCell(col).fill = subtitleFill;
    });
    [2, 4, 6].forEach((col) => {
      row.getCell(col).fill = cardFill;
    });
  });

  summarySheet.mergeCells("A10:D10");
  summarySheet.getCell("A10").value = "Key Metrics";
  summarySheet.getCell("A10").font = { bold: true, color: { argb: "FF0F172A" } };
  summarySheet.getCell("A10").fill = sectionFill;

  ["Metric", "Value", "Share", "Notes"].forEach((value, index) => {
    const cell = summarySheet.getRow(11).getCell(index + 1);
    cell.value = value;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  [
    ["Success",  stats.successCount,    asPercent(stats.successCount, totalCount),    "auth_status = SUCCESS"],
    ["Failed",   stats.failedCount,     asPercent(stats.failedCount, totalCount),     "auth_status = FAILED"],
    ["2FA Used", stats.twoFactorCount,  asPercent(stats.twoFactorCount, totalCount),  "two_factor_used = true"],
  ].forEach((values, index) => {
    const row = summarySheet.getRow(12 + index);
    values.forEach((value, valueIndex) => {
      row.getCell(valueIndex + 1).value = value;
    });
    row.getCell(1).font = labelFont;
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

  // ── Sheet 2: Auth Logs ────────────────────────────────────────────────────
  const logsSheet = workbook.addWorksheet("Auth Logs", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  logsSheet.columns = [
    { header: "#",               key: "no",              width: 8  },
    { header: "Time",            key: "createdAt",       width: 24 },
    { header: "Type",            key: "authType",        width: 18 },
    { header: "Status",          key: "authStatus",      width: 12 },
    { header: "Username",        key: "username",        width: 22 },
    { header: "User ID",         key: "userId",          width: 10 },
    { header: "IP Address",      key: "ipAddress",       width: 18 },
    { header: "Browser",         key: "browser",         width: 20 },
    { header: "OS",              key: "os",              width: 18 },
    { header: "Device Info",     key: "deviceInfo",      width: 30 },
    { header: "Auth Source",     key: "authSource",      width: 14 },
    { header: "2FA Used",        key: "twoFactorUsed",   width: 10 },
    { header: "Remember Me",     key: "rememberMe",      width: 13 },
    { header: "Session Duration",key: "sessionDuration", width: 18 },
    { header: "Logout Time",     key: "logoutTime",      width: 24 },
    { header: "Failure Reason",  key: "failureReason",   width: 40 },
  ];

  logsSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  logsSheet.autoFilter = { from: "A1", to: "P1" };
  logsSheet.getRow(1).commit();

  let rowNumber = 0;
  const typeMap = new Map<string, { success: number; failed: number }>();

  for await (const batch of rows) {
    for (const log of batch) {
      rowNumber += 1;
      const isSuccess = log.auth_status === "SUCCESS";

      const typeStat = typeMap.get(log.auth_type) ?? { success: 0, failed: 0 };
      if (isSuccess) typeStat.success += 1;
      else typeStat.failed += 1;
      typeMap.set(log.auth_type, typeStat);

      const row = logsSheet.addRow({
        no: rowNumber,
        createdAt: formatDateTimeForExcel(log.created_at),
        authType: log.auth_type,
        authStatus: log.auth_status,
        username: safeText(log.username),
        userId: log.user_id ?? "-",
        ipAddress: safeText(log.ip_address),
        browser: safeText(log.browser),
        os: safeText(log.os),
        deviceInfo: safeText(log.device_info),
        authSource: safeText(log.auth_source),
        twoFactorUsed: log.two_factor_used ? "Yes" : "No",
        rememberMe: log.remember_me ? "Yes" : "No",
        sessionDuration: formatDuration(log.session_duration),
        logoutTime: formatDateTimeForExcel(log.logout_time),
        failureReason: safeText(log.failure_reason),
      });

      const statusCell = row.getCell("authStatus");
      statusCell.fill = isSuccess ? successFill : failedFill;

      if (log.two_factor_used) {
        row.getCell("twoFactorUsed").fill = successFill;
      }

      row.commit();
    }
  }

  logsSheet.commit();

  // ── Sheet 3: By Type ──────────────────────────────────────────────────────
  const typeSheet = workbook.addWorksheet("By Type", { views: [{ showGridLines: false }] });
  typeSheet.columns = [
    { header: "Auth Type",    key: "authType",  width: 22 },
    { header: "Success",      key: "success",   width: 14 },
    { header: "Failed",       key: "failed",    width: 14 },
    { header: "Total",        key: "total",     width: 14 },
    { header: "Success Rate", key: "rate",      width: 16 },
  ];
  typeSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  typeSheet.getRow(1).commit();

  [...typeMap.entries()]
    .map(([authType, stat]) => ({
      authType,
      success: stat.success,
      failed: stat.failed,
      total: stat.success + stat.failed,
      rate: asPercent(stat.success, stat.success + stat.failed),
    }))
    .sort((a, b) => b.total - a.total)
    .forEach((value) => {
      const row = typeSheet.addRow(value);
      row.eachCell((cell) => {
        cell.border = thinBorder;
        cell.alignment = { vertical: "middle" };
      });
      row.getCell("success").fill = successFill;
      if (value.failed > 0) row.getCell("failed").fill = failedFill;
      row.commit();
    });
  typeSheet.commit();

  await workbook.commit();

  return { filePath, filename, exportedCount: rowNumber };
}
