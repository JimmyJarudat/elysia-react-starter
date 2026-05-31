// src/prisma.ts
import { PrismaClient } from '@prisma/client';
import { logStreamer } from '@/services/admin-console/log-streamer.service';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

// เปิด Prisma middleware
prisma.$use(async (params, next) => {
  const start = Date.now();
  
  try {
    const result = await next(params);
    const duration = Date.now() - start;
    
    // Log successful database operations
    logStreamer.log('db', 'info', `${params.action} ${params.model || 'unknown'}`, {
      action: params.action,
      model: params.model,
      duration,
      success: true,
      timestamp: new Date().toISOString()
    });
    
    return result;
  } catch (error: any) {
    const duration = Date.now() - start;
    
    // Log failed database operations
    logStreamer.log('db', 'error', `${params.action} ${params.model || 'unknown'} failed`, {
      action: params.action,
      model: params.model,
      duration,
      error: error.message,
      code: error.code,
      success: false,
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;