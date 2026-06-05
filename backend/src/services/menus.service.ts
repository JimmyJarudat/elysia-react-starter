import prisma from '@/config/prisma.config';
import redis from '@/config/redis.config';
import { invalidateMenuCache } from '@/utils/cache-invalidation';

export class MenusService {

  static async getMyMenus(currentUser: {
    roles?: string[];
    permissions?: string[];
  } | null) {
    type MenuRecord = {
      id: number;
      path: string;
      label: string;
      icon_name: string;
      icon_library: string | null;
      code: string | null;
      permission_id: string | null;
      parent_id: number | null;
      sort_order: number | null;
      is_active: boolean | null;
    };

    type MenuTreeItem = {
      id: number;
      path: string;
      label: string;
      icon_name: string;
      icon_library: string;
      code: string | null;
      permission_id: string | null;
      parent_id: number | null;
      sort_order: number;
      is_active: boolean;
      subItems: MenuTreeItem[];
    };

    const cacheTtl = 300;
    const cacheKeyMe = (key: string) => `menus:me:${key}`;

    // Build cache key from user's permission set
    const isSuperAdmin = currentUser?.roles?.includes('SUPERADMIN') ?? false;
    const permKey = isSuperAdmin
      ? 'SUPERADMIN'
      : [...(currentUser?.permissions ?? [])].sort().join(',') || 'anonymous';
    const cacheKey = cacheKeyMe(permKey);

    // Return cached result if available
  if (redis) {
      try {
        const raw = await redis.get(cacheKey);
        if (raw) return JSON.parse(raw);
      } catch { /* fall through to DB */ }
    }

    // Fetch from DB and build permission-filtered tree
    const permissionIds = new Set(currentUser?.permissions ?? []);

    const rows = await prisma.menu_items.findMany({
      where: { is_active: true },
      orderBy: [{ parent_id: 'asc' }, { sort_order: 'asc' }, { id: 'asc' }],
      select: {
        id: true, path: true, label: true, icon_name: true, icon_library: true,
        code: true, permission_id: true, parent_id: true, sort_order: true, is_active: true,
      },
    });

    const childrenByParent = new Map<number | null, MenuRecord[]>();
    for (const row of rows) {
      const pid = row.parent_id ?? null;
      childrenByParent.set(pid, [...(childrenByParent.get(pid) ?? []), row]);
    }

    const canView = (menu: MenuRecord): boolean => {
      if (isSuperAdmin) return true;
      if (!menu.permission_id) return (childrenByParent.get(menu.id) ?? []).some(canView);
      if (permissionIds.has(menu.permission_id)) return true;
      // Child permission: user has a more specific perm under this namespace (e.g. settings.security.cors.read grants settings.security)
      const childPrefix = menu.permission_id + ".";
      if ([...permissionIds].some(p => p.startsWith(childPrefix))) return true;
      // Parent access: user has root-level broad perm (settings.read or settings.update grants settings.security)
      const root = menu.permission_id.split(".")[0];
      if (menu.permission_id.includes(".") && (permissionIds.has(root + ".read") || permissionIds.has(root + ".update"))) return true;
      return false;
    };

    const buildTree = (parentId: number | null): MenuTreeItem[] =>
      (childrenByParent.get(parentId) ?? [])
        .filter(canView)
        .map((menu) => ({
          id: menu.id,
          path: menu.path,
          label: menu.label,
          icon_name: menu.icon_name,
          icon_library: menu.icon_library ?? 'lucide-react',
          code: menu.code,
          permission_id: menu.permission_id,
          parent_id: menu.parent_id,
          sort_order: menu.sort_order ?? 0,
          is_active: Boolean(menu.is_active),
          subItems: buildTree(menu.id),
        }));

    const result = { success: true, data: buildTree(null) };

    // Cache result
  if (redis) {
      try { await redis.set(cacheKey, JSON.stringify(result), 'EX', cacheTtl); } catch { /* non-critical */ }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────

  static async listMenus() {
    const cacheTtl = 300;
    const cacheKeyList = 'menus:list';

    // Return cached result if available
  if (redis) {
      try {
        const raw = await redis.get(cacheKeyList);
        if (raw) return JSON.parse(raw);
      } catch { /* fall through to DB */ }
    }

    const menus = await prisma.menu_items.findMany({
      orderBy: [{ parent_id: 'asc' }, { sort_order: 'asc' }, { id: 'asc' }],
    });

    const result = { success: true, data: menus };

    // Cache result
  if (redis) {
      try { await redis.set(cacheKeyList, JSON.stringify(result), 'EX', cacheTtl); } catch { /* non-critical */ }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────

  static async createMenu(body: {
    label: string;
    path: string;
    icon_name: string;
    icon_library?: string | null;
    code?: string | null;
    permission_id?: string | null;
    parent_id?: number | null;
    sort_order?: number | null;
    is_active?: boolean | null;
  }) {
    const menu = await prisma.menu_items.create({
      data: {
        label: body.label,
        path: body.path,
        icon_name: body.icon_name,
        icon_library: body.icon_library ?? 'lucide-react',
        code: body.code ?? null,
        permission_id: body.permission_id ?? null,
        parent_id: body.parent_id ?? null,
        sort_order: body.sort_order ?? 0,
        is_active: body.is_active ?? true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await invalidateMenuCache();

    return { success: true, data: menu };
  }

  // ─────────────────────────────────────────────────────────────────────────

  static async updateMenu(id: number, body: {
    label: string;
    path: string;
    icon_name: string;
    icon_library?: string | null;
    code?: string | null;
    permission_id?: string | null;
    parent_id?: number | null;
    sort_order?: number | null;
    is_active?: boolean | null;
  }) {
    const menu = await prisma.menu_items.update({
      where: { id },
      data: {
        label: body.label,
        path: body.path,
        icon_name: body.icon_name,
        icon_library: body.icon_library ?? 'lucide-react',
        code: body.code ?? null,
        permission_id: body.permission_id ?? null,
        parent_id: body.parent_id ?? null,
        sort_order: body.sort_order ?? 0,
        is_active: body.is_active ?? true,
        updated_at: new Date(),
      },
    });

    await invalidateMenuCache();

    return { success: true, data: menu };
  }

  // ─────────────────────────────────────────────────────────────────────────

  static async deleteMenu(id: number) {
    const hasChildren = await prisma.menu_items.count({ where: { parent_id: id } });
    if (hasChildren > 0) {
      throw new Error('Cannot delete a menu that has sub-items. Remove sub-items first.');
    }

    await prisma.menu_items.delete({ where: { id } });

    await invalidateMenuCache();

    return { success: true };
  }
}
