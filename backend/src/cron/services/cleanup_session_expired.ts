import prisma from "@/config/prisma.config";
import { SystemEventUtil } from "@/utils/system-event";
import { ErrorLogUtil } from "@/utils/error-log";

export const CLEANUP_EXPIRED_SESSIONS_JOB = "cleanup-expired-sessions";

export const CLEANUP_EXPIRED_SESSIONS_CONFIG = {
  enabled: "cron_cleanup_expired_sessions_enabled",
  expression: "cron_cleanup_expired_sessions_cron",
} as const;

function parseBooleanConfig(value: string | undefined, defaultValue: boolean) {
  if (!value) {
    return defaultValue;
  }

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
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      parts.weekday,
    ),
  };
}

function matchesCronField(field: string, value: number) {
  if (field === "*") {
    return true;
  }

  return field.split(",").some((part) => {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? Number(stepPart) : 1;

    if (!Number.isInteger(step) || step <= 0) {
      return false;
    }

    if (rangePart === "*") {
      return value % step === 0;
    }

    if (rangePart.includes("-")) {
      const [start, end] = rangePart.split("-").map(Number);

      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        return false;
      }

      return value >= start && value <= end && (value - start) % step === 0;
    }

    const exact = Number(rangePart);

    if (!Number.isInteger(exact)) {
      return false;
    }

    // start/step syntax: e.g. 5/15 → matches 5, 20, 35, 50
    if (stepPart) {
      return value >= exact && (value - exact) % step === 0;
    }

    return exact === value;
  });
}

function cronMatchesNow(expression: string, date = new Date()) {
  const [minute, hour, day, month, weekday] = expression.trim().split(/\s+/);
  const bangkokNow = getBangkokDateTimeParts(date);

  return (
    matchesCronField(minute, bangkokNow.minute) &&
    matchesCronField(hour, bangkokNow.hour) &&
    matchesCronField(day, bangkokNow.day) &&
    matchesCronField(month, bangkokNow.month) &&
    matchesCronField(weekday, bangkokNow.weekday)
  );
}

async function getCleanupCronConfig() {
  const configs = await prisma.system_config.findMany({
    where: {
      id: {
        in: [
          CLEANUP_EXPIRED_SESSIONS_CONFIG.enabled,
          CLEANUP_EXPIRED_SESSIONS_CONFIG.expression,
        ],
      },
      is_active: true,
    },
  });

  const configMap = new Map(configs.map((config) => [config.id, config.value]));
  const configuredExpression =
    configMap.get(CLEANUP_EXPIRED_SESSIONS_CONFIG.expression) ?? "0 2 * * *";

  return {
    enabled: parseBooleanConfig(
      configMap.get(CLEANUP_EXPIRED_SESSIONS_CONFIG.enabled),
      true,
    ),
    expression: isValidCronExpression(configuredExpression)
      ? configuredExpression
      : "0 2 * * *",
  };
}

async function hasRunThisMinute(jobName: string) {
  const now = new Date();
  const startOfMinute = new Date(now);
  startOfMinute.setSeconds(0, 0);

  const existingRun = await prisma.cron_run_history.findFirst({
    where: {
      job_name: jobName,
      status: "SUCCESS",
      started_at: {
        gte: startOfMinute,
        lte: now,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(existingRun);
}

export async function shouldRunCleanupExpiredSessions() {
  const config = await getCleanupCronConfig();

  if (!config.enabled) {
    return {
      shouldRun: false,
      reason: "disabled",
      config,
    };
  }

  if (!cronMatchesNow(config.expression)) {
    return {
      shouldRun: false,
      reason: "not_scheduled_expression",
      config,
    };
  }

  if (await hasRunThisMinute(CLEANUP_EXPIRED_SESSIONS_JOB)) {
    return {
      shouldRun: false,
      reason: "already_ran_this_minute",
      config,
    };
  }

  return {
    shouldRun: true,
    reason: "scheduled",
    config,
  };
}

export async function cleanupExpiredSessions(
  config?: Awaited<ReturnType<typeof getCleanupCronConfig>>,
) {
  const now = new Date();
  const startedAt = Date.now();
  const resolvedConfig = config ?? (await getCleanupCronConfig());
  const history = await prisma.cron_run_history.create({
    data: {
      job_name: CLEANUP_EXPIRED_SESSIONS_JOB,
      status: "RUNNING",
      config_snapshot: JSON.stringify(resolvedConfig),
    },
  });

  try {
    const expiredSessions = await prisma.session.findMany({
      where: {
        expires_at: {
          lte: now,
        },
      },
    });

    if (expiredSessions.length === 0) {
      const durationMs = Date.now() - startedAt;
      await prisma.cron_run_history.update({
        where: { id: history.id },
        data: {
          status: "SUCCESS",
          finished_at: new Date(),
          duration_ms: durationMs,
        },
      });
      SystemEventUtil.success("CRON", CLEANUP_EXPIRED_SESSIONS_JOB, durationMs, {
        archived: 0,
        deleted: 0,
      });

      return {
        archived: 0,
        deleted: 0,
      };
    }

    const historyData = expiredSessions.map((session) => ({
      user_id: session.user_id,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      ip_address: session.ip_address,
      user_agent: session.user_agent,
      device_info: session.device_info,
      location: session.location,
      login_source: session.login_source,
      session_type: session.session_type,
      is_active: false as const,
      status: "EXPIRED",
      revocation_reason: session.revocation_reason ?? "Session expired",
      created_at: session.created_at,
      expired_at: session.expires_at,
      last_used_at: session.last_used_at,
      moved_to_history_at: now,
    }));

    const expiredIds = expiredSessions.map((s) => s.id);

    await prisma.$transaction([
      prisma.session_history.createMany({ data: historyData }),
      prisma.session.deleteMany({ where: { id: { in: expiredIds } } }),
    ]);

    const archived = expiredSessions.length;

    const durationMs = Date.now() - startedAt;
    await prisma.cron_run_history.update({
      where: { id: history.id },
      data: {
        status: "SUCCESS",
        finished_at: new Date(),
        duration_ms: durationMs,
        archived_count: archived,
        deleted_count: archived,
      },
    });
    SystemEventUtil.success("CRON", CLEANUP_EXPIRED_SESSIONS_JOB, durationMs, {
      archived,
      deleted: archived,
    });

    return {
      archived,
      deleted: archived,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    await prisma.cron_run_history.update({
      where: { id: history.id },
      data: {
        status: "FAILED",
        finished_at: new Date(),
        duration_ms: durationMs,
        error_message: error instanceof Error ? error.message : String(error),
      },
    });
    ErrorLogUtil.log(error, {
      source: `cron:${CLEANUP_EXPIRED_SESSIONS_JOB}`,
      context: resolvedConfig,
    });
    SystemEventUtil.failed(
      "CRON",
      CLEANUP_EXPIRED_SESSIONS_JOB,
      error instanceof Error ? error.message : String(error),
      { durationMs, config: resolvedConfig },
    );

    throw error;
  }
}
