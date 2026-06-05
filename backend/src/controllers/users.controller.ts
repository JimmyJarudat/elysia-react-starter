import { Elysia, t } from 'elysia';
import { UsersService } from '@/services/users.service';
import { getCurrentUserFromHeaders } from '@/utils/get-current-user';

export const usersController = new Elysia({ prefix: '/users' })
  .get('/', async () => {
    return UsersService.listUsers();
  })
  .get('/deleted', async () => {
    return UsersService.listDeletedUsers();
  })
  .patch('/:id/restore', async ({ params }) => {
    return UsersService.restoreUser(Number(params.id));
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
  .put('/:id', async ({ params, body }) => {
    return UsersService.updateUser(Number(params.id), body);
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
  .post('/:id/unlock', async ({ params }) => {
    return UsersService.unlockAccount(Number(params.id));
  }, {
    params: t.Object({ id: t.String() }),
  })
  .delete('/:id/sessions', async ({ params }) => {
    return UsersService.forceLogout(Number(params.id));
  }, {
    params: t.Object({ id: t.String() }),
  })
  .post('/:id/reset-password', async ({ params, body }) => {
    return UsersService.resetPassword(Number(params.id), body.newPassword, body.mustChangePassword ?? true);
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
