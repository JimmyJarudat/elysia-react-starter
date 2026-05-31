import { Elysia } from 'elysia';
import { authController } from '@/controllers/auth.controller';


export const router = new Elysia({ prefix: '/api' })
  .use(authController);
