import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

async function run() {
  if (!connectionString) {
    console.error("No DATABASE_URL or POSTGRES_URL environment variable found.");
    process.exit(1);
  }
  console.log("Running migration via pg pool...");
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  await pool.query("ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false;");
  console.log("SUCCESS: Added is_edited column to questions table in Supabase DB.");
  await pool.end();
}

run().catch((err) => {
  console.error("Migration error:", err.message);
  process.exit(1);
});
