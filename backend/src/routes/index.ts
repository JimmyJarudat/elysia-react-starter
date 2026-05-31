import { Elysia } from 'elysia';
import { authController } from '@/controllers/auth.controller';


export const router = new Elysia({ prefix: '/api' })

  // Auth routes: /api/auth/*
  .group('/auth', (app) => app
    .use(authController)
  )

