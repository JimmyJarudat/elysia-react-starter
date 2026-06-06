import redis from "@/config/redis.config";
import { randomInt } from "node:crypto";

export type EmailChallengeType =
  | "PRIMARY_VERIFY"
  | "PRIMARY_CHANGE"
  | "RECOVERY_VERIFY"
  | "RECOVERY_CHANGE";

export type EmailChallenge = {
  userId: number;
  type: EmailChallengeType;
  targetEmail: string;
  codeHash: string;
  attempts: number;
  expiresAt: number;
};

export const EMAIL_CODE_TTL_SECONDS = 10 * 60;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

const emailChallenges = new Map<string, EmailChallenge>();

const getEmailChallengeKey = (userId: number, type: EmailChallengeType) =>
  `account-security:email-code:${userId}:${type}`;

export const generateEmailCode = () => String(randomInt(100000, 1000000));

export const hashEmailCode = (code: string) =>
  new Bun.CryptoHasher("sha256").update(code).digest("hex");

export const setEmailChallenge = async (challenge: EmailChallenge) => {
  const key = getEmailChallengeKey(challenge.userId, challenge.type);
  emailChallenges.set(key, challenge);

  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(challenge), "EX", EMAIL_CODE_TTL_SECONDS);
  } catch {
    // Runtime memory remains available when Redis becomes unavailable.
  }
};

export const deleteEmailChallenge = async (userId: number, type: EmailChallengeType) => {
  const key = getEmailChallengeKey(userId, type);

  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // Runtime memory is still cleared below.
    }
  }

  emailChallenges.delete(key);
};

export const getEmailChallenge = async (userId: number, type: EmailChallengeType) => {
  const key = getEmailChallengeKey(userId, type);
  let raw: string | EmailChallenge | null | undefined;

  if (redis) {
    try {
      raw = await redis.get(key) ?? emailChallenges.get(key);
    } catch {
      raw = emailChallenges.get(key);
    }
  } else {
    raw = emailChallenges.get(key);
  }

  if (!raw) return null;

  const challenge = typeof raw === "string" ? JSON.parse(raw) as EmailChallenge : raw;
  if (challenge.expiresAt <= Date.now()) {
    await deleteEmailChallenge(userId, type);
    return null;
  }

  return challenge;
};
