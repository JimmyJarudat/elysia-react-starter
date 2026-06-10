import { mkdir, readdir, rmdir, stat, unlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import SMB2 from "smb2";
import SftpClient from "ssh2-sftp-client";
import {
  getSecretSettingValue,
  getSettingValue,
} from "@/utils/get-setting-value";

type PublicFileInput = {
  directory: string;
  fileName: string;
  data: Blob | ArrayBuffer | Uint8Array | string;
};

type StorageProvider = "local" | "smb" | "sftp";

export type StorageSettings = {
  provider: StorageProvider;
  smb: {
    host: string;
    shareName: string;
    domain: string;
    username: string;
    password: string;
    basePath: string;
  };
  sftp: {
    host: string;
    port: number;
    username: string;
    password: string;
    basePath: string;
  };
};

export type SmbStorageSettings = StorageSettings["smb"];
export type SftpStorageSettings = StorageSettings["sftp"];

type PublicFile = Blob;

export type StorageFileEntry = { path: string; size: number };

export interface StorageAdapter {
  writePublicFile(input: PublicFileInput): Promise<string>;
  replacePublicFile(input: PublicFileInput & { oldPublicUrl?: string; allowedPrefix?: string }): Promise<string>;
  deletePublicFile(publicUrl: string, allowedPrefix?: string): Promise<boolean>;
  publicFileExists(relativeOrPublicPath: string): Promise<boolean>;
  getPublicFile(relativeOrPublicPath: string): Promise<PublicFile | null>;
  listFiles(): Promise<StorageFileEntry[]>;
  close(): Promise<void>;
}

export type SmbStorageTestDetails = {
  phase: string;
  share: string;
  domain: string;
  username: string;
  basePath: string;
  targetPath: string;
};

export class SmbStorageTestError extends Error {
  details: SmbStorageTestDetails;

  constructor(message: string, details: SmbStorageTestDetails) {
    super(message);
    this.name = "SmbStorageTestError";
    this.details = details;
  }
}

class SmbStorageOperationError extends Error {
  phase: string;
  targetPath: string;

  constructor(phase: string, targetPath: string, error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown SMB error";
    super(message);
    this.name = "SmbStorageOperationError";
    this.phase = phase;
    this.targetPath = targetPath;
  }
}

const uploadsRoot = () => resolve(process.cwd(), "uploads");

const normalizeRelativePath = (value: string) =>
  value
    .replace(/^\/uploads\/?/, "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");

const toSmbPathPart = (value: string) =>
  normalizeRelativePath(value)
    .split("/")
    .filter(Boolean)
    .join("\\");

const toSmbBasePathPart = (value: string) => {
  const parts = value
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

  if (parts.some((part) => part === "." || part === "..")) {
    throw new Error("Invalid SMB base path");
  }

  return parts.join("\\");
};

const toRemotePathPart = (value: string) => {
  const parts = value
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

  if (parts.some((part) => part === "." || part === "..")) {
    throw new Error("Invalid remote storage path");
  }

  return parts.join("/");
};

const assertSafeUploadPath = (relativePath: string) => {
  const root = uploadsRoot();
  const targetPath = resolve(root, relativePath);
  const resolvedRelative = relative(root, targetPath);

  if (resolvedRelative.startsWith("..") || isAbsolute(resolvedRelative)) {
    throw new Error("Invalid upload path");
  }

  return { root, targetPath, relativePath: resolvedRelative.replace(/\\/g, "/") };
};

const isNotFoundError = (error: unknown) =>
  error && typeof error === "object" && "code" in error && error.code === "ENOENT";

const SMB_OPERATION_TIMEOUT_MS = 8000;

const blobToBuffer = async (data: PublicFileInput["data"]) => {
  if (typeof data === "string") return Buffer.from(data);
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(await data.arrayBuffer());
};

export const readStorageSettings = async (): Promise<StorageSettings> => {
  const provider = String(await getSettingValue("storage_provider", "local")).trim().toLowerCase();
  const resolvedProvider: StorageProvider = provider === "smb" || provider === "sftp" ? provider : "local";
  const sftpPort = Number.parseInt(String(await getSettingValue("storage_sftp_port", "22")), 10);

  return {
    provider: resolvedProvider,
    smb: {
      host: String(await getSettingValue("storage_smb_host", "")).trim(),
      shareName: String(await getSettingValue("storage_smb_share_name", "")).trim(),
      domain: String(await getSettingValue("storage_smb_domain", "")).trim(),
      username: String(await getSettingValue("storage_smb_username", "")).trim(),
      password: await getSecretSettingValue("storage_smb_password"),
      basePath: String(await getSettingValue("storage_smb_base_path", "")).trim(),
    },
    sftp: {
      host: String(await getSettingValue("storage_sftp_host", "")).trim(),
      port: Number.isInteger(sftpPort) && sftpPort > 0 ? sftpPort : 22,
      username: String(await getSettingValue("storage_sftp_username", "")).trim(),
      password: await getSecretSettingValue("storage_sftp_password"),
      basePath: String(await getSettingValue("storage_sftp_base_path", "")).trim(),
    },
  };
};

export const isSmbConfigured = (settings: StorageSettings) =>
  Boolean(settings.smb.host && settings.smb.shareName && settings.smb.username && settings.smb.password);

export const isSftpConfigured = (settings: StorageSettings) =>
  Boolean(settings.sftp.host && settings.sftp.port && settings.sftp.username && settings.sftp.password);

class LocalStorageAdapter implements StorageAdapter {
  async writePublicFile(input: PublicFileInput) {
    const relativePath = normalizeRelativePath(`${input.directory}/${input.fileName}`);
    const { root, targetPath } = assertSafeUploadPath(relativePath);
    const targetDir = resolve(root, normalizeRelativePath(input.directory));

    await mkdir(targetDir, { recursive: true });
    await Bun.write(targetPath, input.data);

    return `/uploads/${relativePath}`;
  }

  async replacePublicFile(input: PublicFileInput & { oldPublicUrl?: string; allowedPrefix?: string }) {
    const newUrl = await this.writePublicFile(input);

    if (input.oldPublicUrl && input.oldPublicUrl !== newUrl) {
      await this.deletePublicFile(input.oldPublicUrl, input.allowedPrefix);
    }

    return newUrl;
  }

  async deletePublicFile(publicUrl: string, allowedPrefix?: string) {
    if (!publicUrl.startsWith("/uploads/")) {
      return false;
    }

    const relativePath = normalizeRelativePath(publicUrl);
    const normalizedAllowedPrefix = allowedPrefix
      ? normalizeRelativePath(allowedPrefix).replace(/\/?$/, "/")
      : "";

    if (normalizedAllowedPrefix && !relativePath.startsWith(normalizedAllowedPrefix)) {
      return false;
    }

    const { targetPath } = assertSafeUploadPath(relativePath);

    try {
      await unlink(targetPath);
      await this.pruneEmptyDirectories(dirname(relativePath));
      return true;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  private async pruneEmptyDirectories(relativeDir: string) {
    let current = normalizeRelativePath(relativeDir);

    while (current && current !== ".") {
      const { targetPath } = assertSafeUploadPath(current);

      try {
        await rmdir(targetPath);
      } catch {
        return;
      }

      current = normalizeRelativePath(dirname(current));
      if (current === ".") return;
    }
  }

  async publicFileExists(relativeOrPublicPath: string) {
    const relativePath = normalizeRelativePath(relativeOrPublicPath);
    const { targetPath } = assertSafeUploadPath(relativePath);

    return Bun.file(targetPath).exists();
  }

  async getPublicFile(relativeOrPublicPath: string) {
    const relativePath = normalizeRelativePath(relativeOrPublicPath);
    const { targetPath } = assertSafeUploadPath(relativePath);
    const file = Bun.file(targetPath);

    return await file.exists() ? file : null;
  }

  async listFiles(): Promise<StorageFileEntry[]> {
    const root = uploadsRoot();
    const results: StorageFileEntry[] = [];

    const walk = async (dir: string, prefix: string) => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (error) {
        if (isNotFoundError(error)) return;
        throw error;
      }

      for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await walk(fullPath, relativePath);
        } else if (entry.isFile()) {
          const stats = await stat(fullPath);
          results.push({ path: relativePath, size: stats.size });
        }
      }
    };

    await walk(root, "");
    return results;
  }

  async close() {
    /* nothing to close for local storage */
  }
}

type SmbDirEntry = { name: string; size: bigint; isDirectory: boolean };

class SmbStorageAdapter implements StorageAdapter {
  private readonly client: SMB2;
  private readonly basePath: string;
  private readonly settings: StorageSettings["smb"];

  constructor(settings: StorageSettings["smb"]) {
    this.settings = settings;
    this.basePath = toSmbBasePathPart(settings.basePath);
    const domain = settings.domain || settings.host;
    this.client = new SMB2({
      share: `\\\\${settings.host}\\${settings.shareName}`,
      domain,
      username: settings.username,
      password: settings.password,
      autoCloseTimeout: 5000,
    });
  }

  private getPath(relativeOrPublicPath: string) {
    const relativePath = normalizeRelativePath(relativeOrPublicPath);
    const safeRelative = assertSafeUploadPath(relativePath).relativePath;
    const smbRelative = toSmbPathPart(safeRelative);

    return [this.basePath, smbRelative].filter(Boolean).join("\\");
  }

  getTestDetails(phase: string, targetPath: string): SmbStorageTestDetails {
    return {
      phase,
      share: `\\\\${this.settings.host}\\${this.settings.shareName}`,
      domain: this.settings.domain || this.settings.host,
      username: this.settings.username,
      basePath: this.basePath,
      targetPath,
    };
  }

  getTestPath(fileName: string) {
    return this.getPath(`_storage-test/${fileName}`);
  }

  private async call<T>(method: (callback: (error: Error | null, result: T) => void) => void) {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.close();
        reject(new Error(`SMB operation timed out after ${SMB_OPERATION_TIMEOUT_MS}ms`));
      }, SMB_OPERATION_TIMEOUT_MS);

      try {
        method((error, result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          error ? reject(error) : resolve(result);
        });
      } catch (error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  private async directoryExists(path: string) {
    try {
      await this.call<SmbDirEntry[]>((callback) => this.client.readdir(path, callback));
      return true;
    } catch {
      return false;
    }
  }

  private async mkdir(path: string, phase = "mkdir") {
    if (!path) return;

    try {
      const exists = await this.directoryExists(path);
      if (exists) return;
      await this.call<void>((callback) => this.client.mkdir(path, callback));
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw new SmbStorageOperationError(phase, path, error);
      }
      try {
        await this.call<void>((callback) => this.client.mkdir(path, callback));
      } catch (mkdirError) {
        throw new SmbStorageOperationError(phase, path, mkdirError);
      }
    }
  }

  private async ensureDirectory(path: string) {
    const parts = path.split("\\").filter(Boolean);
    let current = "";

    for (const part of parts) {
      current = current ? `${current}\\${part}` : part;
      await this.mkdir(current, `mkdir:${current}`);
    }
  }

  async writePublicFile(input: PublicFileInput) {
    const relativePath = normalizeRelativePath(`${input.directory}/${input.fileName}`);
    const fullPath = this.getPath(relativePath);
    const directory = fullPath.split("\\").slice(0, -1).join("\\");
    const data = await blobToBuffer(input.data);

    await this.ensureDirectory(directory);
    try {
      await this.call<void>((callback) => this.client.writeFile(fullPath, data, callback));
    } catch (error) {
      throw new SmbStorageOperationError("write-file", fullPath, error);
    }

    return `/uploads/${relativePath}`;
  }

  async replacePublicFile(input: PublicFileInput & { oldPublicUrl?: string; allowedPrefix?: string }) {
    const newUrl = await this.writePublicFile(input);

    if (input.oldPublicUrl && input.oldPublicUrl !== newUrl) {
      await this.deletePublicFile(input.oldPublicUrl, input.allowedPrefix);
    }

    return newUrl;
  }

  async deletePublicFile(publicUrl: string, allowedPrefix?: string) {
    if (!publicUrl.startsWith("/uploads/")) {
      return false;
    }

    const relativePath = normalizeRelativePath(publicUrl);
    const normalizedAllowedPrefix = allowedPrefix
      ? normalizeRelativePath(allowedPrefix).replace(/\/?$/, "/")
      : "";

    if (normalizedAllowedPrefix && !relativePath.startsWith(normalizedAllowedPrefix)) {
      return false;
    }

    try {
      await this.call<void>((callback) => this.client.unlink(this.getPath(relativePath), callback));
      await this.pruneEmptyDirectories(dirname(this.getPath(relativePath)));
      return true;
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  private async pruneEmptyDirectories(path: string) {
    let current = path;

    while (current && current !== this.basePath) {
      try {
        await this.call<void>((callback) => this.client.rmdir(current, callback));
      } catch {
        return;
      }

      const index = current.lastIndexOf("\\");
      current = index === -1 ? "" : current.slice(0, index);
    }
  }

  async publicFileExists(relativeOrPublicPath: string) {
    try {
      return await this.call<boolean>((callback) => this.client.exists(this.getPath(relativeOrPublicPath), callback));
    } catch {
      return false;
    }
  }

  async getPublicFile(relativeOrPublicPath: string): Promise<PublicFile | null> {
    try {
      const data = await this.call<Buffer>((callback) => this.client.readFile(this.getPath(relativeOrPublicPath), callback));
      const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      const type = Bun.file(relativeOrPublicPath).type;
      return new Blob([bytes], { type });
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  async listFiles(): Promise<StorageFileEntry[]> {
    const results: StorageFileEntry[] = [];

    const walk = async (smbPath: string, prefix: string) => {
      let entries: SmbDirEntry[];
      try {
        entries = await this.call<SmbDirEntry[]>((callback) => this.client.readdir(smbPath, callback));
      } catch (error) {
        if (isNotFoundError(error)) return;
        throw new SmbStorageOperationError("list", smbPath, error);
      }

      for (const entry of entries) {
        const childPath = smbPath ? `${smbPath}\\${entry.name}` : entry.name;
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory) {
          await walk(childPath, relativePath);
        } else {
          results.push({ path: relativePath, size: Number(entry.size) });
        }
      }
    };

    await walk(this.basePath, "");
    return results;
  }

  async close() {
    try {
      this.client.close();
    } catch {
      /* ignore close errors */
    }
  }
}

class SftpStorageAdapter implements StorageAdapter {
  private readonly client = new SftpClient("storage-sftp");
  private readonly basePath: string;
  private readonly settings: StorageSettings["sftp"];
  private connected = false;

  constructor(settings: StorageSettings["sftp"]) {
    this.settings = settings;
    this.basePath = toRemotePathPart(settings.basePath);
  }

  private async connect() {
    if (this.connected) return;

    await this.client.connect({
      host: this.settings.host,
      port: this.settings.port,
      username: this.settings.username,
      password: this.settings.password,
      readyTimeout: 8000,
    });
    this.connected = true;
  }

  private getPath(relativeOrPublicPath: string) {
    const relativePath = normalizeRelativePath(relativeOrPublicPath);
    const safeRelative = assertSafeUploadPath(relativePath).relativePath;
    const remoteRelative = toRemotePathPart(safeRelative);

    return [this.basePath, remoteRelative].filter(Boolean).join("/");
  }

  getTestPath(fileName: string) {
    return this.getPath(`_storage-test/${fileName}`);
  }

  private async ensureDirectory(path: string) {
    if (!path) return;

    await this.connect();
    await this.client.mkdir(path, true);
  }

  async writePublicFile(input: PublicFileInput) {
    const relativePath = normalizeRelativePath(`${input.directory}/${input.fileName}`);
    const fullPath = this.getPath(relativePath);
    const directory = fullPath.split("/").slice(0, -1).join("/");
    const data = await blobToBuffer(input.data);

    await this.ensureDirectory(directory);
    await this.client.put(data, fullPath);

    return `/uploads/${relativePath}`;
  }

  async replacePublicFile(input: PublicFileInput & { oldPublicUrl?: string; allowedPrefix?: string }) {
    const newUrl = await this.writePublicFile(input);

    if (input.oldPublicUrl && input.oldPublicUrl !== newUrl) {
      await this.deletePublicFile(input.oldPublicUrl, input.allowedPrefix);
    }

    return newUrl;
  }

  async deletePublicFile(publicUrl: string, allowedPrefix?: string) {
    if (!publicUrl.startsWith("/uploads/")) {
      return false;
    }

    const relativePath = normalizeRelativePath(publicUrl);
    const normalizedAllowedPrefix = allowedPrefix
      ? normalizeRelativePath(allowedPrefix).replace(/\/?$/, "/")
      : "";

    if (normalizedAllowedPrefix && !relativePath.startsWith(normalizedAllowedPrefix)) {
      return false;
    }

    await this.connect();

    try {
      const fullPath = this.getPath(relativePath);
      await this.client.delete(fullPath);
      await this.pruneEmptyDirectories(dirname(fullPath).replace(/\\/g, "/"));
      return true;
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  private async pruneEmptyDirectories(path: string) {
    let current = path;

    while (current && current !== this.basePath) {
      try {
        await this.client.rmdir(current, false);
      } catch {
        return;
      }

      const index = current.lastIndexOf("/");
      current = index === -1 ? "" : current.slice(0, index);
    }
  }

  async publicFileExists(relativeOrPublicPath: string) {
    await this.connect();
    return Boolean(await this.client.exists(this.getPath(relativeOrPublicPath)));
  }

  async getPublicFile(relativeOrPublicPath: string): Promise<PublicFile | null> {
    await this.connect();

    try {
      const data = await this.client.get(this.getPath(relativeOrPublicPath));
      if (!Buffer.isBuffer(data)) {
        throw new Error("SFTP file read returned an unsupported stream result");
      }
      const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      const type = Bun.file(relativeOrPublicPath).type;
      return new Blob([bytes], { type });
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  async listFiles(): Promise<StorageFileEntry[]> {
    await this.connect();
    const results: StorageFileEntry[] = [];

    const walk = async (remotePath: string, prefix: string) => {
      let entries;
      try {
        entries = await this.client.list(remotePath || ".");
      } catch (error) {
        if (isNotFoundError(error)) return;
        throw error;
      }

      for (const entry of entries) {
        const childPath = remotePath ? `${remotePath}/${entry.name}` : entry.name;
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.type === "d") {
          await walk(childPath, relativePath);
        } else if (entry.type === "-") {
          results.push({ path: relativePath, size: entry.size });
        }
      }
    };

    await walk(this.basePath, "");
    return results;
  }

  async close() {
    if (!this.connected) return;

    try {
      await this.client.end();
    } catch {
      /* ignore close errors */
    } finally {
      this.connected = false;
    }
  }
}

export const testSmbStorageConnection = async (settings: SmbStorageSettings) => {
  const adapter = new SmbStorageAdapter(settings);
  const fileName = `storage-test-${Date.now()}-${crypto.randomUUID()}.txt`;
  const testContent = `storage-test:${fileName}`;
  const targetPath = adapter.getTestPath(fileName);
  let url = "";
  let phase = "write";

  try {
    url = await adapter.writePublicFile({
      directory: "_storage-test",
      fileName,
      data: testContent,
    });
    phase = "read";
    const file = await adapter.getPublicFile(url);
    const text = file ? await file.text() : "";

    if (text !== testContent) {
      throw new Error("SMB test file read did not match written content");
    }

    phase = "delete";
    await adapter.deletePublicFile(url, "_storage-test");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMB error";
    const operationPhase = error instanceof SmbStorageOperationError ? error.phase : phase;
    const operationPath = error instanceof SmbStorageOperationError ? error.targetPath : targetPath;
    throw new SmbStorageTestError(`SMB test failed during ${operationPhase}: ${message}`, adapter.getTestDetails(operationPhase, operationPath));
  } finally {
    await adapter.close();
  }
};

export const testSftpStorageConnection = async (settings: SftpStorageSettings) => {
  const adapter = new SftpStorageAdapter(settings);
  const fileName = `storage-test-${Date.now()}-${crypto.randomUUID()}.txt`;
  const testContent = `storage-test:${fileName}`;
  let url = "";
  let phase = "write";

  try {
    url = await adapter.writePublicFile({
      directory: "_storage-test",
      fileName,
      data: testContent,
    });
    phase = "read";
    const file = await adapter.getPublicFile(url);
    const text = file ? await file.text() : "";

    if (text !== testContent) {
      throw new Error("SFTP test file read did not match written content");
    }

    phase = "delete";
    await adapter.deletePublicFile(url, "_storage-test");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SFTP error";
    throw new Error(`SFTP test failed during ${phase}: ${message}`);
  } finally {
    await adapter.close();
  }
};

class StorageManager {
  async getAdapter(): Promise<StorageAdapter> {
    return buildStorageAdapter(await readStorageSettings());
  }

  async writePublicFile(input: PublicFileInput) {
    return (await this.getAdapter()).writePublicFile(input);
  }

  async replacePublicFile(input: PublicFileInput & { oldPublicUrl?: string; allowedPrefix?: string }) {
    return (await this.getAdapter()).replacePublicFile(input);
  }

  async deletePublicFile(publicUrl: string, allowedPrefix?: string) {
    return (await this.getAdapter()).deletePublicFile(publicUrl, allowedPrefix);
  }

  async publicFileExists(relativeOrPublicPath: string) {
    return (await this.getAdapter()).publicFileExists(relativeOrPublicPath);
  }

  async getPublicFile(relativeOrPublicPath: string) {
    return (await this.getAdapter()).getPublicFile(relativeOrPublicPath);
  }
}

const localStorageAdapter = new LocalStorageAdapter();
const storageManager = new StorageManager();

export const getDefaultStorage = () => storageManager;

export const buildStorageAdapter = (settings: StorageSettings): StorageAdapter => {
  if (settings.provider === "smb" && isSmbConfigured(settings)) {
    return new SmbStorageAdapter(settings.smb);
  }
  if (settings.provider === "sftp" && isSftpConfigured(settings)) {
    return new SftpStorageAdapter(settings.sftp);
  }

  return localStorageAdapter;
};

export type StorageMigrationSnapshot = {
  source: StorageSettings;
  target: StorageSettings;
  createdAt: number;
  inProgress: boolean;
  completed: boolean;
  migratedPaths?: string[];
  skipped?: number;
};

let migrationSnapshot: StorageMigrationSnapshot | null = null;

export const getMigrationSnapshot = () => migrationSnapshot;

export const setMigrationSnapshot = (snapshot: StorageMigrationSnapshot | null) => {
  migrationSnapshot = snapshot;
};
