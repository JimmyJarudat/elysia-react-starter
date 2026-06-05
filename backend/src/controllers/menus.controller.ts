import { Elysia, t } from 'elysia';
import { MenusService } from '@/services/menus.service';
import { getCurrentUserFromHeaders } from '@/utils/get-current-user';

export const menusController = new Elysia({ prefix: '/menus' })
  .get('/me', async ({ request }) => {
    return MenusService.getMyMenus(getCurrentUserFromHeaders(request));
  })
  .get('/', async () => {
    return MenusService.listMenus();
  })
  .post('/', async ({ body }) => {
    return MenusService.createMenu(body);
  }, {
    body: t.Object({
      label: t.String(),
      path: t.String(),
      icon_name: t.String(),
      icon_library: t.Optional(t.Nullable(t.String())),
      code: t.Optional(t.Nullable(t.String())),
      permission_id: t.Optional(t.Nullable(t.String())),
      parent_id: t.Optional(t.Nullable(t.Number())),
      sort_order: t.Optional(t.Nullable(t.Number())),
      is_active: t.Optional(t.Nullable(t.Boolean())),
    }),
  })
  .put('/:id', async ({ params, body }) => {
    return MenusService.updateMenu(Number(params.id), body);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      label: t.String(),
      path: t.String(),
      icon_name: t.String(),
      icon_library: t.Optional(t.Nullable(t.String())),
      code: t.Optional(t.Nullable(t.String())),
      permission_id: t.Optional(t.Nullable(t.String())),
      parent_id: t.Optional(t.Nullable(t.Number())),
      sort_order: t.Optional(t.Nullable(t.Number())),
      is_active: t.Optional(t.Nullable(t.Boolean())),
    }),
  })
  .delete('/:id', async ({ params }) => {
    return MenusService.deleteMenu(Number(params.id));
  }, {
    params: t.Object({ id: t.String() }),
  });
