import { mkdir, unlink } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

type PublicFileInput = {
  directory: string;
  fileName: string;
  data: Blob | ArrayBuffer | Uint8Array | string;
};

const uploadsRoot = () => resolve(process.cwd(), "uploads");

const normalizeRelativePath = (value: string) =>
  value
    .replace(/^\/uploads\/?/, "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");

const assertSafeUploadPath = (relativePath: string) => {
  const root = uploadsRoot();
  const targetPath = resolve(root, relativePath);
  const resolvedRelative = relative(root, targetPath);

  if (resolvedRelative.startsWith("..") || isAbsolute(resolvedRelative)) {
    throw new Error("Invalid upload path");
  }

  return { root, targetPath, relativePath: resolvedRelative.replace(/\\/g, "/") };
};

class LocalStorageAdapter {
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
}

const localStorageAdapter = new LocalStorageAdapter();

export const getDefaultStorage = () => localStorageAdapter;
