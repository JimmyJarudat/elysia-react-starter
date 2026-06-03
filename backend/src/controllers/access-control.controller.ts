import { Elysia } from 'elysia';
import { AccessControlService } from '@/services/access-control.service';

export const accessControlController = new Elysia({ prefix: '/access-control' })
  .get('/roles-permissions', async () => AccessControlService.getRolesAndPermissions());
