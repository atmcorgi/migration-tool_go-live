#!/usr/bin/env node
/**
 * Script để generate OTP code cho admin
 * Chạy: npx tsx scripts/generate-code.ts
 * Hoặc: node --loader ts-node/esm scripts/generate-code.ts
 */

const DEFAULT_WINDOW_SECONDS = 60;

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

// Main
const secret = process.env.MIGRATION_SECRET;

if (!secret) {
  console.error('❌ Error: MIGRATION_SECRET environment variable is not set');
  console.log('\n💡 Usage:');
  console.log('   MIGRATION_SECRET=your-secret npx tsx scripts/generate-code.ts');
  console.log('   hoặc');
  console.log('   export MIGRATION_SECRET=your-secret');
  console.log('   npx tsx scripts/generate-code.ts');
  process.exit(1);
}

const now = new Date();
const currentCode = generateCode(now, DEFAULT_WINDOW_SECONDS, secret);
const nextWindowTime = new Date(now.getTime() + DEFAULT_WINDOW_SECONDS * 1000);
const nextCode = generateCode(nextWindowTime, DEFAULT_WINDOW_SECONDS, secret);

console.log('\n🔐 OTP Code Generator\n');
console.log(`Current time: ${now.toISOString()}`);
console.log(`Current code: ${currentCode}`);
console.log(`Valid until: ${new Date(now.getTime() + DEFAULT_WINDOW_SECONDS * 1000).toISOString()}`);
console.log(`\nNext code (for reference): ${nextCode}`);
console.log(`Next code valid from: ${nextWindowTime.toISOString()}\n`);

