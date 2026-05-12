import { randomInt } from "node:crypto";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferenceCode(now: Date) {
  let suffix = "";
  for (let index = 0; index < 5; index += 1) {
    const randomIndex = randomInt(0, CHARSET.length);
    suffix += CHARSET[randomIndex];
  }

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `REG-${year}${month}${day}-${suffix}`;
}
