import { Elysia } from 'elysia';
import { MenusService } from '@/services/menus.service';
import { getCurrentUserFromHeaders } from '@/utils/get-current-user';

export const menusController = new Elysia({ prefix: '/menus' })
  .get('/me', async ({ request }) => MenusService.getMyMenus(getCurrentUserFromHeaders(request)));
