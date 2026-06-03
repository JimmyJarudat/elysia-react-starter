import prisma from '@/config/prisma.config';

interface MenuRecord {
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
}

interface CurrentMenuUser {
  roles?: string[];
  permissions?: string[];
}

interface MenuTreeItem {
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
}

const toMenuItem = (menu: MenuRecord, children: MenuTreeItem[] = []): MenuTreeItem => ({
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
  subItems: children,
});

export class MenusService {
  static async getMyMenus(currentUser: CurrentMenuUser | null) {
    const isSuperAdmin = currentUser?.roles?.includes('SUPERADMIN') ?? false;
    const permissionIds = new Set(currentUser?.permissions ?? []);

    const menus = await prisma.menu_items.findMany({
      where: { is_active: true },
      orderBy: [
        { parent_id: 'asc' },
        { sort_order: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        path: true,
        label: true,
        icon_name: true,
        icon_library: true,
        code: true,
        permission_id: true,
        parent_id: true,
        sort_order: true,
        is_active: true,
      },
    });

    const childrenByParent = new Map<number | null, MenuRecord[]>();
    for (const menu of menus) {
      const parentId = menu.parent_id ?? null;
      childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), menu]);
    }

    const canViewMenu = (menu: MenuRecord): boolean => {
      if (isSuperAdmin) return true;
      const children = childrenByParent.get(menu.id) ?? [];
      const hasAllowedChild = children.some(canViewMenu);
      if (menu.permission_id) return permissionIds.has(menu.permission_id);
      return hasAllowedChild;
    };

    const buildTree = (parentId: number | null): MenuTreeItem[] =>
      (childrenByParent.get(parentId) ?? [])
        .filter(canViewMenu)
        .map((menu) => toMenuItem(menu, buildTree(menu.id)));

    return {
      success: true,
      data: buildTree(null),
    };
  }
}
