import fs from "fs";
import path from "path";
import { db } from "../lib/db";

function readSql(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

async function main() {
  try {
    const migrationsDir = path.join(process.cwd(), "scripts");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.startsWith("migrate-") && f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migrations found.");
      process.exit(0);
    }

    console.log(`Found ${files.length} migration(s):`);
    for (const f of files) console.log(`- ${f}`);

    for (const file of files) {
      const full = path.join(migrationsDir, file);
      console.log(`\nApplying ${file}...`);
      const sql = readSql(full);
      await db.unsafe(sql);
      console.log(`✅ Applied ${file}`);
    }

    console.log("\n✅ All migrations applied.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

main();
