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
  rows: AsyncIterable<RequestLogsExcelRecord[]>;
  filePath: string;
  filename: string;
  totalCount: number;
  preset: RequestLogsExcelPreset;
  start: Date;
  end: Date;
  filters: {
    search?: string;
    method?: string;
    status?: string;
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

const asPercent = (value: number, total: number) => (
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%"
);

export async function buildRequestLogsExcel(input: BuildRequestLogsExcelInput) {
  const { rows, filePath, filename, totalCount, preset, start, end, filters } = input;
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: true,
    useSharedStrings: false,
  });

  const titleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F172A" } };
  const subtitleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE0F2FE" } };
  const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0369A1" } };
  const sectionFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFDBEAFE" } };
  const cardFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
  const border = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" } };
  const labelFont = { bold: true, color: { argb: "FF334155" } };
  const thinBorder = { top: border, left: border, bottom: border, right: border };

  const summarySheet = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
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

  logsSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  logsSheet.autoFilter = { from: "A1", to: "U1" };
  logsSheet.getRow(1).commit();

  let rowNumber = 0;
  let successCount = 0;
  let clientErrorCount = 0;
  let serverErrorCount = 0;
  let responseTimeSum = 0;
  let responseTimeSamples = 0;
  let maxResponseTime: number | null = null;
  const pathMap = new Map<string, { total: number; errors: number; responseSum: number; responseSamples: number }>();

  for await (const batch of rows) {
    for (const log of batch) {
      rowNumber += 1;
      const statusCode = log.status_code ?? 0;
      if (statusCode >= 200 && statusCode <= 399) successCount += 1;
      else if (statusCode >= 400 && statusCode <= 499) clientErrorCount += 1;
      else if (statusCode >= 500) serverErrorCount += 1;

      if (log.response_time !== null) {
        responseTimeSum += log.response_time;
        responseTimeSamples += 1;
        maxResponseTime = maxResponseTime === null ? log.response_time : Math.max(maxResponseTime, log.response_time);
      }

      const path = pathMap.get(log.path) ?? { total: 0, errors: 0, responseSum: 0, responseSamples: 0 };
      path.total += 1;
      if (statusCode >= 400) path.errors += 1;
      if (log.response_time !== null) {
        path.responseSum += log.response_time;
        path.responseSamples += 1;
      }
      pathMap.set(log.path, path);

      const row = logsSheet.addRow({
        no: rowNumber,
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
        errorStack: safeText(log.error_stack, 8000),
      });

      const statusCell = row.getCell("status");
      if (statusCode >= 500) statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
      else if (statusCode >= 400) statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      else if (statusCode >= 200) statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };

      row.commit();
    }
  }

  logsSheet.commit();

  summarySheet.columns = [
    { width: 22 },
    { width: 32 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
  summarySheet.mergeCells("A1:F2");
  summarySheet.getCell("A1").value = "Request Logs Export";
  summarySheet.getCell("A1").font = { ...headerFont, size: 22 };
  summarySheet.getCell("A1").fill = titleFill;
  summarySheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

  summarySheet.mergeCells("A4:F4");
  summarySheet.getCell("A4").value = "Export Details";
  summarySheet.getCell("A4").font = { bold: true, color: { argb: "FF0F172A" } };
  summarySheet.getCell("A4").fill = sectionFill;

  [
    ["Exported At", formatDateTimeForExcel(new Date()), "Preset", preset, "Rows Exported", rowNumber],
    ["Date Range", `${formatDateTimeForExcel(start)} - ${formatDateTimeForExcel(end)}`, "Total Matching Rows", totalCount, "Export Limit", "No limit"],
    ["Search", safeText(filters.search), "Method", filters.method ?? "all", "Status", filters.status ?? "all"],
    ["Truncated", "No", "", "", "", ""],
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

  summarySheet.mergeCells("A11:D11");
  summarySheet.getCell("A11").value = "Key Metrics";
  summarySheet.getCell("A11").font = { bold: true, color: { argb: "FF0F172A" } };
  summarySheet.getCell("A11").fill = sectionFill;
  ["Metric", "Value", "Share", "Notes"].forEach((value, index) => {
    const cell = summarySheet.getRow(12).getCell(index + 1);
    cell.value = value;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const avgResponseTime = responseTimeSamples > 0 ? Math.round(responseTimeSum / responseTimeSamples) : null;
  [
    ["Success (2xx-3xx)", successCount, asPercent(successCount, rowNumber), "Completed or redirected requests"],
    ["Client Error (4xx)", clientErrorCount, asPercent(clientErrorCount, rowNumber), "Client-side validation/auth/request issues"],
    ["Server Error (5xx)", serverErrorCount, asPercent(serverErrorCount, rowNumber), "Server-side failures"],
    ["Average Response Time", avgResponseTime !== null ? `${avgResponseTime} ms` : "-", "-", "Only rows with response_time"],
    ["Max Response Time", maxResponseTime !== null ? `${maxResponseTime} ms` : "-", "-", "Slowest request"],
  ].forEach((values, index) => {
    const row = summarySheet.getRow(13 + index);
    values.forEach((value, valueIndex) => {
      row.getCell(valueIndex + 1).value = value;
    });
    row.getCell(1).font = labelFont;
  });

  for (let r = 1; r <= 17; r++) {
    const maxCol = r >= 11 ? 4 : 6;
    for (let c = 1; c <= maxCol; c++) {
      const cell = summarySheet.getRow(r).getCell(c);
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", wrapText: true };
    }
    summarySheet.getRow(r).commit();
  }
  summarySheet.commit();

  const topPathsSheet = workbook.addWorksheet("Top Paths", { views: [{ showGridLines: false }] });
  topPathsSheet.columns = [
    { header: "Path", key: "path", width: 60 },
    { header: "Requests", key: "total", width: 14 },
    { header: "Errors", key: "errors", width: 12 },
    { header: "Error Rate", key: "errorRate", width: 14 },
    { header: "Avg Response", key: "avg", width: 16 },
  ];
  topPathsSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  topPathsSheet.getRow(1).commit();

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
    .forEach((value) => {
      const row = topPathsSheet.addRow(value);
      row.eachCell((cell) => {
        cell.border = thinBorder;
        cell.alignment = { vertical: "middle", wrapText: true };
      });
      row.commit();
    });
  topPathsSheet.commit();

  await workbook.commit();

  return {
    filePath,
    filename,
    exportedCount: rowNumber,
  };
}
