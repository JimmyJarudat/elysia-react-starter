import { Elysia } from 'elysia';
import { accessControlController } from '@/controllers/access-control.controller';
import { apiRouteRequirementsController } from '@/controllers/api-route-requirements.controller';
import { authController } from '@/controllers/auth.controller';
import { menusController } from '@/controllers/menus.controller';
import { personalAccessTokensController } from '@/controllers/personal-access-tokens.controller';
import { systemSettingController } from '@/controllers/system-setting.controller';
import { usersController } from '@/controllers/users.controller';


export const router = new Elysia({ prefix: '/api' })
  .use(authController)
  .use(accessControlController)
  .use(apiRouteRequirementsController)
  .use(menusController)
  .use(personalAccessTokensController)
  .use(systemSettingController)
  .use(usersController);
