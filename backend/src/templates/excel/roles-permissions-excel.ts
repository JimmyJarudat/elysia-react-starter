import ExcelJS from "exceljs";
import { formatSystemDateSync } from "@/utils/date-formatter";

export interface RolesPermissionsExcelRole {
  id: string;
  name: string;
  priority: number;
  description: string | null;
  userCount: number;
  permissionCount: number;
  permissions: Array<{ id: string; name: string; resource: string; action: string; description: string | null }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolesPermissionsExcelPermission {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  roleCount: number;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RolesPermissionsExcelHierarchy {
  parentRoleId: string;
  parentRoleName: string;
  parentPriority: number;
  childRoleId: string;
  childRoleName: string;
  childPriority: number;
  createdAt: Date;
}

export interface RolesPermissionsExcelApiRoute {
  method: string;
  path: string;
  roleId: string | null;
  permissionId: string | null;
  permissionName: string | null;
  resource: string | null;
  action: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuildRolesPermissionsExcelInput {
  roles: RolesPermissionsExcelRole[];
  permissions: RolesPermissionsExcelPermission[];
  hierarchy: RolesPermissionsExcelHierarchy[];
  apiRoutes: RolesPermissionsExcelApiRoute[];
  filters: {
    permissionSearch?: string;
    permissionResource?: string;
    permissionAction?: string;
  };
}

const safeText = (value?: string | number | boolean | null) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const dateText = (value?: Date | null) => (value ? formatSystemDateSync(value) : "-");

const resourceGroupOf = (resource: string) => resource.split(".")[0];

const columnLetter = (column: number) => {
  let value = column;
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
};

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

export async function buildRolesPermissionsExcel(input: BuildRolesPermissionsExcelInput) {
  const { roles, permissions, hierarchy, apiRoutes, filters } = input;
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
  const border = {
    top: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    left: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    right: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
  };

  const filteredPermissions = permissions.filter((permission) => {
    const query = filters.permissionSearch?.trim().toLowerCase() ?? "";
    const matchesSearch = !query ||
      permission.id.toLowerCase().includes(query) ||
      permission.name.toLowerCase().includes(query) ||
      permission.resource.toLowerCase().includes(query) ||
      permission.action.toLowerCase().includes(query) ||
      (permission.description?.toLowerCase().includes(query) ?? false);
    const matchesResource =
      !filters.permissionResource ||
      filters.permissionResource === "all" ||
      resourceGroupOf(permission.resource) === filters.permissionResource;
    const matchesAction =
      !filters.permissionAction ||
      filters.permissionAction === "all" ||
      permission.action === filters.permissionAction;

    return matchesSearch && matchesResource && matchesAction;
  });
  const filteredPermissionIds = new Set(filteredPermissions.map((permission) => permission.id));

  const summary = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  summary.columns = [{ width: 24 }, { width: 28 }, { width: 24 }, { width: 28 }, { width: 24 }, { width: 28 }];
  summary.mergeCells("A1:F2");
  summary.getCell("A1").value = "Roles & Permissions Export";
  summary.getCell("A1").font = { bold: true, size: 22, color: { argb: "FFFFFFFF" } };
  summary.getCell("A1").fill = titleFill;
  summary.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

  summary.mergeCells("A4:F4");
  summary.getCell("A4").value = "Export Details";
  summary.getCell("A4").font = { bold: true, color: { argb: "FF334155" } };
  summary.getCell("A4").fill = sectionFill;
  summary.getCell("A4").alignment = { horizontal: "center", vertical: "middle" };

  [
    ["Exported At", dateText(new Date()), "Roles", roles.length, "Permissions", permissions.length],
    ["Filtered Permissions", filteredPermissions.length, "Hierarchy Links", hierarchy.length, "API Routes", apiRoutes.length],
    ["Search", safeText(filters.permissionSearch), "Resource", filters.permissionResource ?? "all", "Action", filters.permissionAction ?? "all"],
  ].forEach((values, index) => {
    const row = summary.getRow(5 + index);
    values.forEach((value, valueIndex) => {
      const cell = row.getCell(valueIndex + 1);
      cell.value = value;
      cell.fill = valueIndex % 2 === 0 ? sectionFill : softFill;
      if (valueIndex % 2 === 0) cell.font = { bold: true, color: { argb: "FF334155" } };
    });
  });

  summary.mergeCells("A10:F10");
  summary.getCell("A10").value = "Coverage";
  summary.getCell("A10").font = { bold: true, color: { argb: "FF334155" } };
  summary.getCell("A10").fill = sectionFill;
  summary.getCell("A10").alignment = { horizontal: "center", vertical: "middle" };

  const resourceCount = new Set(permissions.map((permission) => resourceGroupOf(permission.resource))).size;
  const assignedPermissionCount = permissions.filter((permission) => permission.roleCount > 0).length;
  [
    ["Metric", "Value", "Metric", "Value", "Metric", "Value"],
    ["Resources", resourceCount, "Assigned Permissions", assignedPermissionCount, "Unassigned Permissions", permissions.length - assignedPermissionCount],
    ["Roles With Users", roles.filter((role) => role.userCount > 0).length, "System Role", roles.some((role) => role.id === "SUPERADMIN") ? "SUPERADMIN" : "-", "Protected Routes", apiRoutes.filter((route) => route.isActive).length],
  ].forEach((values, index) => {
    const row = summary.getRow(11 + index);
    values.forEach((value, valueIndex) => {
      const cell = row.getCell(valueIndex + 1);
      cell.value = value;
      if (index === 0) {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = headerFill;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.fill = valueIndex % 2 === 0 ? sectionFill : softFill;
        if (valueIndex % 2 === 0) cell.font = { bold: true, color: { argb: "FF334155" } };
      }
    });
  });

  for (let rowIndex = 1; rowIndex <= 13; rowIndex++) {
    for (let colIndex = 1; colIndex <= 6; colIndex++) {
      const cell = summary.getRow(rowIndex).getCell(colIndex);
      cell.border = border;
      cell.alignment = rowIndex === 4 || rowIndex === 10 || rowIndex === 11
        ? { horizontal: "center", vertical: "middle", wrapText: true }
        : { vertical: "middle", wrapText: true };
    }
  }

  const rolesSheet = workbook.addWorksheet("Roles", { views: [{ state: "frozen", ySplit: 1 }] });
  rolesSheet.columns = [
    { header: "#", key: "no", width: 7 },
    { header: "Role ID", key: "id", width: 18 },
    { header: "Role Name", key: "name", width: 24 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Users", key: "users", width: 12 },
    { header: "Permissions", key: "permissions", width: 14 },
    { header: "Description", key: "description", width: 44 },
    { header: "Created At", key: "createdAt", width: 18 },
    { header: "Updated At", key: "updatedAt", width: 18 },
  ];
  applyHeader(rolesSheet.getRow(1), headerFill, border);
  rolesSheet.autoFilter = { from: "A1", to: "I1" };
  roles.forEach((role, index) => {
    const row = rolesSheet.addRow({
      no: index + 1,
      id: role.id,
      name: role.name,
      priority: role.priority,
      users: role.userCount,
      permissions: role.permissionCount,
      description: safeText(role.description),
      createdAt: dateText(role.createdAt),
      updatedAt: dateText(role.updatedAt),
    });
    applyBody(row, border);
    if (role.id === "SUPERADMIN") row.getCell("id").fill = warningFill;
  });

  const permissionsSheet = workbook.addWorksheet("Permissions", { views: [{ state: "frozen", ySplit: 1 }] });
  permissionsSheet.columns = [
    { header: "#", key: "no", width: 7 },
    { header: "Permission ID", key: "id", width: 32 },
    { header: "Name", key: "name", width: 28 },
    { header: "Resource Group", key: "resourceGroup", width: 18 },
    { header: "Resource", key: "resource", width: 26 },
    { header: "Action", key: "action", width: 14 },
    { header: "Roles", key: "roleCount", width: 12 },
    { header: "Assigned Roles", key: "roles", width: 38 },
    { header: "Description", key: "description", width: 44 },
    { header: "Created At", key: "createdAt", width: 18 },
    { header: "Updated At", key: "updatedAt", width: 18 },
  ];
  applyHeader(permissionsSheet.getRow(1), headerFill, border);
  permissionsSheet.autoFilter = { from: "A1", to: "K1" };
  filteredPermissions.forEach((permission, index) => {
    const row = permissionsSheet.addRow({
      no: index + 1,
      id: permission.id,
      name: permission.name,
      resourceGroup: resourceGroupOf(permission.resource),
      resource: permission.resource,
      action: permission.action,
      roleCount: permission.roleCount,
      roles: permission.roles.join(", ") || "-",
      description: safeText(permission.description),
      createdAt: dateText(permission.createdAt),
      updatedAt: dateText(permission.updatedAt),
    });
    applyBody(row, border);
    row.getCell("action").fill = permission.action === "read" ? successFill : softFill;
  });

  const matrixSheet = workbook.addWorksheet("Role Permissions Matrix", { views: [{ state: "frozen", ySplit: 1, xSplit: 3 }] });
  matrixSheet.columns = [
    { header: "Permission ID", key: "permissionId", width: 32 },
    { header: "Resource", key: "resource", width: 26 },
    { header: "Action", key: "action", width: 14 },
    ...roles.map((role) => ({ header: role.id, key: role.id, width: Math.max(12, Math.min(20, role.id.length + 2)) })),
  ];
  applyHeader(matrixSheet.getRow(1), headerFill, border);
  matrixSheet.autoFilter = { from: "A1", to: `${columnLetter(3 + roles.length)}1` };
  filteredPermissions.forEach((permission) => {
    const assignedRoles = new Set(permission.roles);
    const row = matrixSheet.addRow({
      permissionId: permission.id,
      resource: permission.resource,
      action: permission.action,
      ...Object.fromEntries(roles.map((role) => [role.id, assignedRoles.has(role.id) ? "Yes" : ""])),
    });
    applyBody(row, border);
    roles.forEach((role) => {
      if (assignedRoles.has(role.id)) row.getCell(role.id).fill = successFill;
    });
  });

  const hierarchySheet = workbook.addWorksheet("Hierarchy", { views: [{ state: "frozen", ySplit: 1 }] });
  hierarchySheet.columns = [
    { header: "#", key: "no", width: 7 },
    { header: "Parent Role ID", key: "parentRoleId", width: 18 },
    { header: "Parent Role", key: "parentRoleName", width: 24 },
    { header: "Parent Priority", key: "parentPriority", width: 16 },
    { header: "Child Role ID", key: "childRoleId", width: 18 },
    { header: "Child Role", key: "childRoleName", width: 24 },
    { header: "Child Priority", key: "childPriority", width: 16 },
    { header: "Created At", key: "createdAt", width: 18 },
  ];
  applyHeader(hierarchySheet.getRow(1), headerFill, border);
  hierarchy.forEach((item, index) => {
    const row = hierarchySheet.addRow({ no: index + 1, ...item, createdAt: dateText(item.createdAt) });
    applyBody(row, border);
  });

  const routesSheet = workbook.addWorksheet("API Routes", { views: [{ state: "frozen", ySplit: 1 }] });
  routesSheet.columns = [
    { header: "#", key: "no", width: 7 },
    { header: "Method", key: "method", width: 10 },
    { header: "Path", key: "path", width: 48 },
    { header: "Active", key: "active", width: 10 },
    { header: "Role ID", key: "roleId", width: 18 },
    { header: "Permission ID", key: "permissionId", width: 32 },
    { header: "Permission Name", key: "permissionName", width: 28 },
    { header: "Resource", key: "resource", width: 22 },
    { header: "Action", key: "action", width: 14 },
    { header: "Created At", key: "createdAt", width: 18 },
    { header: "Updated At", key: "updatedAt", width: 18 },
  ];
  applyHeader(routesSheet.getRow(1), headerFill, border);
  routesSheet.autoFilter = { from: "A1", to: "K1" };
  apiRoutes
    .filter((route) => !route.permissionId || filteredPermissionIds.size === 0 || filteredPermissionIds.has(route.permissionId))
    .forEach((route, index) => {
      const row = routesSheet.addRow({
        no: index + 1,
        method: route.method,
        path: route.path,
        active: route.isActive ? "Yes" : "No",
        roleId: safeText(route.roleId),
        permissionId: safeText(route.permissionId),
        permissionName: safeText(route.permissionName),
        resource: safeText(route.resource),
        action: safeText(route.action),
        createdAt: dateText(route.createdAt),
        updatedAt: dateText(route.updatedAt),
      });
      applyBody(row, border);
      row.getCell("active").fill = route.isActive ? successFill : warningFill;
    });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer,
    filename: `roles-permissions-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
  };
}
