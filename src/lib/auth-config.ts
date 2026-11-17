import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";

export interface DemoAuthConfig { baseURL: string; secret: string; databasePath: string }

export function getDemoAuthConfig(env: Record<string, string | undefined> = process.env): DemoAuthConfig {
  if (env.TAROT_AUTH_MODE !== "local-demo") throw new Error("Local account demo is not configured.");
  const url = new URL(env.BETTER_AUTH_URL || "");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("The account demo requires an explicit local HTTP origin.");
  }
  const secret = env.BETTER_AUTH_SECRET || "";
  if (secret.length < 32 || new Set(secret).size < 10) throw new Error("A generated authentication secret is required.");
  return { baseURL: url.origin, secret, databasePath: resolve(/* turbopackIgnore: true */ env.TAROT_AUTH_DATABASE_PATH || "data/demo/auth.sqlite") };
}

export async function createAuthRuntime(config: DemoAuthConfig, provisioning = false) {
  mkdirSync(dirname(config.databasePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(config.databasePath);
  chmodSync(config.databasePath, 0o600);
  database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
  const auth = betterAuth({
    appName: "命运回廊",
    baseURL: config.baseURL,
    secret: config.secret,
    database,
    emailAndPassword: { enabled: true, disableSignUp: !provisioning, minPasswordLength: 15, maxPasswordLength: 128 },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 120,
      customRules: { "/sign-in/email": { window: 60, max: 10 } } },
    advanced: { useSecureCookies: false, cookiePrefix: "tarot-demo", ipAddress: { ipAddressHeaders: ["x-tarot-client-ip"] },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" } },
    telemetry: { enabled: false },
    logger: { level: "error" },
  });
  try {
    const migrations = await getMigrations(auth.options);
    await migrations.runMigrations();
    return { auth, close: () => database.close() };
  } catch (error) { database.close(); throw error; }
}
