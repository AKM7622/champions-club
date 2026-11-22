// Edge- and Node-compatible token signing and verification using standard Web Crypto API

export const SESSION_COOKIE_NAME = "cc_session";

const AUTH_SECRET =
  process.env.AUTH_SECRET || "champions-club-ultra-secure-auth-secret-key-2026-production";

export interface SessionPayload {
  sessionToken: string;
  userId: string;
  role: string;
  exp: number; // Unix timestamp in ms
  rememberMe?: boolean;
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Signs a session payload into a compact token string:
 * Format: [rawSessionToken].[base64UrlPayload].[base64UrlSignature]
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const key = await getHmacKey();
  const enc = new TextEncoder();
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(enc.encode(payloadStr));
  const dataToSign = `${payload.sessionToken}.${payloadB64}`;

  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
  const signatureB64 = base64UrlEncode(signature);

  return `${payload.sessionToken}.${payloadB64}.${signatureB64}`;
}

/**
 * Verifies a token string and returns the payload if valid and not expired.
 */
export async function verifySessionToken(tokenString: string): Promise<SessionPayload | null> {
  if (!tokenString) return null;
  const parts = tokenString.split(".");
  if (parts.length !== 3) return null;

  const [rawToken, payloadB64, signatureB64] = parts;
  const dataToVerify = `${rawToken}.${payloadB64}`;

  try {
    const key = await getHmacKey();
    const enc = new TextEncoder();
    const signature = base64UrlDecode(signatureB64);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature as unknown as BufferSource,
      enc.encode(dataToVerify)
    );

    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload: SessionPayload = JSON.parse(payloadJson);

    // Check expiration timestamp
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Extracts the raw PostgreSQL session token from the compound token string.
 */
export function extractRawSessionToken(tokenString: string): string {
  if (!tokenString) return "";
  return tokenString.split(".")[0];
}
