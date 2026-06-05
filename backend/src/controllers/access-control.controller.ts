import { Elysia, t } from 'elysia';
import { AccessControlService } from '@/services/access-control.service';

export const accessControlController = new Elysia({ prefix: '/access-control' })
  .get('/roles-permissions', async () => {
    return AccessControlService.getRolesAndPermissions();
  })

  // ─── Roles ──────────────────────────────────────────────────────────────────
  .post('/roles', async ({ body }) => {
    return AccessControlService.createRole(body.id, body);
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
  .put('/roles/:id', async ({ params, body }) => {
    return AccessControlService.updateRole(params.id, body);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.String(),
      priority: t.Optional(t.Nullable(t.Number())),
      description: t.Optional(t.Nullable(t.String())),
    }),
  })
  .delete('/roles/:id', async ({ params }) => {
    return AccessControlService.deleteRole(params.id);
  }, {
    params: t.Object({ id: t.String() }),
  })
  .delete('/roles', async ({ body }) => {
    return AccessControlService.bulkDeleteRoles(body.ids);
  }, {
    body: t.Object({ ids: t.Array(t.String()) }),
  })
  .post('/roles/:id/clone', async ({ params, body }) => {
    return AccessControlService.cloneRole(params.id, body.newId, body.newName, body.newDescription);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      newId: t.String(),
      newName: t.String(),
      newDescription: t.Optional(t.Nullable(t.String())),
    }),
  })
  .put('/roles/:id/permissions', async ({ params, body }) => {
    return AccessControlService.updateRolePermissions(params.id, body.permissionIds);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ permissionIds: t.Array(t.String()) }),
  })

  // ─── Role Hierarchy ──────────────────────────────────────────────────────────
  .get('/role-hierarchy', async () => {
    return AccessControlService.getRoleHierarchy();
  })
  .post('/role-hierarchy', async ({ body }) => {
    return AccessControlService.addRoleHierarchy(body.parentRoleId, body.childRoleId);
  }, {
    body: t.Object({ parentRoleId: t.String(), childRoleId: t.String() }),
  })
  .delete('/role-hierarchy/:parentId/:childId', async ({ params }) => {
    return AccessControlService.removeRoleHierarchy(params.parentId, params.childId);
  }, {
    params: t.Object({ parentId: t.String(), childId: t.String() }),
  })

  // ─── Permissions ─────────────────────────────────────────────────────────────
  .post('/permissions', async ({ body }) => {
    return AccessControlService.createPermission(body.id, body);
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
  .put('/permissions/:id', async ({ params, body }) => {
    return AccessControlService.updatePermission(params.id, body);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.String(),
      resource: t.String(),
      action: t.String(),
      description: t.Optional(t.Nullable(t.String())),
    }),
  })
  .delete('/permissions/:id', async ({ params }) => {
    return AccessControlService.deletePermission(params.id);
  }, {
    params: t.Object({ id: t.String() }),
  });
