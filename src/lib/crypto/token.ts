import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import { getTokenEncryptionKey } from "@/lib/env";

/**
 * Meta 토큰 암호화 (AES-256-GCM).
 * - 키는 `TOKEN_ENCRYPTION_KEY`(32바이트 base64). Vault 도입 전까지의 대칭암호화.
 * - 저장 포맷: `v1:<iv>:<ciphertext>:<authTag>` (각 base64).
 * - 평문 토큰은 절대 DB/로그/프론트로 흘리지 않는다. 이 모듈은 server-only.
 */

const FORMAT_VERSION = "v1";
const IV_BYTES = 12; // GCM 권장 nonce 길이

function loadKey(): Buffer {
  const raw = getTokenEncryptionKey();
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `[crypto] TOKEN_ENCRYPTION_KEY 는 32바이트(base64)여야 합니다. 현재 ${key.length}바이트.`
    );
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    ciphertext.toString("base64"),
    authTag.toString("base64"),
  ].join(":");
}

export function decryptToken(encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error("[crypto] 지원하지 않는 암호문 포맷입니다.");
  }
  const [, ivB64, ctB64, tagB64] = parts;
  const key = loadKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
