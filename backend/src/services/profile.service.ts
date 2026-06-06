import { isAbsolute, join, relative, extname } from "node:path";
import { mkdir, unlink } from "node:fs/promises";
import prisma from "@/config/prisma.config";
import { invalidateAuthUserCache } from "@/utils/cache-invalidation";

export class ProfileService {
  static async getMyProfile(userId: number) {
    const user = await prisma.users.findUnique({
      where: { id: userId, is_deleted: false },
      select: {
        id: true,
        username: true,
        email: true,
        created_at: true,
        password_changed_at: true,
        temporary_account: true,
        account_expiry: true,
        profile: true,
      },
    });

    if (!user) {
      return { success: false, status: 404, message: "User not found" };
    }

    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
        passwordChangedAt: user.password_changed_at,
        temporaryAccount: user.temporary_account,
        accountExpiry: user.account_expiry,
        profile: {
          firstName: user.profile?.first_name ?? "",
          lastName: user.profile?.last_name ?? "",
          displayName: user.profile?.display_name ?? "",
          avatarUrl: user.profile?.avatar_url ?? "",
          phoneNumber: user.profile?.phone_number ?? "",
          department: user.profile?.department ?? "",
          address: user.profile?.address ?? "",
          subDistrict: user.profile?.sub_district ?? "",
          city: user.profile?.city ?? "",
          state: user.profile?.state ?? "",
          postalCode: user.profile?.postal_code ?? "",
          country: user.profile?.country ?? "",
          dateOfBirth: user.profile?.date_of_birth?.toISOString().slice(0, 10) ?? "",
          gender: user.profile?.gender ?? "",
          bio: user.profile?.bio ?? "",
          website: user.profile?.website ?? "",
        },
      },
    };
  }

  static async updateMyProfile(userId: number, input: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    phoneNumber?: string;
    department?: string;
    address?: string;
    subDistrict?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    dateOfBirth?: string;
    gender?: string;
    bio?: string;
    website?: string;
    avatar?: File;
    removeAvatar?: boolean;
  }) {
    const current = await prisma.users.findUnique({
      where: { id: userId, is_deleted: false },
      select: { id: true, profile: { select: { avatar_url: true } } },
    });
    if (!current) {
      return { success: false, status: 404, message: "User not found" };
    }

    const clean = (value?: string) => value?.trim() || null;
    const gender = input.gender?.trim().toUpperCase() || null;
    const country = input.country?.trim().toUpperCase() || null;
    const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
    if (gender && !["M", "F", "O"].includes(gender)) {
      return { success: false, status: 400, message: "Invalid gender" };
    }
    if (country && country.length !== 2) {
      return { success: false, status: 400, message: "Country must use a 2-letter code" };
    }
    if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) {
      return { success: false, status: 400, message: "Invalid date of birth" };
    }

    const profilesDir = join(process.cwd(), "uploads", "profiles");
    const deleteProfileUpload = async (value?: string | null) => {
      if (!value?.startsWith("/uploads/profiles/")) return;
      const fileName = value.split("/").pop();
      if (!fileName) return;

      const absolutePath = join(profilesDir, fileName);
      const resolvedRelative = relative(profilesDir, absolutePath);
      if (resolvedRelative.startsWith("..") || isAbsolute(resolvedRelative)) return;

      try {
        await unlink(absolutePath);
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
          console.warn(`[Profile] Failed to delete old avatar: ${absolutePath}`, error);
        }
      }
    };

    let avatarUrl = current.profile?.avatar_url ?? null;
    if (input.avatar) {
      const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
      const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
      const extension = extname(input.avatar.name || "").toLowerCase();

      if (!allowedTypes.has(input.avatar.type) && !allowedExtensions.has(extension)) {
        return { success: false, status: 400, message: "Avatar must be PNG, JPG, or WEBP" };
      }
      if (input.avatar.size > 3 * 1024 * 1024) {
        return { success: false, status: 400, message: "Avatar must be 3MB or smaller" };
      }

      await mkdir(profilesDir, { recursive: true });
      const safeExtension = allowedExtensions.has(extension) ? extension : ".png";
      const fileName = `avatar-${userId}-${Date.now()}-${crypto.randomUUID()}${safeExtension}`;
      await Bun.write(join(profilesDir, fileName), input.avatar);
      avatarUrl = `/uploads/profiles/${fileName}`;
    } else if (input.removeAvatar) {
      avatarUrl = null;
    }

    await prisma.profile.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        first_name: clean(input.firstName),
        last_name: clean(input.lastName),
        display_name: clean(input.displayName),
        avatar_url: avatarUrl,
        phone_number: clean(input.phoneNumber),
        department: clean(input.department),
        address: clean(input.address),
        sub_district: clean(input.subDistrict),
        city: clean(input.city),
        state: clean(input.state),
        postal_code: clean(input.postalCode),
        country,
        date_of_birth: dateOfBirth,
        gender,
        bio: clean(input.bio),
        website: clean(input.website),
      },
      update: {
        ...(input.firstName !== undefined && { first_name: clean(input.firstName) }),
        ...(input.lastName !== undefined && { last_name: clean(input.lastName) }),
        ...(input.displayName !== undefined && { display_name: clean(input.displayName) }),
        ...((input.avatar || input.removeAvatar) && { avatar_url: avatarUrl }),
        ...(input.phoneNumber !== undefined && { phone_number: clean(input.phoneNumber) }),
        ...(input.department !== undefined && { department: clean(input.department) }),
        ...(input.address !== undefined && { address: clean(input.address) }),
        ...(input.subDistrict !== undefined && { sub_district: clean(input.subDistrict) }),
        ...(input.city !== undefined && { city: clean(input.city) }),
        ...(input.state !== undefined && { state: clean(input.state) }),
        ...(input.postalCode !== undefined && { postal_code: clean(input.postalCode) }),
        ...(input.country !== undefined && { country }),
        ...(input.dateOfBirth !== undefined && { date_of_birth: dateOfBirth }),
        ...(input.gender !== undefined && { gender }),
        ...(input.bio !== undefined && { bio: clean(input.bio) }),
        ...(input.website !== undefined && { website: clean(input.website) }),
        updated_at: new Date(),
      },
    });

    if (current.profile?.avatar_url && current.profile.avatar_url !== avatarUrl) {
      await deleteProfileUpload(current.profile.avatar_url);
    }
    await invalidateAuthUserCache(userId);

    return this.getMyProfile(userId);
  }
}
