export type RedisSettings = {
  enabled: boolean;
  host: string;
  port: number;
  db: number;
  password?: string;
  hasPassword: boolean;
  prefix: string;
};

export type SmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  encryption: "starttls" | "ssl" | "none";
  user: string;
  password?: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  appName: string;
  appUrl: string;
};

export type RedisResponse = { success: boolean; data: RedisSettings };
export type SmtpResponse = { success: boolean; data: SmtpSettings };
export type ActionResponse = { success: boolean; message: string };
export type RedisStatusResponse = {
  success: boolean;
  message: string;
  data?: { connected: boolean; latencyMs?: number };
};

export type ConnectionStatus = "idle" | "ok" | "error";
export type IntegrationStatusTone = "connected" | "enabled" | "disabled" | "error" | "loading";
