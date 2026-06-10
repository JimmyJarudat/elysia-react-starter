import { Server } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { card } from "./constants";
import RedisIntegration from "./components/RedisIntegration";
import SmtpIntegration from "./components/SmtpIntegration";

type IntegrationId = "redis" | "smtp";

const IntegrationsPage = () => {
  const { user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSuperAdmin = user?.roles?.includes("SUPERADMIN") ?? false;
  const permissions = user?.permissions ?? [];

  const canRead = (permission: string) =>
    isSuperAdmin || permissions.includes("settings.read") || permissions.includes(permission);
  const canUpdate = (permission: string) =>
    isSuperAdmin || permissions.includes("settings.update") || permissions.includes(permission);

  const canReadRedis = canRead("settings.integrations.redis.read");
  const canUpdateRedis = canUpdate("settings.integrations.redis.update");
  const canReadSmtp = canRead("settings.integrations.smtp.read");
  const canUpdateSmtp = canUpdate("settings.integrations.smtp.update");
  const expandedIntegrations = searchParams.getAll("integration");

  const toggleIntegration = (id: IntegrationId) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      const opened = next.getAll("integration");
      next.delete("integration");
      const nextOpened = opened.includes(id)
        ? opened.filter((item) => item !== id)
        : [...opened, id];
      nextOpened.forEach((item) => next.append("integration", item));
      return next;
    });
  };

  return (
    <section className="grid gap-5">
      <div className={card}>
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-light-primary to-light-primary-hover text-white shadow-sm dark:from-dark-primary dark:to-dark-primary-hover dark:text-dark-background">
            <Server className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">System Setting</p>
            <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Integrations</h1>
            <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">ตั้งค่า Redis cache และ SMTP email พร้อมทดสอบการเชื่อมต่อ</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {canReadRedis && (
          <RedisIntegration
            canUpdate={canUpdateRedis}
            expanded={expandedIntegrations.includes("redis")}
            onToggle={() => toggleIntegration("redis")}
          />
        )}
        {canReadSmtp && (
          <SmtpIntegration
            canUpdate={canUpdateSmtp}
            expanded={expandedIntegrations.includes("smtp")}
            onToggle={() => toggleIntegration("smtp")}
          />
        )}
      </div>
    </section>
  );
};

export default IntegrationsPage;
