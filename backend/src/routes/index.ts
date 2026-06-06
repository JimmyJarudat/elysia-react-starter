import { Elysia } from 'elysia';
import { accessControlController } from '@/controllers/access-control.controller';
import { accountSecurityController } from '@/controllers/account-security.controller';
import { apiRouteRequirementsController } from '@/controllers/api-route-requirements.controller';
import { authController } from '@/modules/auth/auth.controller';
import { menusController } from '@/modules/menus/menus.controller';
import { myAuthHistoryController } from '@/controllers/my-auth-history.controller';
import { notificationsController } from '@/controllers/notifications.controller';
import { personalAccessTokensController } from '@/controllers/personal-access-tokens.controller';
import { profileController } from '@/controllers/profile.controller';
import { sessionsController } from '@/modules/sessions/sessions.controller';
import { systemSettingController } from '@/controllers/system-setting.controller';
import { usersController } from '@/modules/users/users.controller';


export const router = new Elysia({ prefix: '/api' })
  .use(authController)
  .use(accountSecurityController)
  .use(accessControlController)
  .use(apiRouteRequirementsController)
  .use(menusController)
  .use(myAuthHistoryController)
  .use(notificationsController)
  .use(personalAccessTokensController)
  .use(profileController)
  .use(sessionsController)
  .use(systemSettingController)
  .use(usersController);
