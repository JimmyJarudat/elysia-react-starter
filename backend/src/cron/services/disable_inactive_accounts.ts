import prisma from "@/config/prisma.config";

export const DISABLE_INACTIVE_ACCOUNTS_JOB = "disable-inactive-accounts";

export const DISABLE_INACTIVE_ACCOUNTS_CONFIG = {
  enabled: "cron_disable_inactive_accounts_enabled",
  expression: "cron_disable_inactive_accounts_cron",
} as const;

function parseBooleanConfig(value: string | undefined, defaultValue: boolean) {
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function isValidCronExpression(value: string) {
  return value.trim().split(/\s+/).length === 5;
}

function getBangkokDateTimeParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.minute),
    hour: Number(parts.hour),
    day: Number(parts.day),
    month: Number(parts.month),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
  };
}

function matchesCronField(field: string, value: number) {
  if (field === "*") return true;

  return field.split(",").some((part) => {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? Number(stepPart) : 1;

    if (!Number.isInteger(step) || step <= 0) return false;

    if (rangePart === "*") {
      return value % step === 0;
    }

    const [start, end] = rangePart.split("-").map(Number);
    if (!Number.isNaN(end)) {
      if (value < start || value > end) return false;
      return (value - start) % step === 0;
    }

    return Number(rangePart) === value;
  });
}

function matchesCronExpression(expression: string, parts: ReturnType<typeof getBangkokDateTimeParts>) {
  const [minute, hour, day, month, weekday] = expression.trim().split(/\s+/);
  return (
    matchesCronField(minute, parts.minute) &&
    matchesCronField(hour, parts.hour) &&
    matchesCronField(day, parts.day) &&
    matchesCronField(month, parts.month) &&
    matchesCronField(weekday, parts.weekday)
  );
}

export async function shouldRunDisableInactiveAccounts(): Promise<{
  shouldRun: boolean;
  config: { enabled: boolean; expression: string; inactivityDays: number };
}> {
  const configs = await prisma.system_config.findMany({
    where: {
      id: {
        in: [
          DISABLE_INACTIVE_ACCOUNTS_CONFIG.enabled,
          DISABLE_INACTIVE_ACCOUNTS_CONFIG.expression,
          "account_inactivity_days",
        ],
      },
    },
    select: { id: true, value: true },
  });

  const configMap = Object.fromEntries(configs.map((c) => [c.id, c.value]));
  const enabled = parseBooleanConfig(configMap[DISABLE_INACTIVE_ACCOUNTS_CONFIG.enabled], true);
  const expression = configMap[DISABLE_INACTIVE_ACCOUNTS_CONFIG.expression] || "0 3 * * *";
  const inactivityDays = Math.max(0, Number(configMap["account_inactivity_days"] ?? 0));

  if (!enabled || inactivityDays === 0 || !isValidCronExpression(expression)) {
    return { shouldRun: false, config: { enabled, expression, inactivityDays } };
  }

  const now = getBangkokDateTimeParts();
  const key = `cron:${DISABLE_INACTIVE_ACCOUNTS_JOB}:last_run`;
  const dateKey = `${now.date} ${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`;

  const lastRun = await prisma.system_config.findUnique({ where: { id: key }, select: { value: true } });
  if (lastRun?.value === dateKey) {
    return { shouldRun: false, config: { enabled, expression, inactivityDays } };
  }

  if (!matchesCronExpression(expression, now)) {
    return { shouldRun: false, config: { enabled, expression, inactivityDays } };
  }

  await prisma.system_config.upsert({
    where: { id: key },
    update: { value: dateKey, updated_at: new Date() },
    create: { id: key, value: dateKey, category: "CRON", display_name: "Disable Inactive Accounts Last Run", data_type: "STRING" },
  });

  return { shouldRun: true, config: { enabled, expression, inactivityDays } };
}

export async function disableInactiveAccounts(config: { inactivityDays: number }) {
  const startedAt = new Date();
  let disabledCount = 0;
  let errorMessage: string | undefined;

  try {
    const cutoffDate = new Date(Date.now() - config.inactivityDays * 24 * 60 * 60 * 1000);

    // ไม่ disable SUPERADMIN
    const superAdminUserIds = await prisma.user_roles.findMany({
      where: { role_id: "SUPERADMIN" },
      select: { user_id: true },
    });
    const excludeIds = superAdminUserIds.map((r) => r.user_id);

    const result = await prisma.users.updateMany({
      where: {
        is_active: true,
        is_deleted: false,
        id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
        last_login: { lt: cutoffDate },
      },
      data: { is_active: false, updated_at: new Date() },
    });

    disabledCount = result.count;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CRON] disableInactiveAccounts error:", errorMessage);
  }

  const finishedAt = new Date();

  await prisma.cron_run_history.create({
    data: {
      job_name: DISABLE_INACTIVE_ACCOUNTS_JOB,
      status: errorMessage ? "ERROR" : "SUCCESS",
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      archived_count: disabledCount,
      deleted_count: 0,
      error_message: errorMessage ?? null,
      config_snapshot: JSON.stringify(config),
    },
  });

  return { disabled: disabledCount };
}
