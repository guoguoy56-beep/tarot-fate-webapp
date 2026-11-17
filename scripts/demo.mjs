import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { createAuthRuntime, getDemoAuthConfig } from "../src/lib/auth-config.ts";

const action = process.argv[2] || "start";
if (!["start", "dev", "setup"].includes(action)) throw new Error("演示命令仅支持 start、dev 或 setup。");
if (action !== "setup") {
  await new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", () => reject(new Error("3000 端口已被占用或无法监听。请先停止现有预览，再启动演示；当前构建和数据未更改。")));
    probe.listen(3000, "127.0.0.1", () => probe.close(resolvePort));
  });
}

const directory = resolve(process.env.TAROT_DEMO_DATA_DIR || "data/demo");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const secretPath = join(directory, ".auth-secret"), accountsPath = join(directory, "accounts.json");
if (!existsSync(secretPath)) writeFileSync(secretPath, randomBytes(48).toString("base64url"), { flag: "wx", mode: 0o600 });
const env = {
  ...process.env,
  TAROT_AUTH_MODE: "local-demo",
  BETTER_AUTH_URL: "http://127.0.0.1:3000",
  BETTER_AUTH_SECRET: readFileSync(secretPath, "utf8").trim(),
  TAROT_AUTH_DATABASE_PATH: join(directory, "auth.sqlite"),
  TAROT_DATABASE_PATH: join(directory, "journals.sqlite"),
  DEEPSEEK_READING_ENABLED: "false",
  DEEPSEEK_API_KEY: "",
};
const config = getDemoAuthConfig(env);
const initialized = await createAuthRuntime(config, true);
try {
  const existingDatabase = new DatabaseSync(config.databasePath);
  let accounts;
  try {
    if (existsSync(accountsPath)) {
      accounts = JSON.parse(readFileSync(accountsPath, "utf8"));
      if (!Array.isArray(accounts) || accounts.length === 0 || accounts.some((a) => !a || typeof a.name !== "string" || !a.name.trim()
        || typeof a.email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)
        || typeof a.password !== "string" || a.password.length < 12 || a.password.length > 128)
        || new Set(accounts.map((a) => a.email.trim().toLowerCase())).size !== accounts.length) {
        throw new Error("演示账号文件格式无效，请保留数据库与原账号文件后检查。");
      }
    } else {
      const count = existingDatabase.prepare('SELECT count(*) AS count FROM "user"').get().count;
      if (count) throw new Error("账号文件缺失，已保留现有数据库；请恢复原账号文件或使用新的演示目录。");
      accounts = [
        { name: "星旅者", email: "traveler@tarot.example", password: `Tarot-${randomBytes(15).toString("base64url")}` },
        { name: "观星者", email: "stargazer@tarot.example", password: `Tarot-${randomBytes(15).toString("base64url")}` },
      ];
      writeFileSync(accountsPath, JSON.stringify(accounts, null, 2), { flag: "wx", mode: 0o600 });
    }
    for (const account of accounts) {
      if (!existingDatabase.prepare('SELECT id FROM "user" WHERE email = ?').get(account.email)) {
        await initialized.auth.api.signUpEmail({ body: account });
      }
    }
  } finally { existingDatabase.close(); }
} finally { initialized.close(); }

console.log("演示账号已准备，密码仅保存在本机账号文件中：", accountsPath);
console.log("个人手记数据库：", env.TAROT_DATABASE_PATH);
console.log("录屏地址：", env.BETTER_AUTH_URL);

function run(args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolveRun() : reject(new Error(`演示进程退出：${code}`)));
    const stop = () => child.kill();
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
    child.once("exit", () => { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); });
  });
}

if (action !== "setup") {
  const cli = "node_modules/next/dist/bin/next";
  if (action !== "dev") await run([cli, "build"]);
  await run([cli, action === "dev" ? "dev" : "start", "-H", "127.0.0.1", "-p", "3000"]);
}
