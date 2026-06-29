import { Elysia, t } from 'elysia';
import { UsersService } from '@/modules/users/users.service';
import { IntegrationSettingService } from '@/modules/system-setting/integration-setting.service';
import { getCurrentUserFromHeaders } from '@/utils/get-current-user';

export const usersController = new Elysia({ prefix: '/users' })
  .get('/', async () => {
    return UsersService.listUsers();
  })
  .get('/deleted', async () => {
    return UsersService.listDeletedUsers();
  })
  .get('/export', async ({ query }) => {
    const exported = await UsersService.exportExcel({
      search: query.search,
      status: query.status,
      online: query.online,
      approval: query.approval,
      verification: query.verification,
      role: query.role,
      includeDeleted: query.includeDeleted,
    });

    return new Response(exported.buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
      },
    });
  }, {
    query: t.Object({
      search: t.Optional(t.String()),
      status: t.Optional(t.Union([t.Literal("all"), t.Literal("active"), t.Literal("inactive"), t.Literal("pending")])),
      online: t.Optional(t.Union([t.Literal("all"), t.Literal("online"), t.Literal("offline")])),
      approval: t.Optional(t.Union([t.Literal("all"), t.Literal("approved"), t.Literal("pending")])),
      verification: t.Optional(t.Union([t.Literal("all"), t.Literal("verified"), t.Literal("unverified")])),
      role: t.Optional(t.String()),
      includeDeleted: t.Optional(t.String()),
    }),
  })
  .post('/ldap/departments', async ({ body, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return IntegrationSettingService.fetchLdapDepartments({
      baseDn: body.baseDn,
      userId: currentUser?.id,
    });
  }, {
    body: t.Object({
      baseDn: t.Optional(t.String()),
    }),
  })
  .get('/ldap/status', async () => {
    return IntegrationSettingService.getLdapStatus();
  })
  .patch('/:id/restore', async ({ params, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return UsersService.restoreUser(Number(params.id), currentUser?.id);
  }, {
    params: t.Object({ id: t.String() }),
  })
  .delete('/:id/permanent', async ({ params, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return UsersService.permanentDeleteUser(Number(params.id), currentUser?.id ?? 0);
  }, {
    params: t.Object({ id: t.String() }),
  })

  .post('/', async ({ body, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return UsersService.createUser({
      username: body.username,
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      displayName: body.displayName,
      phoneNumber: body.phoneNumber,
      department: body.department,
      groupName: body.groupName,
      roleIds: body.roleIds,
      isActive: body.isActive,
      isApproved: body.isApproved,
      isEmailVerified: body.isEmailVerified,
      mustChangePassword: body.mustChangePassword,
    }, currentUser?.id);
  }, {
    body: t.Object({
      username: t.String(),
      email: t.String(),
      password: t.String(),
      firstName: t.Optional(t.Nullable(t.String())),
      lastName: t.Optional(t.Nullable(t.String())),
      displayName: t.Optional(t.Nullable(t.String())),
      phoneNumber: t.Optional(t.Nullable(t.String())),
      department: t.Optional(t.Nullable(t.String())),
      groupName: t.Optional(t.Nullable(t.String())),
      roleIds: t.Optional(t.Array(t.String())),
      isActive: t.Optional(t.Boolean()),
      isApproved: t.Optional(t.Boolean()),
      isEmailVerified: t.Optional(t.Boolean()),
      mustChangePassword: t.Optional(t.Boolean()),
    }),
  })

  .get('/:id', async ({ params }) => {
    return UsersService.getUserById(Number(params.id));
  }, {
    params: t.Object({ id: t.String() }),
  })
  .put('/:id', async ({ params, body, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return UsersService.updateUser(Number(params.id), body, currentUser?.id);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      username: t.Optional(t.String()),
      email: t.Optional(t.String()),
      groupName: t.Optional(t.Nullable(t.String())),
      firstName: t.Optional(t.Nullable(t.String())),
      lastName: t.Optional(t.Nullable(t.String())),
      displayName: t.Optional(t.Nullable(t.String())),
      phoneNumber: t.Optional(t.Nullable(t.String())),
      department: t.Optional(t.Nullable(t.String())),
      isActive: t.Optional(t.Boolean()),
      isApproved: t.Optional(t.Boolean()),
      isEmailVerified: t.Optional(t.Boolean()),
      mustChangePassword: t.Optional(t.Boolean()),
      recoveryEmail: t.Optional(t.Nullable(t.String())),
      temporaryAccount: t.Optional(t.Boolean()),
      accountExpiry: t.Optional(t.Nullable(t.String())),
      remarks: t.Optional(t.Nullable(t.String())),
    }),
  })
  .post('/:id/unlock', async ({ params, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return UsersService.unlockAccount(Number(params.id), currentUser?.id);
  }, {
    params: t.Object({ id: t.String() }),
  })
  .delete('/:id/sessions', async ({ params, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return UsersService.forceLogout(Number(params.id), currentUser?.id);
  }, {
    params: t.Object({ id: t.String() }),
  })
  .post('/:id/reset-password', async ({ params, body, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return UsersService.resetPassword(Number(params.id), body.newPassword, body.mustChangePassword ?? true, currentUser?.id);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      newPassword: t.String(),
      mustChangePassword: t.Optional(t.Boolean()),
    }),
  })

  .get('/:id/roles', async ({ params }) => {
    return UsersService.getUserRoles(Number(params.id));
  }, {
    params: t.Object({ id: t.String() }),
  })
  .put('/:id/roles', async ({ params, body, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return UsersService.updateUserRoles(Number(params.id), body.roleIds, currentUser?.id);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ roleIds: t.Array(t.String()) }),
  })

  .patch('/:id/status', async ({ params, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return UsersService.toggleUserStatus(Number(params.id), currentUser?.id ?? 0);
  }, {
    params: t.Object({ id: t.String() }),
  })

  .delete('/:id', async ({ params, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return UsersService.deleteUser(Number(params.id), currentUser?.id ?? 0);
  }, {
    params: t.Object({ id: t.String() }),
  });
