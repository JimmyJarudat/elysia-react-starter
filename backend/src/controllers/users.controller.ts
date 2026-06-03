import { Elysia } from 'elysia';
import { UsersService } from '@/services/users.service';

export const usersController = new Elysia({ prefix: '/users' })
  .get('/', async () => UsersService.listUsers());
