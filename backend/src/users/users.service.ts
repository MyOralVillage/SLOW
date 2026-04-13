import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { effectivePermissions, normalizePermissionGrants } from "../auth/permissions";

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
        role: true,
        status: true,
        permission_grants: true,
        created_at: true,
      },
    });
    return rows.map((row) => ({
      ...row,
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
        permission_grants: input.permission_grants ? nextGrants : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        permission_grants: true,
        created_at: true,
      },
    });

    return {
      ...row,
      permission_grants: normalizePermissionGrants(row.permission_grants),
      permissions: effectivePermissions(row.role, row.permission_grants),
    };
  }
}
