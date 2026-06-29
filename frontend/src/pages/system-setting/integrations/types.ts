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

export type LdapEncryption = "none" | "starttls" | "ldaps";

export type LdapSettings = {
  enabled: boolean;
  url: string;
  encryption: LdapEncryption;
  bindDn: string;
  bindPassword: string;
  hasBindPassword: boolean;
  baseDn: string;
  userFilter: string;
};

export type RedisResponse = { success: boolean; data: RedisSettings };
export type SmtpResponse = { success: boolean; data: SmtpSettings };
export type LdapUser = {
  username: string;
  displayName: string;
  email: string;
  dn: string;
  filter: string;
};
export type LdapResponse = { success: boolean; data: LdapSettings };
export type LdapFetchUserResponse = { success: boolean; message: string; data?: LdapUser };
export type ActionResponse = { success: boolean; message: string };
export type RedisStatusResponse = {
  success: boolean;
  message: string;
  data?: { connected: boolean; latencyMs?: number };
};

export type StorageType = "local" | "smb" | "sftp" | "ftp" | "s3";
export type S3Provider = "amazon-s3" | "minio" | "cloudflare-r2";

export type StorageSettings = {
  enabled: boolean;
  type: StorageType;
  s3Provider: S3Provider;
  basePath: string;
  host: string;
  port: number;
  shareName: string;
  domain: string;
  username: string;
  password: string;
  hasPassword: boolean;
  ftpSecure: boolean;
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  pathPrefix: string;
  forcePathStyle: boolean;
};

export type ConnectionStatus = "idle" | "ok" | "error";
export type IntegrationStatusTone = "connected" | "enabled" | "disabled" | "error" | "loading";

export type StorageResponse = {
  success: boolean;
  data: {
    provider: "local" | "smb" | "sftp" | "ftp";
    smb: {
      host: string;
      shareName: string;
      domain: string;
      username: string;
      hasPassword: boolean;
      basePath: string;
    };
    sftp: {
      host: string;
      port: number;
      username: string;
      hasPassword: boolean;
      basePath: string;
    };
    ftp: {
      host: string;
      port: number;
      username: string;
      hasPassword: boolean;
      basePath: string;
      secure: boolean;
    };
  };
  migrationAvailable?: boolean;
};

export type StorageMigrationStatusResponse = {
  success: boolean;
  data: {
    available: boolean;
    inProgress: boolean;
    completed: boolean;
    from?: "local" | "smb" | "sftp" | "ftp";
    to?: "local" | "smb" | "sftp" | "ftp";
  };
};

export type StorageMigrationScanResponse = {
  success: boolean;
  message?: string;
  data?: {
    from: "local" | "smb" | "sftp" | "ftp";
    to: "local" | "smb" | "sftp" | "ftp";
    totalFiles: number;
    totalSize: number;
    paths: Array<{ path: string; fileCount: number; totalSize: number }>;
  };
};

export type StorageMigrationCleanupResponse = {
  success: boolean;
  message?: string;
  data?: { deleted: number };
};

export type StorageMigrationConflictPolicy = "skip" | "overwrite" | "fail";
