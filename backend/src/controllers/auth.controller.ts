// controllers/auth.controller.ts
import { Elysia, t, type CookieOptions } from 'elysia';
import { AuthService } from '../services/auth.service';
import { getClientInfo } from '@/utils/clientInfo';

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
  // .post('/register', async ({ body, request }) => {
  //   const currentUser = getCurrentUserFromHeaders(request);
  //   const clientInfo = getClientInfo(request);

  //   return await AuthService.register(body, currentUser, clientInfo);
  // }, {
  //   body: t.Object({
  //     username: t.String({
  //       minLength: 3,
  //       maxLength: 50,
  //       description: 'Username or email'
  //     }),
  //     password: t.String({
  //       minLength: 6,
  //       description: 'User password'
  //     })
  //   })
  // })

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


  // .post('/refresh-token', async ({ request, set }) => {
  //   // อ่าน refresh token จาก cookie
  //   const cookieHeader = request.headers.get('cookie');
  //   const cookies = cookieHeader ? parse(cookieHeader) : {};
  //   const refreshToken = cookies.refreshToken;

  //   if (!refreshToken) {
  //     set.status = 401;
  //     return {
  //       success: false,
  //       message: 'No refresh token found'
  //     };
  //   }

  //   try {
  //     //  เปลี่ยนจาก object เป็น string โดยตรง
  //     const result = await AuthService.refreshToken(refreshToken);

  //     // ตั้ง refresh token ใหม่ใน cookie ถ้ามี
  //     if (result.refreshToken) {
  //       const isProduction = process.env.NODE_ENV === 'production';
  //       set.headers['Set-Cookie'] = serialize('refreshToken', result.refreshToken, {
  //         httpOnly: true,
  //         secure: isProduction,
  //         path: '/api/auth/',
  //         maxAge: 3 * 24 * 60 * 60,
  //         sameSite: isProduction ? 'strict' : 'lax'
  //       });
  //     }

  //     return {
  //       success: true,
  //       accessToken: result.accessToken,
  //       user: result.user
  //     };
  //   } catch (error: any) {
  //     set.status = 401;
  //     return {
  //       success: false,
  //       message: error.message || 'Invalid refresh token'
  //     };
  //   }
  // }, {
  //   // ⭐ เพิ่ม body schema เพื่อให้ Elysia เรียก onBeforeHandle
  //   body: t.Optional(t.Object({}))
  // })

  // .post('/reset-password/request', async ({ body }) => {
  //   return await AuthService.resetPasswordRequest(body.email);
  // }, {
  //   body: ResetPasswordDto
  // })

  // .post('/reset-password/verify', async ({ body }) => {
  //   return await AuthService.verifyResetPassword(body);
  // }, {
  //   body: VerifiPasswordDto
  // })

  // .post('/reset-password', async ({ body , request }) => {
  //   const currentUser = getCurrentUserFromHeaders(request);
  //   const clientInfo = getClientInfo(request);
  //   return await AuthService.ResetPasswordFinal(body , currentUser, clientInfo);
  // }, {
  //   body: ResetPasswordFinalDto
  // })

  // .post('/admin/verify-credentials', async ({ body, request }) => {
  //   const currentUser = getCurrentUserFromHeaders(request);
  //   const clientInfo = getClientInfo(request);
  //   return await AuthService.adminConfirm(body, currentUser, clientInfo);
  // }, {
  //   body: AdminConfirm
  // })

  // .post('/admin/impersonate', async ({ body, request, set }) => {
  //   const currentUser = getCurrentUserFromHeaders(request);
  //   const clientInfo = getClientInfo(request);

  //   // ตรวจสอบว่ามี user และมีสิทธิ์ admin หรือไม่
  //   if (!currentUser) {
  //     return { success: false, status: 401, message: 'Unauthorized' };
  //   }

  //   // ตรวจสอบว่ามี role admin หรือไม่ 
  //   const hasAdminRole = currentUser.roles.some((role: string) =>

  //     ['ADMIN', 'SUPERADMIN',].includes(role)
  //   );

  //   if (!hasAdminRole) {
  //     return { success: false, status: 403, message: 'Insufficient permissions' };
  //   }

  //   const result = await AuthService.impersonate(
  //     body.user_id,
  //     currentUser.id,
  //     { request, clientInfo }
  //   );

  //   if (result.success && result.refreshToken) {
  //     const isProduction = process.env.NODE_ENV === 'production';

  //     set.headers['Set-Cookie'] = serialize('refreshToken', result.refreshToken, {
  //       httpOnly: true,
  //       secure: isProduction,
  //       path: '/api/auth/',
  //       maxAge: 3 * 24 * 60 * 60,
  //       sameSite: isProduction ? 'strict' : 'lax'
  //     });

  //     delete (result as any).refreshToken;
  //   }

  //   return result;
  // }, {
  //   body: t.Object({
  //     user_id: t.Number()
  //   })
  // })

  // .get('/auth-history', async ({ query }) => {
  //   const result = await AuthService.getAuthHistory(query);
  //   return result;
  // }, {
  //   query: t.Object({
  //     user_id: t.Optional(t.Number()),
  //     page: t.Optional(t.Number({ minimum: 1, default: 1 })),
  //     limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
  //     auth_type: t.Optional(t.String()), // LOGIN, LOGOUT, REFRESH_TOKEN
  //     auth_status: t.Optional(t.String()), // SUCCESS, FAILED
  //     start_date: t.Optional(t.String()),
  //     end_date: t.Optional(t.String())
  //   }),
  //   detail: {
  //     tags: ['Auth History'],
  //     summary: 'Get authentication history with pagination',
  //     description: 'Retrieve auth history. Optionally filter by user_id, auth_type, auth_status, and date range.'
  //   }
  // })

  // .get('/auth-history/stats', async ({ query }) => {
  //   const { user_id } = query;
  //   const result = await AuthService.getAuthHistoryStats(user_id);
  //   return result;
  // }, {
  //   query: t.Object({
  //     user_id: t.Optional(t.Number())
  //   }),
  //   detail: {
  //     tags: ['Auth History'],
  //     summary: 'Get authentication statistics',
  //     description: 'Get login statistics including success rate, failed attempts, and unique IPs'
  //   }
  // })
