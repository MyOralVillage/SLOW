import { UserRole } from "@prisma/client";

export const ALL_PERMISSIONS = [
  "view_content",
  "search_resources",
  "download_content",
  "complete_profile",
  "comment_resources",
  "recommend_content",
  "message_users",
  "create_discussions",
  "upload_resources",
  "edit_resources",
  "manage_categories",
  "manage_users",
  "manage_permissions",
  "send_notifications",
  "manage_site",
] as const;

export type PermissionName = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, PermissionName[]> = {
  owner: [...ALL_PERMISSIONS],
  admin: [
    "view_content",
    "search_resources",
    "download_content",
    "complete_profile",
    "comment_resources",
    "recommend_content",
    "message_users",
    "create_discussions",
    "upload_resources",
    "edit_resources",
    "manage_categories",
    "manage_users",
    "manage_permissions",
    "send_notifications",
  ],
  vip: [
    "view_content",
    "search_resources",
    "download_content",
    "complete_profile",
    "comment_resources",
    "recommend_content",
    "message_users",
    "create_discussions",
  ],
  specialist: [
    "view_content",
    "search_resources",
    "download_content",
    "complete_profile",
    "comment_resources",
    "recommend_content",
    "message_users",
    "create_discussions",
    "upload_resources",
    "edit_resources",
  ],
  member: [
    "view_content",
    "search_resources",
    "download_content",
    "complete_profile",
    "comment_resources",
    "recommend_content",
    "message_users",
    "create_discussions",
    "upload_resources",
  ],
  none: ["view_content", "search_resources", "download_content"],
};

export function normalizePermissionGrants(list: string[] | undefined) {
  return Array.from(new Set((list || []).map((value) => String(value || "").trim()).filter((value): value is PermissionName => ALL_PERMISSIONS.includes(value as PermissionName)))).sort();
}

export function effectivePermissions(role: UserRole, grants?: string[]) {
  return Array.from(new Set([...(ROLE_PERMISSIONS[role] || []), ...normalizePermissionGrants(grants)])).sort();
}

export function hasPermission(role: UserRole, grants: string[] | undefined, permission: PermissionName) {
  return effectivePermissions(role, grants).includes(permission);
}
