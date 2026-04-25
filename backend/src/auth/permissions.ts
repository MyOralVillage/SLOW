import { UserRole } from "@prisma/client";

/**
 * Permission constants mapped from the SLOW specification Diagram 1.
 * Numbers in comments reference the spec capability rows.
 */
export const ALL_PERMISSIONS = [
  // Row 32-33: Everyone
  "view_content",              // 32. View content
  "search_resources",          // 31. Search for resources with filters
  "download_content",          // 29. Download content

  // Row 30: Member+ (obligatory)
  "complete_profile",          // 30. Complete member profile

  // Row 22-28: Member+
  "upload_resources",          // 22. Upload and label resources for site
  "comment_resources",         // 27. Participate in a resource comment thread
  "recommend_content",         // 28. Recommend content for library
  "message_users",             // 24. Message another user
  "create_discussions",        // 18/25. Initiate or participate in forum discussion
  "enable_notifications",      // 26. Enable/disable notifications
  "request_notifications",     // 23. Request notifications for discussions of interest

  // Row 9-20: Specialist/VIP+
  "edit_resources",            // 10. Edit or upgrade library resources
  "edit_tags",                 // 13. Edit tags on a resource
  "initiate_comment_thread",   // 16. Initiate a resource comment thread
  "link_discussion",           // 20. Link a discussion to library resources
  "conduct_poll",              // 15. Conduct an online poll
  "certify_resources",         // 9/11. Certify resources

  // Row 2-8, 14: Admin+
  "manage_categories",         // 2. Create or remove a category or tag
  "manage_users",              // 4. Access list of site users, message anyone
  "manage_permissions",        // 1/6. Upgrade, downgrade users / assign roles
  "approve_resources",         // 14. Approve resources for library
  "remove_comments",           // 8. Remove forum comments
  "disable_resources",         // 7. Disable or take down library resources
  "send_notifications",        // Broadcast notifications

  // Row 1, 5: Owner only
  "manage_site",               // 5. Edit the search algorithm / site config
  "manage_all_users",          // 1. Upgrade, downgrade or remove ANY user
] as const;

export type PermissionName = (typeof ALL_PERMISSIONS)[number];

/**
 * Role-to-permission mapping following SLOW specification Diagram 1.
 *
 * Green = enabled at launch for that role
 * Blue  = obligatory to qualify for that role
 */
export const ROLE_PERMISSIONS: Record<UserRole, PermissionName[]> = {
  owner: [...ALL_PERMISSIONS],

  admin: [
    "view_content",
    "search_resources",
    "download_content",
    "complete_profile",
    "upload_resources",
    "comment_resources",
    "recommend_content",
    "message_users",
    "create_discussions",
    "enable_notifications",
    "request_notifications",
    "edit_resources",
    "edit_tags",
    "initiate_comment_thread",
    "link_discussion",
    "conduct_poll",
    "certify_resources",
    "manage_categories",
    "manage_users",
    "manage_permissions",
    "approve_resources",
    "remove_comments",
    "disable_resources",
    "send_notifications",
  ],

  vip: [
    "view_content",
    "search_resources",
    "download_content",
    "complete_profile",
    "upload_resources",
    "comment_resources",
    "recommend_content",
    "message_users",
    "create_discussions",
    "enable_notifications",
    "request_notifications",
    "edit_resources",
    "edit_tags",
    "initiate_comment_thread",
    "link_discussion",
    "conduct_poll",
    "certify_resources",
  ],

  specialist: [
    "view_content",
    "search_resources",
    "download_content",
    "complete_profile",
    "upload_resources",
    "comment_resources",
    "recommend_content",
    "message_users",
    "create_discussions",
    "enable_notifications",
    "request_notifications",
    "edit_resources",
    "edit_tags",
    "initiate_comment_thread",
    "link_discussion",
    "conduct_poll",
  ],

  member: [
    "view_content",
    "search_resources",
    "download_content",
    "complete_profile",
    "upload_resources",
    "comment_resources",
    "recommend_content",
    "message_users",
    "create_discussions",
    "enable_notifications",
    "request_notifications",
  ],

  none: [
    "view_content",
    "search_resources",
    "download_content",
  ],
};

export function normalizePermissionGrants(list: string[] | undefined) {
  return Array.from(
    new Set(
      (list || [])
        .map((v) => String(v || "").trim())
        .filter((v): v is PermissionName => ALL_PERMISSIONS.includes(v as PermissionName)),
    ),
  ).sort();
}

export function effectivePermissions(role: UserRole, grants?: string[]) {
  return Array.from(
    new Set([...(ROLE_PERMISSIONS[role] || []), ...normalizePermissionGrants(grants)]),
  ).sort();
}

export function hasPermission(role: UserRole, grants: string[] | undefined, permission: PermissionName) {
  return effectivePermissions(role, grants).includes(permission);
}

export function canDeleteAnyResource(role: UserRole, grants?: string[]) {
  return role === UserRole.owner || role === UserRole.admin || hasPermission(role, grants, "disable_resources");
}

export function canDeleteOwnResource(role: UserRole, grants?: string[]) {
  return hasPermission(role, grants, "upload_resources");
}

export function canDeleteResource(role: UserRole, grants: string[] | undefined, actorUserId: string, ownerUserId?: string | null) {
  return canDeleteAnyResource(role, grants) || (Boolean(ownerUserId) && ownerUserId === actorUserId && canDeleteOwnResource(role, grants));
}

export function canCreateCommunityPost(role: UserRole, grants?: string[]) {
  return hasPermission(role, grants, "complete_profile");
}

export function canDeleteAnyCommunityPost(role: UserRole, grants?: string[]) {
  return role === UserRole.owner || role === UserRole.admin || hasPermission(role, grants, "send_notifications");
}

export function canCreateForumThread(role: UserRole, grants?: string[]) {
  return hasPermission(role, grants, "edit_resources");
}

export function canReplyForumThread(role: UserRole, grants?: string[]) {
  return hasPermission(role, grants, "complete_profile");
}

export function canViewUserProfiles(role: UserRole, grants?: string[]) {
  return hasPermission(role, grants, "view_content");
}

export function canManageUsers(role: UserRole, grants?: string[]) {
  return hasPermission(role, grants, "manage_users");
}
