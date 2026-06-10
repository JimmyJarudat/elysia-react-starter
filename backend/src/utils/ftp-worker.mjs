import { constants as cryptoConstants } from "node:crypto";
import { createInterface } from "node:readline";
import { Readable, Writable } from "node:stream";
import { Client } from "basic-ftp";

const client = new Client(8000);

const send = (message) => {
  process.stdout.write(`${JSON.stringify(message)}\n`);
};

const handle = async (op, args) => {
  switch (op) {
    case "connect": {
      const { host, port, username, password, secure, encryptDataChannel } = args;

      await client.access({
        host,
        port,
        user: username,
        password,
        secure,
        secureOptions: secure
          ? {
              rejectUnauthorized: false,
              minVersion: "TLSv1.2",
              maxVersion: "TLSv1.2",
              // Disable TLS session tickets so the data connection resumes via the
              // session ID negotiated on the control connection. Servers like vsftpd
              // (require_ssl_reuse=YES) or FileZilla Server 1.x reject ticket-based
              // resumption with "425 ... TLS session of data connection not resumed."
              secureOptions: cryptoConstants.SSL_OP_NO_TICKET,
            }
          : undefined,
      });

      if (secure && !encryptDataChannel) {
        await client.sendIgnoringError("PROT C");
      }
      return null;
    }

    case "ensureDir":
      await client.ensureDir(args.path);
      return null;

    case "upload": {
      const data = Buffer.from(args.data, "base64");
      await client.uploadFrom(Readable.from(data), args.fileName);
      return null;
    }

    case "download": {
      const chunks = [];
      const destination = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          callback();
        },
      });

      try {
        await client.downloadTo(destination, args.path);
      } catch {
        return { found: false };
      }
      return { found: true, data: Buffer.concat(chunks).toString("base64") };
    }

    case "remove":
      await client.remove(args.path, args.force);
      return null;

    case "removeEmptyDir":
      await client.removeEmptyDir(args.path);
      return null;

    case "size":
      return client.size(args.path);

    case "list": {
      const entries = await client.list(args.path || ".");
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory,
        isFile: entry.isFile,
        size: entry.size,
      }));
    }

    case "close":
      client.close();
      return null;

    default:
      throw new Error(`Unknown FTP worker operation: ${op}`);
  }
};

// Process one message at a time so commands on the persistent FTP control
// connection (e.g. ensureDir's CWD followed by upload) stay in order.
let chain = Promise.resolve();

createInterface({ input: process.stdin }).on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  chain = chain
    .then(() => handle(message.op, message.args))
    .then(
      (result) => send({ id: message.id, ok: true, result }),
      (error) => send({ id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
});

process.stdin.on("end", () => {
  process.exit(0);
});
