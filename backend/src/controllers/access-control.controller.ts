import { Elysia, t } from 'elysia';
import { AccessControlService } from '@/services/access-control.service';
import { getCurrentUserFromHeaders } from '@/utils/get-current-user';

export const accessControlController = new Elysia({ prefix: '/access-control' })
  .get('/roles', async () => {
    return AccessControlService.listRoles();
  })
  .get('/roles-permissions', async () => {
    return AccessControlService.getRolesAndPermissions();
  })

  // ─── Roles ──────────────────────────────────────────────────────────────────
  .post('/roles', async ({ body, request }) => {
    const actor = getCurrentUserFromHeaders(request);
    return AccessControlService.createRole(body.id, body, actor?.id);
  }, {
    body: t.Intersect([
      t.Object({ id: t.String() }),
      t.Object({
        name: t.String(),
        priority: t.Optional(t.Nullable(t.Number())),
        description: t.Optional(t.Nullable(t.String())),
      }),
    ]),
  })
  .put('/roles/:id', async ({ params, body, request }) => {
    const actor = getCurrentUserFromHeaders(request);
    return AccessControlService.updateRole(params.id, body, actor?.id);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.String(),
      priority: t.Optional(t.Nullable(t.Number())),
      description: t.Optional(t.Nullable(t.String())),
    }),
  })
  .delete('/roles/:id', async ({ params, request }) => {
    const actor = getCurrentUserFromHeaders(request);
    return AccessControlService.deleteRole(params.id, actor?.id);
  }, {
    params: t.Object({ id: t.String() }),
  })
  .delete('/roles', async ({ body, request }) => {
    const actor = getCurrentUserFromHeaders(request);
    return AccessControlService.bulkDeleteRoles(body.ids, actor?.id);
  }, {
    body: t.Object({ ids: t.Array(t.String()) }),
  })
  .post('/roles/:id/clone', async ({ params, body, request }) => {
    const actor = getCurrentUserFromHeaders(request);
    return AccessControlService.cloneRole(params.id, body.newId, body.newName, body.newDescription, actor?.id);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      newId: t.String(),
      newName: t.String(),
      newDescription: t.Optional(t.Nullable(t.String())),
    }),
  })
  .put('/roles/:id/permissions', async ({ params, body, request }) => {
    const actor = getCurrentUserFromHeaders(request);
    return AccessControlService.updateRolePermissions(params.id, body.permissionIds, actor?.id);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ permissionIds: t.Array(t.String()) }),
  })

  // ─── Role Hierarchy ──────────────────────────────────────────────────────────
  .get('/role-hierarchy', async () => {
    return AccessControlService.getRoleHierarchy();
  })
  .post('/role-hierarchy', async ({ body, request }) => {
    const actor = getCurrentUserFromHeaders(request);
    return AccessControlService.addRoleHierarchy(body.parentRoleId, body.childRoleId, actor?.id);
  }, {
    body: t.Object({ parentRoleId: t.String(), childRoleId: t.String() }),
  })
  .delete('/role-hierarchy/:parentId/:childId', async ({ params, request }) => {
    const actor = getCurrentUserFromHeaders(request);
    return AccessControlService.removeRoleHierarchy(params.parentId, params.childId, actor?.id);
  }, {
    params: t.Object({ parentId: t.String(), childId: t.String() }),
  })

  // ─── Permissions ─────────────────────────────────────────────────────────────
  .post('/permissions', async ({ body, request }) => {
    const actor = getCurrentUserFromHeaders(request);
    return AccessControlService.createPermission(body.id, body, actor?.id);
  }, {
    body: t.Intersect([
      t.Object({ id: t.String() }),
      t.Object({
        name: t.String(),
        resource: t.String(),
        action: t.String(),
        description: t.Optional(t.Nullable(t.String())),
      }),
    ]),
  })
  .put('/permissions/:id', async ({ params, body, request }) => {
    const actor = getCurrentUserFromHeaders(request);
    return AccessControlService.updatePermission(params.id, body, actor?.id);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.String(),
      resource: t.String(),
      action: t.String(),
      description: t.Optional(t.Nullable(t.String())),
    }),
  })
  .delete('/permissions/:id', async ({ params, request }) => {
    const actor = getCurrentUserFromHeaders(request);
    return AccessControlService.deletePermission(params.id, actor?.id);
  }, {
    params: t.Object({ id: t.String() }),
  });
