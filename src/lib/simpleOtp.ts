
const SECRET = import.meta.env.VITE_MIGRATION_SECRET as string | undefined;

// 1 minute per window
const DEFAULT_WINDOW_SECONDS = 60;

export function generateCode(
  date: Date = new Date(),
  windowSeconds = DEFAULT_WINDOW_SECONDS
): string {
  const timeStep = Math.floor(date.getTime() / 1000 / windowSeconds) + 1;

  let h1 = 0x811c9dc5 ^ timeStep;
  let h2 = 0xc2b2ae35 + ((timeStep * 0x27d4eb2d) >>> 0);

  const input = `${SECRET}:${timeStep}`;

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

export function verifyCode(
  code: string,
  windowSeconds = DEFAULT_WINDOW_SECONDS
): boolean {
  if (!/^\d{4}$/.test(code)) return false;

  const now = new Date();
  // Accept current and previous window (roughly 2 minutes tolerance)
  const offsets = [0, -1];

  return offsets.some((offset) => {
    const time = new Date(now.getTime() + offset * windowSeconds * 1000);
    return generateCode(time, windowSeconds) === code;
  });
}
