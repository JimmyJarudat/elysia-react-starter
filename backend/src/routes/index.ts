import { Elysia } from 'elysia';
import { accessControlController } from '@/controllers/access-control.controller';
import { authController } from '@/controllers/auth.controller';
import { menusController } from '@/controllers/menus.controller';
import { personalAccessTokensController } from '@/controllers/personal-access-tokens.controller';
import { usersController } from '@/controllers/users.controller';


export const router = new Elysia({ prefix: '/api' })
  .use(authController)
  .use(accessControlController)
  .use(menusController)
  .use(personalAccessTokensController)
  .use(usersController);
