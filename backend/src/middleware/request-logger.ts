// middleware/request-logger.ts
import { Elysia } from 'elysia';
import { getCurrentUserFromHeaders } from '../utils/get-current-user';
import { getClientInfo } from '../utils/clientInfo';
import prisma from '@/config/prisma.config';


export interface RequestLogData {
    timestamp: Date;
    method: string;
    url: string;
    path: string;
    query_params: string | null;
    user_id: number | null;
    username: string | null;
    ip_address: string;
    user_agent: string | null;
    browser: string;
    os: string;
    device_type: string;
    platform: string;
    status_code: number;
    response_time: number;
    request_size: number | null;
    response_size: number | null;
    error_message: string | null;
    error_stack: string | null;
    referer: string | null;
    session_id: string | null;
}

// Configuration สำหรับ paths ที่ไม่ต้องการบันทึก log
const EXCLUDED_PATHS = [
    '/api/system/sidebar-menu',
    '/api/system/notification/unread-count',
    '/system/user/permissions',
    '/api/system/appearance',
    '/api/admin/test-middleware',
    '/api/admin/ping',
    '/ping',
    '/favicon.ico',
    '/robots.txt'
];

// Configuration สำหรับ methods ที่ไม่ต้องการบันทึก log
const EXCLUDED_METHODS = [
    'OPTIONS'  // ไม่ log CORS pre-flight requests
];

// ฟังก์ชันตรวจสอบว่า path ควรถูกยกเว้นหรือไม่
function shouldExcludePath(path: string): boolean {
    return EXCLUDED_PATHS.some(excludedPath => {
        return path === excludedPath || path.startsWith(excludedPath + '/');
    });
}

// ฟังก์ชันตรวจสอบว่า method ควรถูกยกเว้นหรือไม่
function shouldExcludeMethod(method: string): boolean {
    return EXCLUDED_METHODS.includes(method.toUpperCase());
}

// Background queue สำหรับบันทึก logs
const logQueue: RequestLogData[] = [];
let isProcessingQueue = false;

// ฟังก์ชันประมวลผล queue แบบ background  
async function processLogQueue() {
    if (isProcessingQueue || logQueue.length === 0) return;

    isProcessingQueue = true;

    try {
        const batchSize = 50;
        while (logQueue.length > 0) {
            const batch = logQueue.splice(0, batchSize);

            try {
                await prisma.request_logs.createMany({
                    data: batch
                });

                //console.log(`📝 Saved ${batch.length} request logs to database`);
            } catch (dbError) {

                // silent fail - request log save error, non-critical

                // console.error('📝 Error SAVE - Would save', batch.length, 'logs:');
                // batch.forEach((log, index) => {
                //     console.error(`${index + 1}. ${log.method} ${log.path} - ${log.status_code} (${log.response_time}ms) - ${log.username || 'Anonymous'}`);
                // });
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } catch (error) {
        console.error('Error processing log queue:', error);
    } finally {
        isProcessingQueue = false;
    }
}

// Auto-process queue ทุก 5 วินาที
setInterval(processLogQueue, 5000);

// Helper functions
function getHeaderSafe(request: any, headerName: string): string | null {
    try {
        if (!request || !request.headers) return null;

        if (typeof request.headers.get === 'function') {
            return request.headers.get(headerName);
        } else if (request.headers[headerName]) {
            return request.headers[headerName];
        }

        return null;
    } catch (error) {
        return null;
    }
}

function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Store เพื่อติดตาม requests - ใช้เฉพาะสำหรับ timing
const requestTimings = new Map<string, {
    startTime: number;
    method: string;
    url: string;
    path: string;
    request: any;
}>();

// Helper function สำหรับคำนวณ request size
function calculateRequestSize(request: any): number | null {
    try {
        let size = 0;

        if (request.url) {
            size += Buffer.byteLength(request.url, 'utf8');
        }

        if (request.headers) {
            const headersStr = JSON.stringify(Object.fromEntries(request.headers));
            size += Buffer.byteLength(headersStr, 'utf8');
        }

        return size > 0 ? size : null;
    } catch (error) {
        return null;
    }
}

// Helper function สำหรับคำนวณ response size
function calculateResponseSize(response: any): number | null {
    try {
        if (!response) return null;

        const contentLength = response.headers?.get?.('content-length');
        if (contentLength) {
            return parseInt(contentLength, 10);
        }

        if (typeof response.body === 'string') {
            return Buffer.byteLength(response.body, 'utf8');
        }

        if (Buffer.isBuffer(response.body)) {
            return response.body.length;
        }

        if (response.body && typeof response.body === 'object') {
            const jsonStr = JSON.stringify(response.body);
            return Buffer.byteLength(jsonStr, 'utf8');
        }

        return null;
    } catch (error) {
        return null;
    }
}

// ฟังก์ชันสำหรับสร้าง log data
function createLogData(
    timing: any,
    statusCode: number,
    responseSize: number | null = null,
    errorMessage: string | null = null,
    errorStack: string | null = null
): RequestLogData {
    const responseTime = Date.now() - timing.startTime;
    const url = new URL(timing.url);

    let currentUser = null;
    let clientInfo: ClientInfo = {
        ip_address: '127.0.0.1',
        user_agent: null,
        browser: 'Unknown',
        os: 'Unknown',
        device_type: 'Unknown',
        platform: 'Unknown'
    };

    try {
        currentUser = getCurrentUserFromHeaders(timing.request);
    } catch (error) {
        // ignore user info errors
    }

    try {
        clientInfo = getClientInfo(timing.request);
    } catch (error) {
        // ignore client info errors
    }

    return {
        timestamp: new Date(),
        method: timing.method,
        url: timing.url,
        path: timing.path,
        query_params: url.search || null,
        user_id: currentUser?.id || null,
        username: currentUser?.username || null,
        ip_address: clientInfo.ip_address,
        user_agent: clientInfo.user_agent,
        browser: clientInfo.browser,
        os: clientInfo.os,
        device_type: clientInfo.device_type,
        platform: clientInfo.platform,
        status_code: statusCode,
        response_time: responseTime,
        request_size: calculateRequestSize(timing.request),
        response_size: responseSize,
        error_message: errorMessage,
        error_stack: errorStack,
        referer: getHeaderSafe(timing.request, 'referer'),
        session_id: getHeaderSafe(timing.request, 'x-session-id')
    };
}


// ฟังก์ชันสำหรับบันทึก log
function saveLog(logData: RequestLogData) {


    const httpMessage = `${logData.method} ${logData.path} - ${logData.status_code}`;
    const logLevel = logData.status_code >= 400 ? 'error' : 'info';

    logStreamer.log('http', logLevel, httpMessage, {
        method: logData.method,
        path: logData.path,
        status: logData.status_code,
        duration: logData.response_time,
        user: logData.username || 'Anonymous',
        ip: logData.ip_address,
        userAgent: logData.user_agent,
        browser: logData.browser,
        os: logData.os,
        requestSize: logData.request_size,
        responseSize: logData.response_size,
        errorMessage: logData.error_message,
        timestamp: logData.timestamp
    });

    // เพิ่มเข้า queue สำหรับบันทึกลง database
    logQueue.push(logData);

    // Log แสดงผล
    const statusIcon = logData.status_code >= 400 ? '❌' : '✅';
    const timeStr = new Date().toISOString();
    // console.log(`${statusIcon} [${timeStr}] ${logData.status_code} ${logData.method} ${logData.path} - ${logData.response_time}ms`, {
    //     user: logData.username || 'Anonymous',
    //     ip: logData.ip_address,
    //     reqSize: logData.request_size ? `${logData.request_size}B` : 'unknown',
    //     resSize: logData.response_size ? `${logData.response_size}B` : 'unknown'
    // });

    // Process queue ถ้ามี items เพียงพอ
    if (logQueue.length >= 3) {
        processLogQueue().catch(error => {
            console.warn('Queue processing error:', error);
        });
    }
}

// Global deduplication set
const PROCESSED_REQUESTS = new Set<string>();

// ฟังก์ชันสำหรับสร้าง timing key
function createTimingKey(request: any): string {
    const url = new URL(request.url);
    return `${request.method}_${url.pathname}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// ฟังก์ชันสำหรับสร้าง request fingerprint (ใช้สำหรับ deduplication)
function createRequestFingerprint(request: any): string {
    const url = new URL(request.url);
    const userAgent = getHeaderSafe(request, 'user-agent') || 'unknown';
    const referer = getHeaderSafe(request, 'referer') || 'unknown';

    // สร้าง fingerprint ที่ unique แต่ consistent สำหรับ request เดียวกัน
    const timestamp = Math.floor(Date.now() / 1000); // ความละเอียด 1 วินาที
    return `${request.method}_${url.pathname}_${url.search}_${userAgent.slice(0, 50)}_${referer.slice(0, 30)}_${timestamp}`;
}

// ฟังก์ชันหลักที่คืน Elysia instance พร้อม hooks
export function addRequestLogger(app: Elysia) {
    return app
        .derive(({ request }) => {
            if (!RuntimeFlags.requestLogger) return { timingKey: null };
            // สร้าง timing key และเก็บ start time
            const url = new URL(request.url);

            // ตรวจสอบว่า method ควรถูกยกเว้นหรือไม่ (เช่น OPTIONS)
            if (shouldExcludeMethod(request.method)) {
                // console.log(`⏭️ [SKIP METHOD] Skipping ${request.method} ${url.pathname}`);
                return { timingKey: null }; // ไม่ track
            }

            // ตรวจสอบว่า path ควรถูกยกเว้นหรือไม่
            if (shouldExcludePath(url.pathname)) {
                // console.log(`⏭️ [SKIP PATH] Skipping ${request.method} ${url.pathname}`);
                return { timingKey: null }; // ไม่ track
            }

            // สร้าง request fingerprint สำหรับ deduplication
            const fingerprint = createRequestFingerprint(request);

            // ตรวจสอบว่า request นี้เพิ่งถูก process หรือไม่ (ภายใน 2 วินาทีที่ผ่านมา)
            if (PROCESSED_REQUESTS.has(fingerprint)) {
                // console.log(`🚫 [DUPLICATE] Skipping duplicate request: ${request.method} ${url.pathname}`);
                return { timingKey: null }; // ไม่ track
            }

            // Mark as processed
            PROCESSED_REQUESTS.add(fingerprint);

            // Auto cleanup fingerprint หลัง 5 วินาที
            setTimeout(() => {
                PROCESSED_REQUESTS.delete(fingerprint);
            }, 5000);

            const timingKey = createTimingKey(request);
            const startTime = Date.now();

            // console.log(`📥 [${new Date().toISOString()}] START ${request.method} ${url.pathname} (Key: ${timingKey})`);

            // เก็บ timing info
            requestTimings.set(timingKey, {
                startTime,
                method: request.method,
                url: request.url,
                path: url.pathname,
                request: request
            });

            // Auto cleanup หลัง 30 วินาที (สำหรับ stuck requests)
            setTimeout(() => {
                const timing = requestTimings.get(timingKey);
                if (timing) {
                    // เอาออก จะได้ไม่กวนใจ
                    //console.log(`⏰ [TIMEOUT] Cleaning up stuck request: ${timing.method} ${timing.path}`);

                    // Log timeout request
                    const logData = createLogData(
                        timing,
                        408, // Request Timeout
                        null,
                        'Request timeout - stuck for more than 30 seconds',
                        null
                    );
                    saveLog(logData);

                    // Cleanup
                    requestTimings.delete(timingKey);
                }
            }, 30000);

            return { timingKey };
        })
        .onBeforeHandle(() => {
            //console.log('3️⃣ [onBeforeHandle] ทำงาน!');
        })
        .onAfterHandle(({ request, response, timingKey }) => {
           // console.log('4️⃣ [onAfterHandle] ทำงาน - หลัก!');

            if (!timingKey) return; // Skip excluded paths

            const timing = requestTimings.get(timingKey);
            if (!timing) {
                // console.log(`⚠️ [WARNING] No timing found for key: ${timingKey}`);
                return;
            }

            // ดึง status code จาก response
            const statusCode = (response && typeof response === 'object' && 'status' in response)
                ? (response as any).status || 200
                : 200;
            const responseSize = calculateResponseSize(response);

            console.log(`📤 [SUCCESS] Logging request: ${timing.method} ${timing.path} with status ${statusCode}`);

            // สร้างและบันทึก log
            const logData = createLogData(timing, statusCode, responseSize);
            saveLog(logData);

            // Cleanup
            requestTimings.delete(timingKey);
        })
        .onAfterResponse(() => {
           // console.log('5️⃣ [onAfterResponse] ทำงาน!');
        })
        .onError(({ request, error, timingKey }) => {
         //   console.log('6️⃣ [onError] ทำงาน - หลัก!');

            if (!timingKey) return; // Skip excluded paths

            const timing = requestTimings.get(timingKey);
            if (!timing) {
                // console.log(`⚠️ [ERROR WARNING] No timing found for key: ${timingKey}`);
                return;
            }

            // ดึงข้อมูล error อย่างปลอดภัย
            let statusCode = 500;
            let errorMessage = 'Internal Server Error';
            let errorStack: string | null = null;

            if (error) {
                if (typeof error === 'object' && 'status' in error) {
                    statusCode = (error as any).status || 500;
                }

                if (error instanceof Error) {
                    errorMessage = error.message || 'Internal Server Error';
                    errorStack = error.stack || null;
                } else if (typeof error === 'object' && 'message' in error) {
                    errorMessage = (error as any).message || 'Internal Server Error';
                }

                if (typeof error === 'object' && 'code' in error && typeof (error as any).code === 'number') {
                    statusCode = (error as any).code;
                }
            }

            // console.log(`💥 [ERROR] Logging error: ${timing.method} ${timing.path} with status ${statusCode}`);

            // สร้างและบันทึก log
            const logData = createLogData(timing, statusCode, null, errorMessage, errorStack);
            saveLog(logData);

            // Cleanup
            requestTimings.delete(timingKey);
        });
}

// Export functions เดิม
export const getLogQueueStatus = () => ({
    queueLength: logQueue.length,
    isProcessing: isProcessingQueue,
    activeRequests: requestTimings.size
});

export const flushLogQueue = async () => {
    await processLogQueue();
};

// Export function สำหรับจัดการ excluded paths
export const addExcludedPath = (path: string) => {
    if (!EXCLUDED_PATHS.includes(path)) {
        EXCLUDED_PATHS.push(path);
    }
};

export const removeExcludedPath = (path: string) => {
    const index = EXCLUDED_PATHS.indexOf(path);
    if (index > -1) {
        EXCLUDED_PATHS.splice(index, 1);
    }
};

export const getExcludedPaths = () => [...EXCLUDED_PATHS];

export const isPathExcluded = (path: string) => shouldExcludePath(path);

// Export function สำหรับจัดการ excluded methods
export const addExcludedMethod = (method: string) => {
    const upperMethod = method.toUpperCase();
    if (!EXCLUDED_METHODS.includes(upperMethod)) {
        EXCLUDED_METHODS.push(upperMethod);
    }
};

export const removeExcludedMethod = (method: string) => {
    const upperMethod = method.toUpperCase();
    const index = EXCLUDED_METHODS.indexOf(upperMethod);
    if (index > -1) {
        EXCLUDED_METHODS.splice(index, 1);
    }
};

export const getExcludedMethods = () => [...EXCLUDED_METHODS];

export const isMethodExcluded = (method: string) => shouldExcludeMethod(method);