import { Elysia, t } from 'elysia';
import { UsersService } from '@/services/users.service';
import { getCurrentUserFromHeaders } from '@/utils/get-current-user';

export const usersController = new Elysia({ prefix: '/users' })
  .get('/', async () => UsersService.listUsers())
  .get('/deleted', async () => UsersService.listDeletedUsers())
  .patch('/:id/restore', async ({ params }) =>
    UsersService.restoreUser(Number(params.id)), {
    params: t.Object({ id: t.String() }),
  })
  .delete('/:id/permanent', async ({ params, request }) => {
    const currentUser = getCurrentUserFromHeaders(request);
    return UsersService.permanentDeleteUser(Number(params.id), currentUser?.id ?? 0);
  }, {
    params: t.Object({ id: t.String() }),
  })

  .post('/', async ({ body }) => UsersService.createUser({
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
  }), {
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
