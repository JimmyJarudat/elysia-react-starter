import ExcelJS from "exceljs";
import { formatSystemDateSync } from "@/utils/date-formatter";

export interface UsersExcelRole {
  id: string;
  name: string;
  priority: number | null;
  assignedAt: Date | null;
  assignedBy: string | null;
  remark: string | null;
}

export interface UsersExcelRecord {
  id: number;
  username: string;
  email: string;
  groupName: string | null;
  isActive: boolean;
  isOnline: boolean;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
  isApproved: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLogin: Date | null;
  passwordChangedAt: Date | null;
  mustChangePassword: boolean;
  creationType: string;
  lastTermsAccepted: Date | null;
  termsVersion: string | null;
  recoveryEmail: string | null;
  temporaryAccount: boolean;
  accountExpiry: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  remarks: string | null;
  language: string;
  profile: {
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    phoneNumber: string | null;
    department: string | null;
    address: string | null;
    subDistrict: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    gender: string | null;
    dateOfBirth: Date | null;
    website: string | null;
  };
  roles: UsersExcelRole[];
}

export interface BuildUsersExcelInput {
  rows: UsersExcelRecord[];
  filters: {
    search?: string;
    status?: string;
    online?: string;
    approval?: string;
    verification?: string;
    role?: string;
    includeDeleted?: boolean;
  };
}

const safeText = (value?: string | number | boolean | null) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const yesNo = (value: boolean) => (value ? "Yes" : "No");

const dateText = (value?: Date | null) => (value ? formatSystemDateSync(value) : "-");

const displayName = (row: UsersExcelRecord) => {
  const profileName = [row.profile.firstName, row.profile.lastName].filter(Boolean).join(" ").trim();
  return row.profile.displayName || profileName || row.username;
};

const addTitle = (sheet: ExcelJS.Worksheet, title: string, endColumn: string) => {
  sheet.mergeCells(`A1:${endColumn}2`);
  const cell = sheet.getCell("A1");
  cell.value = title;
  cell.font = { bold: true, size: 22, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
};

export async function buildUsersExcel(input: BuildUsersExcelInput) {
  const { rows, filters } = input;
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
  const thinBorder = {
    top: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    left: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    right: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
  };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" } };
  const labelFont = { bold: true, color: { argb: "FF334155" } };

  const activeCount = rows.filter((row) => row.isActive).length;
  const inactiveCount = rows.length - activeCount;
  const onlineCount = rows.filter((row) => row.isOnline).length;
  const approvedCount = rows.filter((row) => row.isApproved).length;
  const pendingCount = rows.length - approvedCount;
  const verifiedCount = rows.filter((row) => row.isEmailVerified).length;
  const lockedCount = rows.filter((row) => row.lockedUntil && row.lockedUntil > new Date()).length;
  const mustChangePasswordCount = rows.filter((row) => row.mustChangePassword).length;

  const summary = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  summary.columns = [{ width: 24 }, { width: 28 }, { width: 22 }, { width: 26 }, { width: 22 }, { width: 26 }];
  addTitle(summary, "Users Export", "F");

  summary.mergeCells("A4:F4");
  summary.getCell("A4").value = "Export Details";
  summary.getCell("A4").font = { ...labelFont, size: 12 };
  summary.getCell("A4").fill = sectionFill;
  summary.getCell("A4").alignment = { horizontal: "center", vertical: "middle" };

  [
    ["Exported At", dateText(new Date()), "Rows Exported", rows.length, "Deleted Included", yesNo(Boolean(filters.includeDeleted))],
    ["Search", safeText(filters.search), "Status", filters.status ?? "all", "Online", filters.online ?? "all"],
    ["Approval", filters.approval ?? "all", "Verification", filters.verification ?? "all", "Role", filters.role ?? "all"],
  ].forEach((values, index) => {
    const row = summary.getRow(5 + index);
    values.forEach((value, valueIndex) => {
      row.getCell(valueIndex + 1).value = value;
    });
    [1, 3, 5].forEach((col) => {
      row.getCell(col).font = labelFont;
      row.getCell(col).fill = sectionFill;
    });
    [2, 4, 6].forEach((col) => {
      row.getCell(col).fill = softFill;
    });
  });

  summary.mergeCells("A10:F10");
  summary.getCell("A10").value = "Key Metrics";
  summary.getCell("A10").font = { ...labelFont, size: 12 };
  summary.getCell("A10").fill = sectionFill;
  summary.getCell("A10").alignment = { horizontal: "center", vertical: "middle" };

  [
    ["Metric", "Value", "Metric", "Value", "Metric", "Value"],
    ["Active", activeCount, "Inactive", inactiveCount, "Online", onlineCount],
    ["Approved", approvedCount, "Pending Approval", pendingCount, "Email Verified", verifiedCount],
    ["Locked", lockedCount, "Must Change Password", mustChangePasswordCount, "Temporary Accounts", rows.filter((row) => row.temporaryAccount).length],
  ].forEach((values, index) => {
    const row = summary.getRow(11 + index);
    values.forEach((value, valueIndex) => {
      const cell = row.getCell(valueIndex + 1);
      cell.value = value;
      if (index === 0 || valueIndex % 2 === 0) cell.font = labelFont;
      if (index === 0) {
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.fill = valueIndex % 2 === 0 ? sectionFill : softFill;
      }
    });
  });

  for (let rowIndex = 1; rowIndex <= 14; rowIndex++) {
    for (let colIndex = 1; colIndex <= 6; colIndex++) {
      const cell = summary.getRow(rowIndex).getCell(colIndex);
      cell.border = thinBorder;
      cell.alignment = rowIndex === 4 || rowIndex === 10 || rowIndex === 11
        ? { horizontal: "center", vertical: "middle", wrapText: true }
        : { vertical: "middle", wrapText: true };
    }
  }

  const usersSheet = workbook.addWorksheet("Users", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  usersSheet.columns = [
    { header: "#", key: "no", width: 7 },
    { header: "User ID", key: "id", width: 10 },
    { header: "Username", key: "username", width: 18 },
    { header: "Display Name", key: "displayName", width: 24 },
    { header: "First Name", key: "firstName", width: 18 },
    { header: "Last Name", key: "lastName", width: 18 },
    { header: "Email", key: "email", width: 32 },
    { header: "Recovery Email", key: "recoveryEmail", width: 32 },
    { header: "Group", key: "groupName", width: 20 },
    { header: "Department", key: "department", width: 20 },
    { header: "Gender", key: "gender", width: 10 },
    { header: "Date of Birth", key: "dateOfBirth", width: 16 },
    { header: "Roles", key: "roles", width: 32 },
    { header: "Highest Role Priority", key: "highestPriority", width: 18 },
    { header: "Active", key: "active", width: 10 },
    { header: "Online", key: "online", width: 10 },
    { header: "Approved", key: "approved", width: 12 },
    { header: "Approved By", key: "approvedBy", width: 18 },
    { header: "Approved At", key: "approvedAt", width: 18 },
    { header: "Email Verified", key: "emailVerified", width: 15 },
    { header: "Email Verified At", key: "emailVerifiedAt", width: 18 },
    { header: "Failed Login Attempts", key: "failedLoginAttempts", width: 18 },
    { header: "Locked Until", key: "lockedUntil", width: 18 },
    { header: "Last Login", key: "lastLogin", width: 18 },
    { header: "Password Changed At", key: "passwordChangedAt", width: 21 },
    { header: "Must Change Password", key: "mustChangePassword", width: 20 },
    { header: "Creation Type", key: "creationType", width: 18 },
    { header: "Temporary Account", key: "temporaryAccount", width: 18 },
    { header: "Account Expiry", key: "accountExpiry", width: 18 },
    { header: "Language", key: "language", width: 10 },
    { header: "Phone", key: "phoneNumber", width: 18 },
    { header: "Address", key: "address", width: 38 },
    { header: "Website", key: "website", width: 28 },
    { header: "Terms Version", key: "termsVersion", width: 15 },
    { header: "Last Terms Accepted", key: "lastTermsAccepted", width: 20 },
    { header: "Deleted", key: "deleted", width: 10 },
    { header: "Deleted At", key: "deletedAt", width: 18 },
    { header: "Created At", key: "createdAt", width: 18 },
    { header: "Updated At", key: "updatedAt", width: 18 },
    { header: "Remarks", key: "remarks", width: 34 },
  ];

  usersSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  usersSheet.autoFilter = { from: "A1", to: "AN1" };

  rows.forEach((item, index) => {
    const highestPriority = item.roles.reduce<number | null>((max, role) => {
      if (role.priority === null) return max;
      return max === null ? role.priority : Math.max(max, role.priority);
    }, null);
    const location = [item.profile.address, item.profile.subDistrict, item.profile.city, item.profile.state, item.profile.postalCode, item.profile.country]
      .filter(Boolean)
      .join(", ");
    const row = usersSheet.addRow({
      no: index + 1,
      id: item.id,
      username: item.username,
      displayName: displayName(item),
      firstName: safeText(item.profile.firstName),
      lastName: safeText(item.profile.lastName),
      email: item.email,
      recoveryEmail: safeText(item.recoveryEmail),
      groupName: safeText(item.groupName),
      department: safeText(item.profile.department),
      gender: safeText(item.profile.gender),
      dateOfBirth: dateText(item.profile.dateOfBirth),
      roles: item.roles.map((role) => `${role.name} (${role.id})`).join(", ") || "-",
      highestPriority: highestPriority ?? "-",
      active: yesNo(item.isActive),
      online: yesNo(item.isOnline),
      approved: yesNo(item.isApproved),
      approvedBy: safeText(item.approvedBy),
      approvedAt: dateText(item.approvedAt),
      emailVerified: yesNo(item.isEmailVerified),
      emailVerifiedAt: dateText(item.emailVerifiedAt),
      failedLoginAttempts: item.failedLoginAttempts,
      lockedUntil: dateText(item.lockedUntil),
      lastLogin: dateText(item.lastLogin),
      passwordChangedAt: dateText(item.passwordChangedAt),
      mustChangePassword: yesNo(item.mustChangePassword),
      creationType: item.creationType,
      temporaryAccount: yesNo(item.temporaryAccount),
      accountExpiry: dateText(item.accountExpiry),
      language: item.language,
      phoneNumber: safeText(item.profile.phoneNumber),
      address: safeText(location),
      website: safeText(item.profile.website),
      termsVersion: safeText(item.termsVersion),
      lastTermsAccepted: dateText(item.lastTermsAccepted),
      deleted: yesNo(item.isDeleted),
      deletedAt: dateText(item.deletedAt),
      createdAt: dateText(item.createdAt),
      updatedAt: dateText(item.updatedAt),
      remarks: safeText(item.remarks),
    });

    row.eachCell((cell) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    row.getCell("active").fill = item.isActive ? successFill : dangerFill;
    row.getCell("online").fill = item.isOnline ? successFill : softFill;
    row.getCell("approved").fill = item.isApproved ? successFill : warningFill;
    row.getCell("emailVerified").fill = item.isEmailVerified ? successFill : warningFill;
    row.getCell("lockedUntil").fill = item.lockedUntil && item.lockedUntil > new Date() ? dangerFill : softFill;
    if (item.isDeleted) row.getCell("deleted").fill = dangerFill;
  });

  const rolesSheet = workbook.addWorksheet("Role Breakdown", { views: [{ showGridLines: false }] });
  rolesSheet.columns = [
    { header: "Role ID", key: "roleId", width: 18 },
    { header: "Role Name", key: "roleName", width: 24 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Users", key: "users", width: 12 },
    { header: "Active Users", key: "active", width: 14 },
    { header: "Pending Approval", key: "pending", width: 16 },
  ];
  rolesSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const roleMap = new Map<string, { roleId: string; roleName: string; priority: number | null; users: number; active: number; pending: number }>();
  rows.forEach((user) => {
    if (user.roles.length === 0) {
      const empty = roleMap.get("NO_ROLE") ?? { roleId: "NO_ROLE", roleName: "No role", priority: null, users: 0, active: 0, pending: 0 };
      empty.users += 1;
      if (user.isActive) empty.active += 1;
      if (!user.isApproved) empty.pending += 1;
      roleMap.set("NO_ROLE", empty);
      return;
    }

    user.roles.forEach((role) => {
      const item = roleMap.get(role.id) ?? { roleId: role.id, roleName: role.name, priority: role.priority, users: 0, active: 0, pending: 0 };
      item.users += 1;
      if (user.isActive) item.active += 1;
      if (!user.isApproved) item.pending += 1;
      roleMap.set(role.id, item);
    });
  });

  [...roleMap.values()]
    .sort((a, b) => b.users - a.users || (b.priority ?? 0) - (a.priority ?? 0))
    .forEach((item) => {
      const row = rolesSheet.addRow({ ...item, priority: item.priority ?? "-" });
      row.eachCell((cell) => {
        cell.border = thinBorder;
        cell.alignment = { vertical: "middle", wrapText: true };
      });
    });

  const assignmentsSheet = workbook.addWorksheet("Role Assignments", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  assignmentsSheet.columns = [
    { header: "#", key: "no", width: 7 },
    { header: "User ID", key: "userId", width: 10 },
    { header: "Username", key: "username", width: 18 },
    { header: "Display Name", key: "displayName", width: 24 },
    { header: "Role ID", key: "roleId", width: 18 },
    { header: "Role Name", key: "roleName", width: 24 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Assigned At", key: "assignedAt", width: 18 },
    { header: "Assigned By", key: "assignedBy", width: 18 },
    { header: "Remark", key: "remark", width: 24 },
  ];
  assignmentsSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  assignmentsSheet.autoFilter = { from: "A1", to: "J1" };

  let assignmentIndex = 0;
  rows.forEach((user) => {
    if (user.roles.length === 0) {
      assignmentIndex += 1;
      const row = assignmentsSheet.addRow({
        no: assignmentIndex,
        userId: user.id,
        username: user.username,
        displayName: displayName(user),
        roleId: "NO_ROLE",
        roleName: "No role",
        priority: "-",
        assignedAt: "-",
        assignedBy: "-",
        remark: "-",
      });
      row.eachCell((cell) => {
        cell.border = thinBorder;
        cell.alignment = { vertical: "middle", wrapText: true };
      });
      return;
    }

    user.roles.forEach((role) => {
      assignmentIndex += 1;
      const row = assignmentsSheet.addRow({
        no: assignmentIndex,
        userId: user.id,
        username: user.username,
        displayName: displayName(user),
        roleId: role.id,
        roleName: role.name,
        priority: role.priority ?? "-",
        assignedAt: dateText(role.assignedAt),
        assignedBy: safeText(role.assignedBy),
        remark: safeText(role.remark),
      });
      row.eachCell((cell) => {
        cell.border = thinBorder;
        cell.alignment = { vertical: "middle", wrapText: true };
      });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer,
    filename: `users-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
    exportedCount: rows.length,
  };
}
