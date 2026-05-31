// src/utils/console-logger.ts
import { logStreamer } from '@/services/admin-console/log-streamer.service';
import { fileLogger, fileErrorLogger } from '@/utils/file-logger';

// เก็บ original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

// ตรวจสอบ environment
const isProd = process.env.NODE_ENV === 'production';

// -----------------------------
// Helpers: stringify กันพัง
// -----------------------------
function safeToString(arg: any) {
  if (typeof arg === 'string') return arg;

  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
  }

  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg);
    } catch {
      return '[Unserializable Object]';
    }
  }

  return String(arg);
}

function buildMessage(args: any[]) {
  return args.map(safeToString).join(' ');
}

// -----------------------------
// Override console methods
// -----------------------------
console.log = (...args: any[]) => {
  // แสดงใน command line (development เท่านั้น)
  if (!isProd) {
    originalConsole.log(...args);
  }

  const message = buildMessage(args);

  // ✅ เขียนไฟล์รายวัน (app-05-02-2026.log)
  fileLogger.info({ source: 'console.log', args }, message);

  // ✅ ส่งไป log streamer (ทุก environment)
  logStreamer.log('system', 'info', message, {
    source: 'console.log',
    args,
    timestamp: new Date().toISOString()
  });
};

console.info = (...args: any[]) => {
  if (!isProd) {
    originalConsole.info(...args);
  }

  const message = buildMessage(args);

  fileLogger.info({ source: 'console.info', args }, message);

  logStreamer.log('system', 'info', message, {
    source: 'console.info',
    args,
    timestamp: new Date().toISOString()
  });
};

console.warn = (...args: any[]) => {
  if (!isProd) {
    originalConsole.warn(...args);
  }

  const message = buildMessage(args);

  fileLogger.warn({ source: 'console.warn', args }, message);

  logStreamer.log('system', 'warn', message, {
    source: 'console.warn',
    args,
    timestamp: new Date().toISOString()
  });
};

console.error = (...args: any[]) => {
  // เก็บ error ไว้ทุก environment
  originalConsole.error(...args);

  const message = buildMessage(args);

  // ✅ แยกไฟล์ error รายวัน (error-05-02-2026.log)
  fileErrorLogger.error({ source: 'console.error', args }, message);

  logStreamer.log('system', 'error', message, {
    source: 'console.error',
    args,
    timestamp: new Date().toISOString()
  });
};

console.debug = (...args: any[]) => {
  if (!isProd) {
    originalConsole.debug(...args);
  }

  const message = buildMessage(args);

  fileLogger.debug({ source: 'console.debug', args }, message);

  logStreamer.log('system', 'debug', message, {
    source: 'console.debug',
    args,
    timestamp: new Date().toISOString()
  });
};

// Export original methods
export { originalConsole };

// Init function
export const setupConsoleLogging = () => {
  const msg = `Console logging initialized (${isProd ? 'Production' : 'Development'} mode)`;

  // ✅ ลงไฟล์ด้วย
  fileLogger.info({ source: 'console-logger' }, msg);

  // ✅ ส่ง websocket ด้วย
  logStreamer.log('system', 'info', msg, {
    source: 'console-logger',
    timestamp: new Date().toISOString()
  });

  // แจ้งสถานะ (ใช้ originalConsole เพื่อให้แสดงเสมอ)
  if (isProd) {
    originalConsole.info('🔇 Production mode: Console output disabled');
  } else {
    originalConsole.info('🔊 Development mode: Console output enabled');
  }
};
