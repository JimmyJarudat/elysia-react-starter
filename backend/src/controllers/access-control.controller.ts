import { Elysia, t } from 'elysia';
import { AccessControlService } from '@/services/access-control.service';

const roleBody = t.Object({
  name: t.String(),
  priority: t.Optional(t.Nullable(t.Number())),
  description: t.Optional(t.Nullable(t.String())),
});

const permissionBody = t.Object({
  name: t.String(),
  resource: t.String(),
  action: t.String(),
  description: t.Optional(t.Nullable(t.String())),
});

export const accessControlController = new Elysia({ prefix: '/access-control' })
  .get('/roles-permissions', async () =>
    AccessControlService.getRolesAndPermissions())

  // ─── Roles ──────────────────────────────────────────────────────────────────
  .post('/roles', async ({ body }) =>
    AccessControlService.createRole(body.id, body), {
    body: t.Intersect([t.Object({ id: t.String() }), roleBody]),
  })
  .put('/roles/:id', async ({ params, body }) =>
    AccessControlService.updateRole(params.id, body), {
    params: t.Object({ id: t.String() }),
    body: roleBody,
  })
  .delete('/roles/:id', async ({ params }) =>
    AccessControlService.deleteRole(params.id), {
    params: t.Object({ id: t.String() }),
  })
  .put('/roles/:id/permissions', async ({ params, body }) =>
    AccessControlService.updateRolePermissions(params.id, body.permissionIds), {
    params: t.Object({ id: t.String() }),
    body: t.Object({ permissionIds: t.Array(t.String()) }),
  })

  // ─── Permissions ─────────────────────────────────────────────────────────────
  .post('/permissions', async ({ body }) =>
    AccessControlService.createPermission(body.id, body), {
    body: t.Intersect([t.Object({ id: t.String() }), permissionBody]),
  })
  .put('/permissions/:id', async ({ params, body }) =>
    AccessControlService.updatePermission(params.id, body), {
    params: t.Object({ id: t.String() }),
    body: permissionBody,
  })
  .delete('/permissions/:id', async ({ params }) =>
    AccessControlService.deletePermission(params.id), {
    params: t.Object({ id: t.String() }),
  });
