import fs from "fs";
import path from "path";
import { db } from "@/lib/db";

async function main() {
    try {
        const schemaPath = path.join(process.cwd(), "sql/schema.sql");

        if (!fs.existsSync(schemaPath)) {
            console.error("❌ Schema file not found at:", schemaPath);
            process.exit(1);
        }

        console.log("Reading schema from:", schemaPath);
        const schemaParams = fs.readFileSync(schemaPath, "utf8");

        console.log("Applying schema...");

        // postgres.js allows executing simple SQL strings
        // We wrap it in a transaction to ensure atomicity, although for schema it might be partial if error.
        // Given the script contains multiple statements, we can let postgres.js handle it as a simple query string
        // or specifically use the `file` helper if we were using it differently, but direct execution is fine.

        await db.unsafe(schemaParams);

        console.log("✅ Database initialized successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error initializing database:", error);
        process.exit(1);
    }
}

main();
