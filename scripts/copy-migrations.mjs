/**
 * Copia arquivos SQL de migrations para dist/ após compilação TypeScript.
 */

import { cpSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const srcDir = path.resolve("src/db/migrations");
const destDir = path.resolve("dist/db/migrations");

if (!existsSync(srcDir)) {
  console.error("Diretório de migrations não encontrado:", srcDir);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });

for (const file of ["001_initial.sql"]) {
  cpSync(path.join(srcDir, file), path.join(destDir, file));
}

console.log("Migrations copiadas para dist/db/migrations");
