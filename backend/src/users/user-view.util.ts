export function avatarUrlForUser(userId: string, hasAvatar: boolean) {
  return hasAvatar ? `/api/users/${userId}/avatar` : null;
}

export function serializePublicUser(row: any) {
  const hasAvatar = Boolean(row?.avatar_storage_key);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    country: row.country || "",
    why_interested: row.why_interested || "",
    biodata: row.biodata || "",
    social_handles: row.social_handles || "",
    email_verified: row.email_verified === true,
    avatar_name: row.avatar_name || "",
    has_avatar: hasAvatar,
    avatar_url: avatarUrlForUser(row.id, hasAvatar),
    created_at: row.created_at || null,
  };
}
