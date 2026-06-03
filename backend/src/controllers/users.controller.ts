import { Elysia, t } from 'elysia';
import { UsersService } from '@/services/users.service';

export const usersController = new Elysia({ prefix: '/users' })
  .get('/', async () => UsersService.listUsers())

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
  });
