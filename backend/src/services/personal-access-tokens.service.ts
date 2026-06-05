import { createHash, randomBytes } from 'crypto';
import prisma from '@/config/prisma.config';

export class PersonalAccessTokenService {

  static async listTokens(userId: number) {
    const tokens = await prisma.personal_access_tokens.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        token_prefix: true,
        expires_at: true,
        last_used_at: true,
        revoked_at: true,
        created_at: true,
      },
    });
    return { success: true, data: tokens };
  }

  static async createToken(userId: number, name: string, expiresAt: Date | null) {
    // Generate: "pat_" + 32 random bytes (hex) = 68 chars total
    const rawToken = 'pat_' + randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.slice(0, 16); // "pat_a1b2c3d4e5f6"

    const token = await prisma.personal_access_tokens.create({
      data: {
        user_id: userId,
        name: name.trim(),
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        expires_at: expiresAt,
      },
      select: {
        id: true,
        name: true,
        token_prefix: true,
        expires_at: true,
        revoked_at: true,
        created_at: true,
      },
    });

    // rawToken คืนกลับครั้งเดียว — ไม่เก็บใน DB
    return { success: true, data: { ...token, token: rawToken } };
  }

  static async revokeToken(userId: number, id: number) {
    const existing = await prisma.personal_access_tokens.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) throw new Error('Token not found');
    if (existing.revoked_at) throw new Error('Token is already revoked');

    await prisma.personal_access_tokens.update({
      where: { id },
      data: { revoked_at: new Date() },
    });
    return { success: true };
  }

  static async deleteToken(userId: number, id: number) {
    const existing = await prisma.personal_access_tokens.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) throw new Error('Token not found');

    await prisma.personal_access_tokens.delete({ where: { id } });
    return { success: true };
  }

  // ── ใช้โดย middleware ─────────────────────────────────────────────────────

  static async validateToken(rawToken: string): Promise<{
    userId: number;
    username: string;
    email: string;
    patId: number;
  } | null> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const pat = await prisma.personal_access_tokens.findUnique({
      where: { token_hash: tokenHash },
      select: {
        id: true,
        revoked_at: true,
        expires_at: true,
        users: {
          select: { id: true, username: true, email: true, is_active: true, is_deleted: true },
        },
      },
    });

    if (!pat) return null;
    if (pat.revoked_at) return null;
    if (pat.expires_at && pat.expires_at < new Date()) return null;
    if (!pat.users.is_active || pat.users.is_deleted) return null;

    // Update last_used_at แบบ background ไม่บล็อก response
    prisma.personal_access_tokens
      .update({ where: { id: pat.id }, data: { last_used_at: new Date() } })
      .catch(() => {});

    return {
      userId: pat.users.id,
      username: pat.users.username,
      email: pat.users.email,
      patId: pat.id,
    };
  }
}
