import { Elysia, t } from 'elysia';
import { PersonalAccessTokenService } from '@/modules/personal-access-tokens/personal-access-tokens.service';
import { getCurrentUserFromHeaders } from '@/utils/get-current-user';

export const personalAccessTokensController = new Elysia({ prefix: '/personal-access-tokens' })
  .get('/', async ({ request }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });
    return PersonalAccessTokenService.listTokens(user.id);
  })

  .post('/', async ({ request, body }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    return PersonalAccessTokenService.createToken(user.id, body.name, expiresAt);
  }, {
    body: t.Object({
      name: t.String(),
      expiresAt: t.Optional(t.Nullable(t.String())),
    }),
  })

  .post('/:id/revoke', async ({ request, params }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });
    return PersonalAccessTokenService.revokeToken(user.id, Number(params.id));
  }, {
    params: t.Object({ id: t.String() }),
  })

  .delete('/:id', async ({ request, params }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });
    return PersonalAccessTokenService.deleteToken(user.id, Number(params.id));
  }, {
    params: t.Object({ id: t.String() }),
  });
