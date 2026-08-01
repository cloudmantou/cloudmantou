import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function copyDirectory(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`构建产物目录不存在: ${source}`);
  }

  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}

copyDirectory(
  resolve(root, ".next/static"),
  resolve(root, ".next/standalone/.next/static")
);
copyDirectory(
  resolve(root, "public"),
  resolve(root, ".next/standalone/public")
);

console.log("standalone static/public 产物已准备完成");
