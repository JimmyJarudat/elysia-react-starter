declare module "ssh2-sftp-client" {
  type ConnectOptions = {
    host: string;
    port?: number;
    username: string;
    password?: string;
    readyTimeout?: number;
  };

  type FileInfo = {
    type: "-" | "d" | "l";
    name: string;
    size: number;
  };

  class SftpClient {
    constructor(name?: string);
    connect(options: ConnectOptions): Promise<void>;
    exists(remotePath: string): Promise<false | "-" | "d" | "l">;
    list(remotePath: string): Promise<FileInfo[]>;
    mkdir(remotePath: string, recursive?: boolean): Promise<string>;
    rmdir(remotePath: string, recursive?: boolean): Promise<string>;
    put(input: Buffer | NodeJS.ReadableStream | string, remotePath: string): Promise<string>;
    get(remotePath: string): Promise<Buffer | NodeJS.WritableStream | string>;
    delete(remotePath: string): Promise<string>;
    end(): Promise<void>;
  }

  export = SftpClient;
}
