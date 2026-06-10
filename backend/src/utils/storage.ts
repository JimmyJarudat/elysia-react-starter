import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import SMB2 from "smb2";
import {
  getSecretSettingValue,
  getSettingValue,
} from "@/utils/get-setting-value";

type PublicFileInput = {
  directory: string;
  fileName: string;
  data: Blob | ArrayBuffer | Uint8Array | string;
};

type StorageProvider = "local" | "smb";

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
};

export type SmbStorageSettings = StorageSettings["smb"];

type PublicFile = Blob;

export type StorageFileEntry = { path: string; size: number };

export interface StorageAdapter {
  writePublicFile(input: PublicFileInput): Promise<string>;
  deletePublicFile(publicUrl: string, allowedPrefix?: string): Promise<boolean>;
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
  const resolvedProvider: StorageProvider = provider === "smb" ? "smb" : "local";

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
  };
};

export const isSmbConfigured = (settings: StorageSettings) =>
  Boolean(settings.smb.host && settings.smb.shareName && settings.smb.username && settings.smb.password);

class LocalStorageAdapter implements StorageAdapter {
  async writePublicFile(input: PublicFileInput) {
    const relativePath = normalizeRelativePath(`${input.directory}/${input.fileName}`);
    const { root, targetPath } = assertSafeUploadPath(relativePath);
    const targetDir = resolve(root, normalizeRelativePath(input.directory));

    await mkdir(targetDir, { recursive: true });
    await Bun.write(targetPath, input.data);

    return `/uploads/${relativePath}`;
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
      return true;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return false;
      }
      throw error;
    }
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
      return true;
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  async getPublicFile(relativeOrPublicPath: string): Promise<PublicFile | null> {
    try {
      const data = await this.call<Buffer>((callback) => this.client.readFile(this.getPath(relativeOrPublicPath), callback));
      const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      return new Blob([bytes]);
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

class StorageManager {
  async getAdapter(): Promise<StorageAdapter> {
    return buildStorageAdapter(await readStorageSettings());
  }

  async writePublicFile(input: PublicFileInput) {
    return (await this.getAdapter()).writePublicFile(input);
  }

  async deletePublicFile(publicUrl: string, allowedPrefix?: string) {
    return (await this.getAdapter()).deletePublicFile(publicUrl, allowedPrefix);
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

  return localStorageAdapter;
};

export type StorageMigrationSnapshot = {
  source: StorageSettings;
  target: StorageSettings;
  createdAt: number;
  inProgress: boolean;
  completed: boolean;
};

let migrationSnapshot: StorageMigrationSnapshot | null = null;

export const getMigrationSnapshot = () => migrationSnapshot;

export const setMigrationSnapshot = (snapshot: StorageMigrationSnapshot | null) => {
  migrationSnapshot = snapshot;
};
