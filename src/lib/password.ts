import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Minimum bar for a usable password — this is an optional convenience
 * login method layered on top of email OTP, not the sole line of defense,
 * so we keep the requirement simple rather than a full strength policy. */
export function isPasswordValid(password: string): boolean {
  return typeof password === "string" && password.length >= 8;
}
