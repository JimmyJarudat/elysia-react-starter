import { Elysia } from 'elysia';
import { authController } from '@/controllers/auth.controller';


export const router = new Elysia({ prefix: '/api' })

  // Auth routes: /api/auth/*
  .group('/auth', (app) => app
    .use(authController)
  )

  .group('/home', (app) => app
    .use(homeController)
  )
  .group('/it-jobs', (app) => app
    .use(itJobsController)
  )

  .group('/carton', (app) => app
    .use(cartonUtilsController)
  )

  .group('/dashboard', app => app
    .use(cartonController)
  )

  .group('/history', (app) => app
    .use(historyController)
  )

  .group('/history-main', (app) => app
    .use(historyMainController)
  )

  .group('/uploads', (app) => app
    .use(UploadController)
  )

  .group('/database', (app) => app
    .use(databaseController)
  )

  .group('/system', (app) => app
    .use(systemController)
  )

  .group('/document-history', (app) => app
    .use(documentHistoryController)
  )

  .group('/admin', (app) => app
    .use(adminController)
  )

  .group('/app-late', (app) => app
    .use(appLateController)
  )

  .group('/document-delivery', (app) => app
    .use(documentDeliveryController)
  )

  .group('/development', (app) => app
    .use(developmentController)
  )

  .group('/noreturn', (app) => app
    .use(noreturnController)
  )

  .group('/user', (app) => app
    .use(userController)
  )

  .group('/fingerprint', (app) => app
    .use(fingerPrintController)
  )

  .group('/it-utils', (app) => app
    .use(itUtilsController)
  )

  .group('/boss', (app) => app
    .use(BossController)
  )

  .group('/debezium', (app) => app
    .use(debeziumController)
  )

  .group('/fr-edit', (app) => app
    .use(frEditRequestController)
  )


  // Health check สำหรับ API
  .get('/status', () => ({
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }))

  // Health check สำหรับ Docker
  .get('/health', () => ({
    status: 'healthy',
    service: 'files-system-nova-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    },
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  }))


  // Ping endpoint สำหรับ basic connectivity check
  .get('/ping', () => ({
    pong: true,
    timestamp: Date.now(),
    server: 'elysia'
  }));