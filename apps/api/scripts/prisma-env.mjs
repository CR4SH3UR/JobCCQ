import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const usesDefaultDatabase = !process.env.DATABASE_URL;
const env = {
  ...process.env,
  DATABASE_URL: usesDefaultDatabase ? "file:./dev.db" : process.env.DATABASE_URL,
};

if (usesDefaultDatabase && args[0] === "db" && args[1] === "push") {
  const sqlitePath = fileURLToPath(new URL("../dev.db", import.meta.url));
  if (!existsSync(sqlitePath)) writeFileSync(sqlitePath, "");
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["prisma", ...args, "--schema", "prisma/schema.prisma"], {
  cwd: apiRoot,
  env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
