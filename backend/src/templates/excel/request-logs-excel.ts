import ExcelJS from "exceljs";

export type RequestLogsExcelPreset = "today" | "1m" | "3m" | "custom";

export interface RequestLogsExcelRecord {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  path: string;
  query_params: string | null;
  user_id: number | null;
  username: string | null;
  ip_address: string;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  platform: string | null;
  status_code: number | null;
  response_time: number | null;
  request_size: number | null;
  error_message: string | null;
  error_stack: string | null;
  referer: string | null;
  session_id: string | null;
}

export interface BuildRequestLogsExcelInput {
  logs: RequestLogsExcelRecord[];
  totalCount: number;
  exportLimit: number;
  preset: RequestLogsExcelPreset;
  start: Date;
  end: Date;
  filters: {
    search?: string;
    method?: string;
    status?: string;
  };
}

const percentile = (sorted: number[], p: number): number | null => {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
};

const formatDateTimeForExcel = (date?: Date | null) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(date);
};

const safeText = (value?: string | number | null) => (
  value === null || value === undefined || value === "" ? "-" : String(value)
);

const asPercent = (value: number, total: number) => (
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%"
);

export async function buildRequestLogsExcel(input: BuildRequestLogsExcelInput) {
  const { logs, totalCount, exportLimit, preset, start, end, filters } = input;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IT Utils";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;

  const titleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F172A" } };
  const subtitleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE0F2FE" } };
  const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0369A1" } };
  const sectionFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFDBEAFE" } };
  const cardFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
  const border = { style: "thin" as const, color: { argb: "FFCBD5E1" } };

  const summary = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  summary.mergeCells("A1:H2");
  summary.getCell("A1").value = "Request Logs Export";
  summary.getCell("A1").font = { bold: true, size: 22, color: { argb: "FFFFFFFF" } };
  summary.getCell("A1").fill = titleFill;
  summary.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  summary.getRow(1).height = 24;
  summary.getRow(2).height = 24;
  summary.columns = [
    { width: 22 },
    { width: 32 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 30 },
  ];

  const responseTimes = logs
    .map((log) => log.response_time)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
  const successCount = logs.filter((log) => (log.status_code ?? 0) >= 200 && (log.status_code ?? 0) <= 399).length;
  const clientErrorCount = logs.filter((log) => (log.status_code ?? 0) >= 400 && (log.status_code ?? 0) <= 499).length;
  const serverErrorCount = logs.filter((log) => (log.status_code ?? 0) >= 500).length;
  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
    : null;

  summary.mergeCells("A4:H4");
  summary.getCell("A4").value = "Export Details";
  summary.getCell("A4").font = { bold: true, color: { argb: "FF0F172A" } };
  summary.getCell("A4").fill = sectionFill;
  summary.getCell("A4").alignment = { horizontal: "left", vertical: "middle" };
  summary.getRow(4).height = 22;

  const detailRows = [
    ["Exported At", formatDateTimeForExcel(new Date()), "Preset", preset, "Rows Exported", logs.length],
    ["Date Range", `${formatDateTimeForExcel(start)} - ${formatDateTimeForExcel(end)}`, "Total Matching Rows", totalCount, "Export Limit", exportLimit],
    ["Search", safeText(filters.search), "Method", filters.method ?? "all", "Status", filters.status ?? "all"],
    ["Truncated", totalCount > exportLimit ? "Yes" : "No", "", "", "", ""],
  ];

  detailRows.forEach((values, index) => {
    const row = summary.getRow(5 + index);
    values.forEach((value, valueIndex) => {
      row.getCell(valueIndex + 1).value = value;
    });
    row.height = 24;
    [1, 3, 5].forEach((col) => {
      row.getCell(col).font = { bold: true, color: { argb: "FF334155" } };
      row.getCell(col).fill = subtitleFill;
    });
    [2, 4, 6].forEach((col) => {
      row.getCell(col).fill = cardFill;
    });
  });

  summary.mergeCells("A11:H11");
  summary.getCell("A11").value = "Key Metrics";
  summary.getCell("A11").font = { bold: true, color: { argb: "FF0F172A" } };
  summary.getCell("A11").fill = sectionFill;
  summary.getCell("A11").alignment = { horizontal: "left", vertical: "middle" };
  summary.getRow(11).height = 22;

  ["Metric", "Value", "Share", "Notes"].forEach((value, index) => {
    summary.getRow(12).getCell(index + 1).value = value;
  });
  const metricHeader = summary.getRow(12);
  metricHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  metricHeader.fill = headerFill;
  metricHeader.alignment = { horizontal: "center" };

  const p95 = percentile(responseTimes, 95);
  const metricRows = [
    ["Success (2xx-3xx)", successCount, asPercent(successCount, logs.length), "Completed or redirected requests"],
    ["Client Error (4xx)", clientErrorCount, asPercent(clientErrorCount, logs.length), "Client-side validation/auth/request issues"],
    ["Server Error (5xx)", serverErrorCount, asPercent(serverErrorCount, logs.length), "Server-side failures"],
    ["Average Response Time", avgResponseTime !== null ? `${avgResponseTime} ms` : "-", "-", "Only rows with response_time"],
    ["p95 Response Time", p95 !== null ? `${p95} ms` : "-", "-", "95th percentile"],
    ["Max Response Time", responseTimes.length > 0 ? `${responseTimes[responseTimes.length - 1]} ms` : "-", "-", "Slowest request"],
  ];
  metricRows.forEach((values, index) => {
    const row = summary.getRow(13 + index);
    values.forEach((value, valueIndex) => {
      row.getCell(valueIndex + 1).value = value;
    });
    row.height = 22;
    row.getCell(1).font = { bold: true, color: { argb: "FF334155" } };
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };
  });

  const logsSheet = workbook.addWorksheet("Request Logs", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  logsSheet.columns = [
    { header: "#", key: "no", width: 8 },
    { header: "Timestamp", key: "timestamp", width: 24 },
    { header: "Method", key: "method", width: 10 },
    { header: "Status", key: "status", width: 10 },
    { header: "Response (ms)", key: "responseTime", width: 14 },
    { header: "Path", key: "path", width: 42 },
    { header: "URL", key: "url", width: 50 },
    { header: "Query Params", key: "queryParams", width: 38 },
    { header: "Username", key: "username", width: 20 },
    { header: "User ID", key: "userId", width: 12 },
    { header: "IP Address", key: "ipAddress", width: 18 },
    { header: "Browser", key: "browser", width: 18 },
    { header: "OS", key: "os", width: 18 },
    { header: "Device", key: "deviceType", width: 14 },
    { header: "Platform", key: "platform", width: 18 },
    { header: "Request Size", key: "requestSize", width: 14 },
    { header: "Referer", key: "referer", width: 38 },
    { header: "Session ID", key: "sessionId", width: 20 },
    { header: "User Agent", key: "userAgent", width: 55 },
    { header: "Error Message", key: "errorMessage", width: 46 },
    { header: "Error Stack", key: "errorStack", width: 60 },
  ];

  logsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  logsSheet.getRow(1).fill = headerFill;
  logsSheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
  logsSheet.autoFilter = { from: "A1", to: "U1" };

  logs.forEach((log, index) => {
    const row = logsSheet.addRow({
      no: index + 1,
      timestamp: formatDateTimeForExcel(log.timestamp),
      method: log.method,
      status: log.status_code ?? "-",
      responseTime: log.response_time ?? "-",
      path: log.path,
      url: log.url,
      queryParams: safeText(log.query_params),
      username: safeText(log.username),
      userId: log.user_id ?? "-",
      ipAddress: safeText(log.ip_address),
      browser: safeText(log.browser),
      os: safeText(log.os),
      deviceType: safeText(log.device_type),
      platform: safeText(log.platform),
      requestSize: log.request_size ?? "-",
      referer: safeText(log.referer),
      sessionId: safeText(log.session_id),
      userAgent: safeText(log.user_agent),
      errorMessage: safeText(log.error_message),
      errorStack: safeText(log.error_stack),
    });

    const statusCell = row.getCell("status");
    const statusCode = log.status_code ?? 0;
    if (statusCode >= 500) statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
    else if (statusCode >= 400) statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    else if (statusCode >= 200) statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
  });

  const pathMap = new Map<string, { total: number; errors: number; responseSum: number; responseSamples: number }>();
  const methodMap = new Map<string, number>();
  const statusMap = new Map<number, number>();

  for (const log of logs) {
    const path = pathMap.get(log.path) ?? { total: 0, errors: 0, responseSum: 0, responseSamples: 0 };
    path.total += 1;
    if ((log.status_code ?? 0) >= 400) path.errors += 1;
    if (log.response_time !== null) {
      path.responseSum += log.response_time;
      path.responseSamples += 1;
    }
    pathMap.set(log.path, path);
    methodMap.set(log.method, (methodMap.get(log.method) ?? 0) + 1);
    if (log.status_code !== null) statusMap.set(log.status_code, (statusMap.get(log.status_code) ?? 0) + 1);
  }

  const topPathsSheet = workbook.addWorksheet("Top Paths", { views: [{ showGridLines: false }] });
  topPathsSheet.columns = [
    { header: "Path", key: "path", width: 60 },
    { header: "Requests", key: "total", width: 14 },
    { header: "Errors", key: "errors", width: 12 },
    { header: "Error Rate", key: "errorRate", width: 14 },
    { header: "Avg Response", key: "avg", width: 16 },
  ];
  [...pathMap.entries()]
    .map(([path, stat]) => ({
      path,
      total: stat.total,
      errors: stat.errors,
      errorRate: asPercent(stat.errors, stat.total),
      avg: stat.responseSamples > 0 ? `${Math.round(stat.responseSum / stat.responseSamples)} ms` : "-",
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 50)
    .forEach((row) => topPathsSheet.addRow(row));

  const breakdownSheet = workbook.addWorksheet("Breakdown", { views: [{ showGridLines: false }] });
  breakdownSheet.columns = [
    { width: 20 },
    { width: 14 },
    { width: 4 },
    { width: 18 },
    { width: 14 },
  ];
  breakdownSheet.mergeCells("A1:E2");
  breakdownSheet.getCell("A1").value = "Request Breakdown";
  breakdownSheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  breakdownSheet.getCell("A1").fill = titleFill;
  breakdownSheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  breakdownSheet.getRow(1).height = 24;
  breakdownSheet.getRow(2).height = 24;

  breakdownSheet.mergeCells("A4:B4");
  breakdownSheet.getCell("A4").value = "By Method";
  breakdownSheet.getCell("A4").font = { bold: true, color: { argb: "FF0F172A" } };
  breakdownSheet.getCell("A4").fill = sectionFill;
  breakdownSheet.getCell("A5").value = "Method";
  breakdownSheet.getCell("B5").value = "Requests";

  [...methodMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([method, count], index) => {
      const row = breakdownSheet.getRow(6 + index);
      row.getCell(1).value = method;
      row.getCell(2).value = count;
      row.getCell(1).font = { bold: true };
    });

  breakdownSheet.mergeCells("D4:E4");
  breakdownSheet.getCell("D4").value = "By Status Code";
  breakdownSheet.getCell("D4").font = { bold: true, color: { argb: "FF0F172A" } };
  breakdownSheet.getCell("D4").fill = sectionFill;
  breakdownSheet.getCell("D5").value = "Status Code";
  breakdownSheet.getCell("E5").value = "Requests";

  [...statusMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([statusCode, count], index) => {
      const row = breakdownSheet.getRow(6 + index);
      row.getCell(4).value = statusCode;
      row.getCell(5).value = count;
      row.getCell(4).font = { bold: true };

      if (statusCode >= 500) row.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
      else if (statusCode >= 400) row.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      else if (statusCode >= 200) row.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
    });

  [5].forEach((rowIndex) => {
    [1, 2, 4, 5].forEach((colIndex) => {
      const cell = breakdownSheet.getRow(rowIndex).getCell(colIndex);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = headerFill;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  });

  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = { top: border, left: border, bottom: border, right: border };
        cell.alignment = { vertical: "top", wrapText: true };
      });
    });

    const firstRow = sheet.getRow(1);
    firstRow.font = firstRow.font?.bold ? firstRow.font : { bold: true, color: { argb: "FFFFFFFF" } };
    if (!firstRow.fill) firstRow.fill = headerFill;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const datePart = `${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`;

  return {
    buffer,
    filename: `request-logs_${datePart}.xlsx`,
  };
}
