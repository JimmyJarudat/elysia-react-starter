import { Elysia } from 'elysia';
import { accessControlController } from '@/modules/access-control/access-control.controller';
import { accountSecurityController } from '@/modules/account-security/account-security.controller';
import { apiRouteRequirementsController } from '@/modules/api-route-requirements/api-route-requirements.controller';
import { authController } from '@/modules/auth/auth.controller';
import { logsController } from '@/modules/logs/logs.controller';
import { menusController } from '@/modules/menus/menus.controller';
import { myAuthHistoryController } from '@/modules/my-auth-history/my-auth-history.controller';
import { notificationsController } from '@/modules/notifications/notifications.controller';
import { personalAccessTokensController } from '@/modules/personal-access-tokens/personal-access-tokens.controller';
import { profileController } from '@/modules/profile/profile.controller';
import { sessionsController } from '@/modules/sessions/sessions.controller';
import { systemSettingController } from '@/modules/system-setting/system-setting.controller';
import { usersController } from '@/modules/users/users.controller';


export const router = new Elysia({ prefix: '/api' })
  .use(authController)
  .use(accountSecurityController)
  .use(accessControlController)
  .use(apiRouteRequirementsController)
  .use(logsController)
  .use(menusController)
  .use(myAuthHistoryController)
  .use(notificationsController)
  .use(personalAccessTokensController)
  .use(profileController)
  .use(sessionsController)
  .use(systemSettingController)
  .use(usersController);
