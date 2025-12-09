import crypto from "crypto";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

type SessionPayload = {
  authenticated: true;
  exp: number; // epoch millis
  iat: number; // epoch millis
  cid: string; // client fingerprint (ip+ua)
};

function base64url(data: Buffer) {
  return data
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createSessionToken(secret: string, clientId: string): {
  token: string;
  expiresAt: number;
} {
  const now = Date.now();
  const exp = now + SESSION_DURATION_MS;
  const payload: SessionPayload = {
    authenticated: true,
    exp,
    iat: now,
    cid: clientId,
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = base64url(Buffer.from(payloadStr, "utf8"));
  const sig = base64url(
    crypto.createHmac("sha256", secret).update(payloadB64).digest()
  );

  return { token: `${payloadB64}.${sig}`, expiresAt: exp };
}

export function verifySessionToken(
  token: string,
  secret: string,
  clientId: string
): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;

  const expectedSig = base64url(
    crypto.createHmac("sha256", secret).update(payloadB64).digest()
  );
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(payloadB64, "base64").toString("utf8");
    const payload = JSON.parse(payloadJson) as SessionPayload;
    if (!payload.exp || !payload.authenticated) return null;
    if (!payload.cid || payload.cid !== clientId) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_DURATION = SESSION_DURATION_MS;
