declare module "smb2" {
  export default class SMB2 {
    constructor(options: Record<string, unknown>);

    readdir<T = unknown[]>(path: string, callback: (error: Error | null, files: T) => void): void;
    readFile(path: string, callback: (error: Error | null, data: Buffer) => void): void;
    writeFile(path: string, data: Buffer | string, callback: (error: Error | null) => void): void;
    mkdir(path: string, callback: (error: Error | null) => void): void;
    unlink(path: string, callback: (error: Error | null) => void): void;
    rmdir(path: string, callback: (error: Error | null) => void): void;
    exists(path: string, callback: (error: Error | null, exists: boolean) => void): void;
    close(): void;
  }
}

declare module "ssh2-sftp-client" {
  export type SftpFileEntry = {
    name: string;
    type: "d" | "-" | string;
    size: number;
  };

  export default class SftpClient {
    constructor(name?: string);

    connect(options: Record<string, unknown>): Promise<void>;
    list(path: string): Promise<SftpFileEntry[]>;
    get(path: string): Promise<Buffer>;
    mkdir(path: string, recursive?: boolean): Promise<void>;
    put(input: Buffer | string, remotePath: string): Promise<void>;
    delete(path: string): Promise<void>;
    rmdir(path: string, recursive?: boolean): Promise<void>;
    exists(path: string): Promise<boolean | "-" | "d" | "l">;
    end(): Promise<void>;
  }
}
