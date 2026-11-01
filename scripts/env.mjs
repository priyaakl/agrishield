// Load .env.local first (same file Next.js uses), then .env
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
export function need(name) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
    process.exit(1);
  }
  return process.env[name];
}
