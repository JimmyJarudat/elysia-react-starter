declare module "smb2" {
  type Callback<T = void> = (error: Error | null, result: T) => void;

  type Smb2Options = {
    share: string;
    domain: string;
    username: string;
    password: string;
    port?: number;
    packetConcurrency?: number;
    autoCloseTimeout?: number;
  };

  type Smb2DirEntry = { name: string; size: bigint; isDirectory: boolean };

  class SMB2 {
    constructor(options: Smb2Options);
    readdir(path: string, callback: Callback<Smb2DirEntry[]>): void;
    readFile(path: string, callback: Callback<Buffer>): void;
    writeFile(path: string, data: Buffer | string, callback: Callback): void;
    mkdir(path: string, callback: Callback): void;
    exists(path: string, callback: Callback<boolean>): void;
    unlink(path: string, callback: Callback): void;
    close(): void;
  }

  export = SMB2;
}
