import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { canManageUsers, effectivePermissions, normalizePermissionGrants } from "../auth/permissions";
import { serializePublicUser } from "./user-view.util";

type ActingUser = {
  id: string;
  role: UserRole;
  permissions?: string[];
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    const rows = await this.prisma.user.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        email_verified: true,
        role: true,
        status: true,
        country: true,
        why_interested: true,
        biodata: true,
        social_handles: true,
        permission_grants: true,
        created_at: true,
        avatar_name: true,
        avatar_storage_key: true,
        _count: {
          select: {
            resources: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      ...serializePublicUser(row),
      uploaded_resource_count: row._count.resources,
      permission_grants: normalizePermissionGrants(row.permission_grants),
      permissions: effectivePermissions(row.role, row.permission_grants),
    }));
  }

  async updateUserPermissions(
    id: string,
    input: { role?: UserRole; status?: UserStatus; permission_grants?: string[] },
    actingUser?: ActingUser,
  ) {
    if (!actingUser?.permissions?.includes("manage_permissions")) {
      throw new ForbiddenException("You do not have permission to change user access.");
    }

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        permission_grants: true,
      },
    });
    if (!existing) {
      throw new NotFoundException("User not found.");
    }

    const nextRole = input.role ?? existing.role;
    const nextGrants =
      input.permission_grants !== undefined
        ? normalizePermissionGrants(input.permission_grants)
        : normalizePermissionGrants(existing.permission_grants);
    const isOwnerAction = existing.role === UserRole.owner || nextRole === UserRole.owner || nextGrants.includes("manage_site");

    if (actingUser.role !== UserRole.owner && isOwnerAction) {
      throw new ForbiddenException("Only an owner can manage owner-level access.");
    }

    const row = await this.prisma.user.update({
      where: { id },
      data: {
        role: input.role,
        status: input.status,
        permission_grants: input.permission_grants !== undefined ? nextGrants : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        country: true,
        why_interested: true,
        biodata: true,
        social_handles: true,
        permission_grants: true,
        created_at: true,
        avatar_name: true,
        avatar_storage_key: true,
        _count: {
          select: {
            resources: true,
          },
        },
      },
    });

    return {
      ...serializePublicUser(row),
      uploaded_resource_count: row._count.resources,
      permission_grants: normalizePermissionGrants(row.permission_grants),
      permissions: effectivePermissions(row.role, row.permission_grants),
    };
  }

  async searchForMessaging(currentUserId: string, query: string) {
    const q = String(query || "").trim().toLowerCase();
    if (q.length < 2) return { rows: [] };
    const rows = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        status: { not: UserStatus.disabled },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { country: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        country: true,
        role: true,
        status: true,
        avatar_name: true,
        avatar_storage_key: true,
      },
      orderBy: [{ name: "asc" }],
      take: 25,
    });
    return { rows: rows.map((row) => serializePublicUser(row)) };
  }

  async searchProfiles(currentUserId: string, query: string) {
    const q = String(query || "").trim().toLowerCase();
    if (q.length < 2) return { rows: [] };
    const rows = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        status: { not: UserStatus.disabled },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { country: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        country: true,
        role: true,
        status: true,
        why_interested: true,
        biodata: true,
        social_handles: true,
        avatar_name: true,
        avatar_storage_key: true,
        created_at: true,
      },
      orderBy: [{ name: "asc" }],
      take: 12,
    });
    return { rows: rows.map((row) => serializePublicUser(row)) };
  }

  async getPublicProfile(id: string, actingUser?: ActingUser) {
    if (!actingUser || !canManageUsers(actingUser.role, actingUser.permissions)) {
      // signed-in users can still view profiles; only block anonymous callers at controller layer
    }
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        country: true,
        why_interested: true,
        biodata: true,
        social_handles: true,
        avatar_name: true,
        avatar_storage_key: true,
        email_verified: true,
        created_at: true,
        resources: {
          orderBy: { created_at: "desc" },
          take: 12,
          select: {
            id: true,
            title: true,
            category: true,
            country: true,
            type: true,
            description: true,
            created_at: true,
            mime_type: true,
            original_filename: true,
            storage_key: true,
            file_path: true,
            external_url: true,
            file_bytes: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException("User not found.");
    return {
      user: serializePublicUser(row),
      resources: row.resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        category: resource.category,
        country: resource.country,
        type: resource.type,
        description: resource.description,
        created_at: resource.created_at,
        file: resource.storage_key || resource.file_path || resource.external_url || (resource.file_bytes && resource.file_bytes.length)
          ? {
              url: `/api/resources/${resource.id}/file`,
              thumbnailUrl:
                (String(resource.mime_type || "").startsWith("image/") ||
                  /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(String(resource.original_filename || "")))
                  ? `/api/resources/${resource.id}/file`
                  : null,
            }
          : null,
      })),
    };
  }
}
