import ExcelJS from "exceljs";
import { formatSystemDateSync } from "@/utils/date-formatter";

export interface ApiRouteRequirementExcelRecord {
  id: number;
  method: string;
  path: string;
  roleId: string | null;
  roleName: string | null;
  rolePriority: number | null;
  permissionId: string | null;
  permissionName: string | null;
  resource: string | null;
  action: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuildApiRouteRequirementsExcelInput {
  rows: ApiRouteRequirementExcelRecord[];
  totalCount: number;
  filters: {
    search?: string;
    method?: string;
    resource?: string;
    status?: string;
  };
}

const safeText = (value?: string | number | boolean | null) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const dateText = (value?: Date | null) => (value ? formatSystemDateSync(value) : "-");

const yesNo = (value: boolean) => (value ? "Yes" : "No");

const applyHeader = (row: ExcelJS.Row, fill: ExcelJS.Fill, border: Partial<ExcelJS.Borders>) => {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = fill;
    cell.border = border;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
};

const applyBody = (row: ExcelJS.Row, border: Partial<ExcelJS.Borders>) => {
  row.eachCell((cell) => {
    cell.border = border;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
};

const asPercent = (value: number, total: number) => (
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%"
);

export async function buildApiRouteRequirementsExcel(input: BuildApiRouteRequirementsExcelInput) {
  const { rows, totalCount, filters } = input;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IT Utilities";
  workbook.created = new Date();
  workbook.modified = new Date();

  const titleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F172A" } };
  const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF075985" } };
  const sectionFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE0F2FE" } };
  const softFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
  const successFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFD1FAE5" } };
  const warningFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEF3C7" } };
  const dangerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEE2E2" } };
  const border = {
    top: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    left: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    right: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
  };
  const labelFont = { bold: true, color: { argb: "FF334155" } };

  const activeCount = rows.filter((row) => row.isActive).length;
  const inactiveCount = rows.length - activeCount;
  const withPermissionCount = rows.filter((row) => row.permissionId).length;
  const withRoleCount = rows.filter((row) => row.roleId).length;
  const unguardedCount = rows.filter((row) => !row.permissionId && !row.roleId).length;

  const summary = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  summary.columns = [{ width: 24 }, { width: 28 }, { width: 24 }, { width: 28 }, { width: 24 }, { width: 28 }];
  summary.mergeCells("A1:F2");
  summary.getCell("A1").value = "API Route Requirements Export";
  summary.getCell("A1").font = { bold: true, size: 22, color: { argb: "FFFFFFFF" } };
  summary.getCell("A1").fill = titleFill;
  summary.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

  summary.mergeCells("A4:F4");
  summary.getCell("A4").value = "Export Details";
  summary.getCell("A4").font = labelFont;
  summary.getCell("A4").fill = sectionFill;
  summary.getCell("A4").alignment = { horizontal: "center", vertical: "middle" };

  [
    ["Exported At", dateText(new Date()), "Rows Exported", rows.length, "Total Routes", totalCount],
    ["Search", safeText(filters.search), "Method", filters.method ?? "all", "Resource", filters.resource ?? "all"],
    ["Status", filters.status ?? "all", "Active", activeCount, "Inactive", inactiveCount],
  ].forEach((values, index) => {
    const row = summary.getRow(5 + index);
    values.forEach((value, valueIndex) => {
      const cell = row.getCell(valueIndex + 1);
      cell.value = value;
      cell.fill = valueIndex % 2 === 0 ? sectionFill : softFill;
      if (valueIndex % 2 === 0) cell.font = labelFont;
    });
  });

  summary.mergeCells("A10:F10");
  summary.getCell("A10").value = "Guard Coverage";
  summary.getCell("A10").font = labelFont;
  summary.getCell("A10").fill = sectionFill;
  summary.getCell("A10").alignment = { horizontal: "center", vertical: "middle" };

  [
    ["Metric", "Value", "Share", "Notes"],
    ["Routes With Permission", withPermissionCount, asPercent(withPermissionCount, rows.length), "Routes guarded by permission_id"],
    ["Routes With Role", withRoleCount, asPercent(withRoleCount, rows.length), "Routes additionally restricted by role_id"],
    ["Routes Without Guard", unguardedCount, asPercent(unguardedCount, rows.length), "Routes without permission_id and role_id"],
    ["Inactive Routes", inactiveCount, asPercent(inactiveCount, rows.length), "Rows disabled in route requirement middleware"],
  ].forEach((values, index) => {
    const row = summary.getRow(11 + index);
    values.forEach((value, valueIndex) => {
      const cell = row.getCell(valueIndex + 1);
      cell.value = value;
      if (index === 0) {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = headerFill;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (valueIndex === 0) {
        cell.font = labelFont;
        cell.fill = sectionFill;
      } else {
        cell.fill = softFill;
      }
    });
  });

  for (let rowIndex = 1; rowIndex <= 15; rowIndex++) {
    const maxColumn = rowIndex >= 11 ? 4 : 6;
    for (let colIndex = 1; colIndex <= maxColumn; colIndex++) {
      const cell = summary.getRow(rowIndex).getCell(colIndex);
      cell.border = border;
      cell.alignment = rowIndex === 4 || rowIndex === 10 || rowIndex === 11
        ? { horizontal: "center", vertical: "middle", wrapText: true }
        : { vertical: "middle", wrapText: true };
    }
  }

  const routesSheet = workbook.addWorksheet("API Routes", { views: [{ state: "frozen", ySplit: 1 }] });
  routesSheet.columns = [
    { header: "#", key: "no", width: 7 },
    { header: "ID", key: "id", width: 8 },
    { header: "Method", key: "method", width: 10 },
    { header: "Path", key: "path", width: 52 },
    { header: "Active", key: "active", width: 10 },
    { header: "Permission ID", key: "permissionId", width: 34 },
    { header: "Permission Name", key: "permissionName", width: 28 },
    { header: "Resource", key: "resource", width: 22 },
    { header: "Action", key: "action", width: 14 },
    { header: "Role ID", key: "roleId", width: 18 },
    { header: "Role Name", key: "roleName", width: 24 },
    { header: "Role Priority", key: "rolePriority", width: 14 },
    { header: "Guard Type", key: "guardType", width: 18 },
    { header: "Created At", key: "createdAt", width: 18 },
    { header: "Updated At", key: "updatedAt", width: 18 },
  ];
  applyHeader(routesSheet.getRow(1), headerFill, border);
  routesSheet.autoFilter = { from: "A1", to: "O1" };

  rows.forEach((item, index) => {
    const guardType = item.permissionId && item.roleId
      ? "Permission + Role"
      : item.permissionId
        ? "Permission"
        : item.roleId
          ? "Role"
          : "No guard";
    const row = routesSheet.addRow({
      no: index + 1,
      id: item.id,
      method: item.method,
      path: item.path,
      active: yesNo(item.isActive),
      permissionId: safeText(item.permissionId),
      permissionName: safeText(item.permissionName),
      resource: safeText(item.resource),
      action: safeText(item.action),
      roleId: safeText(item.roleId),
      roleName: safeText(item.roleName),
      rolePriority: item.rolePriority ?? "-",
      guardType,
      createdAt: dateText(item.createdAt),
      updatedAt: dateText(item.updatedAt),
    });
    applyBody(row, border);
    row.getCell("method").fill = item.method === "DELETE" ? dangerFill : item.method === "GET" ? successFill : softFill;
    row.getCell("active").fill = item.isActive ? successFill : warningFill;
    if (guardType === "No guard") row.getCell("guardType").fill = warningFill;
  });

  const methodSheet = workbook.addWorksheet("Method Breakdown", { views: [{ showGridLines: false }] });
  methodSheet.columns = [
    { header: "Method", key: "method", width: 14 },
    { header: "Routes", key: "routes", width: 14 },
    { header: "Active", key: "active", width: 14 },
    { header: "With Permission", key: "permission", width: 18 },
    { header: "With Role", key: "role", width: 14 },
    { header: "No Guard", key: "unguarded", width: 14 },
  ];
  applyHeader(methodSheet.getRow(1), headerFill, border);
  const methodMap = new Map<string, { routes: number; active: number; permission: number; role: number; unguarded: number }>();
  rows.forEach((row) => {
    const item = methodMap.get(row.method) ?? { routes: 0, active: 0, permission: 0, role: 0, unguarded: 0 };
    item.routes += 1;
    if (row.isActive) item.active += 1;
    if (row.permissionId) item.permission += 1;
    if (row.roleId) item.role += 1;
    if (!row.permissionId && !row.roleId) item.unguarded += 1;
    methodMap.set(row.method, item);
  });
  [...methodMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([method, stats]) => {
    const row = methodSheet.addRow({ method, ...stats });
    applyBody(row, border);
  });

  const resourceSheet = workbook.addWorksheet("Resource Breakdown", { views: [{ showGridLines: false }] });
  resourceSheet.columns = [
    { header: "Resource", key: "resource", width: 28 },
    { header: "Routes", key: "routes", width: 14 },
    { header: "Active", key: "active", width: 14 },
    { header: "Inactive", key: "inactive", width: 14 },
    { header: "Methods", key: "methods", width: 28 },
  ];
  applyHeader(resourceSheet.getRow(1), headerFill, border);
  const resourceMap = new Map<string, { routes: number; active: number; methods: Set<string> }>();
  rows.forEach((row) => {
    const key = row.resource ?? "NO_PERMISSION_RESOURCE";
    const item = resourceMap.get(key) ?? { routes: 0, active: 0, methods: new Set<string>() };
    item.routes += 1;
    if (row.isActive) item.active += 1;
    item.methods.add(row.method);
    resourceMap.set(key, item);
  });
  [...resourceMap.entries()].sort((a, b) => b[1].routes - a[1].routes).forEach(([resource, stats]) => {
    const row = resourceSheet.addRow({
      resource,
      routes: stats.routes,
      active: stats.active,
      inactive: stats.routes - stats.active,
      methods: [...stats.methods].sort().join(", "),
    });
    applyBody(row, border);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer,
    filename: `api-route-requirements-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
    exportedCount: rows.length,
  };
}
