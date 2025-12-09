import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifySessionToken } from "./_session.js";

function getClientId(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded
    ? Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded.split(",")[0]
    : req.socket.remoteAddress || "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";
  return `${ip}-${userAgent}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.MIGRATION_SECRET;
  if (!secret) {
    console.error("MIGRATION_SECRET environment variable is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { token } = req.body || {};
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token is required" });
  }

  const clientId = getClientId(req);
  const payload = verifySessionToken(token, secret, clientId);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  return res.status(200).json({
    success: true,
    authenticated: true,
    expiresAt: payload.exp,
    issuedAt: payload.iat,
  });
}


