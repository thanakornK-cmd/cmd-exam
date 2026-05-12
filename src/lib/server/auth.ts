import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { AppError } from "./errors.ts";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [scheme, salt, expectedHex] = hash.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) {
    throw new AppError(500, "password hash configuration is invalid");
  }
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AppError(401, "invalid credentials");
  }
}

export function createToken() {
  return randomBytes(32).toString("base64url");
}
