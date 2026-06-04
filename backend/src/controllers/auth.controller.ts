// controllers/auth.controller.ts
import { Elysia, t, type CookieOptions } from 'elysia';
import { AuthService } from '../services/auth.service';
import { getClientInfo } from '@/utils/clientInfo';
import { getCurrentUserFromHeaders } from '@/utils/get-current-user';
import prisma from '@/config/prisma.config';
import { createSessionForUser } from '@/services/session.service';
import { getUserRolesAndPermissions } from '@/utils/get-user-role-permission';

const getAuthCookieOptions = (path: string): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    path,
    maxAge: 3 * 24 * 60 * 60,
    sameSite: isProduction ? 'strict' : 'lax',
  };
};

const getClearAuthCookieOptions = (path: string): CookieOptions => ({
  ...getAuthCookieOptions(path),
  maxAge: 0,
});

export const authController = new Elysia({ prefix: '/auth' })
  
  .get('/login', ({ set }) => {
    set.status = 405;

    return {
      success: false,
      message: 'Use POST /api/auth/login',
    };
  })

  .post('/login', async ({ body, request, cookie }) => {
    const clientInfo = getClientInfo(request);
    const result = await AuthService.login(body, undefined, clientInfo);

    if (result.success && result.refreshToken) {
      cookie.accessToken.set({
        ...getAuthCookieOptions('/api/'),
        value: result.accessToken ?? '',
      });
      cookie.refreshToken.set({
        ...getAuthCookieOptions('/api/auth/'),
        value: result.refreshToken,
      });

      delete (result as any).refreshToken;
    }

    return result;
  }, {
    body: t.Object({
      username: t.String({
        minLength: 3,
        maxLength: 50,
        description: 'Username or email'
      }),
      password: t.String({
        minLength: 6,
        description: 'User password'
      })
    })
  })

  .post('/register', async ({ body, set }) => {
    const result = await AuthService.register(body);
    set.status = result.status;
    return result;
  }, {
    body: t.Object({
      username: t.String({ minLength: 3, maxLength: 50 }),
      email: t.String({ minLength: 5, maxLength: 255 }),
      password: t.String({ minLength: 6 }),
      firstName: t.Optional(t.String()),
      lastName: t.Optional(t.String()),
    })
  })

  .get('/me', async ({ cookie, set }) => {
    const result = await AuthService.me({
      accessToken: cookie.accessToken.value as string | undefined,
      refreshToken: cookie.refreshToken.value as string | undefined,
    });

    if (!result.success) {
      set.status = result.status;
    } else if ('accessToken' in result && result.accessToken) {
      cookie.accessToken.set({
        ...getAuthCookieOptions('/api/'),
        value: result.accessToken,
      });
    }

    return result;
  })

  .post('/refresh-token', async ({ cookie, set }) => {
    const result = await AuthService.refreshToken(cookie.refreshToken.value as string | undefined);

    if (!result.success) {
      set.status = result.status;
      return result;
    }

    cookie.accessToken.set({
      ...getAuthCookieOptions('/api/'),
      value: result.accessToken,
    });

    return result;
  })

  .post('/logout', async ({ cookie, set }) => {
    const result = await AuthService.logout({
      accessToken: cookie.accessToken.value as string | undefined,
      refreshToken: cookie.refreshToken.value as string | undefined,
    });

    cookie.accessToken.set({
      ...getClearAuthCookieOptions('/api/'),
      value: '',
    });
    cookie.refreshToken.set({
      ...getClearAuthCookieOptions('/api/auth/'),
      value: '',
    });

    if (!result.success) {
      set.status = result.status;
    }

    return result;
  })

  .post('/impersonate/:userId', async ({ params, cookie, request, set }) => {
    const caller = getCurrentUserFromHeaders(request);
    if (!caller?.permissions?.includes('users.impersonate')) {
      set.status = 403;
      return { success: false, message: 'Forbidden' };
    }

    const targetId = Number(params.userId);
    const target = await prisma.users.findUnique({
      where: { id: targetId, is_deleted: false, is_active: true },
      select: { id: true, username: true },
    });
    if (!target) {
      set.status = 404;
      return { success: false, message: 'User not found or inactive' };
    }

    const { roles } = await getUserRolesAndPermissions(targetId);
    const clientInfo = getClientInfo(request);
    const { accessToken, refreshToken } = await createSessionForUser(targetId, roles, clientInfo);

    cookie.accessToken.set({ ...getAuthCookieOptions('/api/'), value: accessToken });
    cookie.refreshToken.set({ ...getAuthCookieOptions('/api/auth/'), value: refreshToken });

    return { success: true };
  }, {
    params: t.Object({ userId: t.String() }),
  })

  
