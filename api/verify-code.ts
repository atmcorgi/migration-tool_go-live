import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSessionToken } from "./_session";

// OTP generation and verification logic (server-side only)
const DEFAULT_WINDOW_SECONDS = 60;
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory rate limiting store (for serverless, consider using Redis/Vercel KV in production)
const rateLimitStore = new Map<string, { attempts: number; resetAt: number }>();

function generateCode(date: Date, windowSeconds: number, secret: string): string {
  const timeStep = Math.floor(date.getTime() / 1000 / windowSeconds) + 1;

  let h1 = 0x811c9dc5 ^ timeStep;
  let h2 = 0xc2b2ae35 + ((timeStep * 0x27d4eb2d) >>> 0);

  const input = `${secret}:${timeStep}`;

  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);

    // branch 1: FNV-like with rotation
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h1 = (h1 << 13) | (h1 >>> 19);

    // branch 2: different multiplier + rotation, mixed back into h2
    let v = Math.imul(c, 0x27d4eb2d) >>> 0;
    h2 ^= v;
    h2 = (h2 << 7) | (h2 >>> 25);
    h2 = (h2 + h1) >>> 0;
  }

  // final avalanche
  let hash = (h1 ^ h2) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0x9e3779b1) >>> 0;
  hash ^= hash >>> 16;

  // ensure non-negative 4-digit window
  const positive = ((hash % 10_000) + 10_000) % 10_000;
  const code = positive.toString().padStart(4, "0");
  return code;
}

function verifyCode(code: string, secret: string, windowSeconds: number = DEFAULT_WINDOW_SECONDS): boolean {
  if (!/^\d{4}$/.test(code)) return false;

  // Use server time (not client time) - this is critical for Vercel deployment
  const now = new Date();
  // Accept current and previous window (roughly 2 minutes tolerance)
  const offsets = [0, -1];

  return offsets.some((offset) => {
    const time = new Date(now.getTime() + offset * windowSeconds * 1000);
    return generateCode(time, windowSeconds, secret) === code;
  });
}

function getClientId(req: VercelRequest): string {
  // Use IP address or a combination of IP + user agent for rate limiting
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]) : req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  return `${ip}-${userAgent}`;
}

function checkRateLimit(clientId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(clientId);

  if (!record || now > record.resetAt) {
    // Reset or create new record
    rateLimitStore.set(clientId, {
      attempts: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    // Clean up old entries periodically (simple cleanup)
    if (rateLimitStore.size > 1000) {
      for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetAt) {
          rateLimitStore.delete(key);
        }
      }
    }
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.attempts++;
  return { allowed: true, remaining: MAX_ATTEMPTS - record.attempts, resetAt: record.resetAt };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const secret = process.env.MIGRATION_SECRET;
    if (!secret) {
      console.error('MIGRATION_SECRET environment variable is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const body = (req as any).body || {};
    const code = typeof body === 'string' ? body : body.code;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code is required' });
    }

    // Rate limiting
    const clientId = getClientId(req);
    const rateLimit = checkRateLimit(clientId);

    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetAt - Date.now()) / 1000 / 60);
      return res.status(429).json({
        error: 'Too many attempts',
        message: `Rate limit exceeded. Please try again in ${resetIn} minute(s).`,
        resetAt: rateLimit.resetAt
      });
    }

    // Verify code using server time (critical for Vercel)
    const isValid = verifyCode(code.trim(), secret);

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid code',
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt
      });
    }

    const { token, expiresAt } = createSessionToken(secret);

    return res.status(200).json({
      success: true,
      sessionToken: token,
      expiresAt,
      remaining: rateLimit.remaining,
    });
  } catch (err: any) {
    console.error('verify-code error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
}

