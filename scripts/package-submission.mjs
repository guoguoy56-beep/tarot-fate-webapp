#!/usr/bin/env node
/**
 * 毕业设计源码交付打包脚本。
 *
 * 从当前工作区生成一份干净、可运行、可复现的源码副本：
 * 只复制白名单内的源码、测试、静态资源与工程配置，
 * 排除依赖目录、构建产物、运行时数据库、本机凭据与过程产物。
 *
 * 用法：node scripts/package-submission.mjs
 * 产出：output/submission/tarot-fate-webapp-src/
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";

const projectRoot = resolve(import.meta.dirname, "..");
const submissionRoot = join(projectRoot, "output", "submission");
const packageName = "tarot-fate-webapp-src";
const stageDir = join(submissionRoot, packageName);

/** 顶层单文件白名单：工程配置与说明文档。 */
const FILE_ENTRIES = [
  "README.md",
  "SUBMISSION-README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "eslint.config.mjs",
  "vitest.config.mts",
  "playwright.config.ts",
  "playwright.auth.config.ts",
  "next-env.d.ts",
  ".nvmrc",
  ".npmrc",
  ".env.example",
  ".gitignore",
];

/** 顶层目录白名单：可选扩展名或文件名过滤。 */
const TREE_ENTRIES = [
  { path: "src" },
  { path: "tests" },
  { path: "scripts", files: new Set(["demo.mjs"]) },
  { path: "public" },
  { path: "ProjectDocument", extensions: new Set([".md"]) },
];

/** 任何层级都拒绝的目录名（注意：不得包含 src/data 这类业务目录）。 */
const DENIED_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".next-dev",
  ".git",
  ".playwright-cli",
  "output",
  "coverage",
  "kit",
  "handoff_inspect",
]);

/** 任何层级都拒绝的文件名模式。 */
const DENIED_FILE_PATTERNS = [
  /^\.env\.local$/,
  /^\.env\..+\.local$/,
  /\.sqlite$/,
  /\.sqlite-(shm|wal)$/,
  /^accounts\.json$/,
  /^\.auth-secret$/,
  /\.log$/,
  /^tsconfig\.tsbuildinfo$/,
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
];

function buildFilter({ extensions, files } = {}) {
  return (source) => {
    const name = basename(source);
    if (DENIED_DIR_NAMES.has(name)) return false;
    if (DENIED_FILE_PATTERNS.some((pattern) => pattern.test(name))) return false;
    if (!statSync(source).isFile()) return true;
    if (files && !files.has(name)) return false;
    if (extensions && !extensions.has(extname(name).toLowerCase())) return false;
    return true;
  };
}

function copyTree(entry) {
  const source = join(projectRoot, entry.path);
  if (!existsSync(source)) {
    throw new Error(`交付清单中的路径不存在：${entry.path}`);
  }
  cpSync(source, join(stageDir, entry.path), {
    recursive: true,
    filter: buildFilter(entry),
  });
}

function copyFile(relativePath) {
  const source = join(projectRoot, relativePath);
  if (!existsSync(source)) {
    throw new Error(`交付清单中的文件不存在：${relativePath}`);
  }
  cpSync(source, join(stageDir, relativePath));
}

function removeEmptyDirectories(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = join(directory, entry.name);
    removeEmptyDirectories(child);
    if (readdirSync(child).length === 0) rmSync(child, { recursive: true, force: true });
  }
}

function walk(directory, collected = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, collected);
    else collected.push(fullPath);
  }
  return collected;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** 交付前自检：任何命中都视为打包失败，避免隐私数据外泄。 */
function assertNoSensitiveFiles(files) {
  const violations = files.filter((file) => {
    const name = basename(file);
    return DENIED_FILE_PATTERNS.some((pattern) => pattern.test(name));
  });
  if (violations.length > 0) {
    throw new Error(`交付目录中出现禁止分发的文件：\n${violations.join("\n")}`);
  }

  const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".css", ".example", ".txt"]);
  const codeExtensions = new Set([".ts", ".tsx", ".js", ".mjs"]);
  for (const file of files) {
    const extension = extname(file).toLowerCase();
    if (!textExtensions.has(extension)) continue;
    const content = readFileSync(file, "utf8");
    if (/sk-[A-Za-z0-9]{20,}/.test(content)) {
      throw new Error(`检出疑似 DeepSeek 密钥：${relative(stageDir, file)}`);
    }
    if (codeExtensions.has(extension) && /[A-Za-z]:[\\/](?:毕业设计|Users[\\/][^\s"']+)/.test(content)) {
      throw new Error(`检出本机绝对路径：${relative(stageDir, file)}`);
    }
  }
}

function writeManifest(files, totalBytes) {
  const lines = [
    "命运回廊 Tarot Fate WebApp —— 毕业设计源码交付清单",
    `生成时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    `文件总数：${files.length}`,
    `总大小：${totalBytes} 字节（${formatBytes(totalBytes)}）`,
    "",
    "说明：路径相对于本包根目录；SHA-256 可用于校验传输完整性。",
    "",
    "SHA-256                                                          字节数\t路径",
  ];
  for (const file of files) {
    const content = readFileSync(file);
    const hash = createHash("sha256").update(content).digest("hex");
    const size = statSync(file).size;
    lines.push(`${hash}  ${String(size).padStart(9)}\t${relative(stageDir, file).split(sep).join("/")}`);
  }
  writeFileSync(join(stageDir, "DELIVERY-MANIFEST.txt"), `${lines.join("\n")}\n`, "utf8");
}

function main() {
  if (existsSync(stageDir)) rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });

  for (const file of FILE_ENTRIES) copyFile(file);
  for (const entry of TREE_ENTRIES) copyTree(entry);
  removeEmptyDirectories(stageDir);

  const files = walk(stageDir);
  assertNoSensitiveFiles(files);

  const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  writeManifest(files, totalBytes);

  const manifestBytes = statSync(join(stageDir, "DELIVERY-MANIFEST.txt")).size;
  console.log("交付目录已生成：", stageDir);
  console.log(`文件数：${files.length + 1}（含清单）`);
  console.log(`体积：${formatBytes(totalBytes + manifestBytes)}`);
  for (const entry of ["src", "tests", "public", "ProjectDocument"]) {
    const directory = join(stageDir, entry);
    if (!existsSync(directory)) continue;
    const nested = walk(directory);
    const bytes = nested.reduce((sum, file) => sum + statSync(file).size, 0);
    console.log(`  ${entry.padEnd(18)}${String(nested.length).padStart(4)} 个文件  ${formatBytes(bytes)}`);
  }
}

main();
