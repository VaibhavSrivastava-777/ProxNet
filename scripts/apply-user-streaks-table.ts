import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

async function run() {
  if (!connectionString) {
    console.error("No DATABASE_URL or POSTGRES_URL found in environment variables.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const sqlPath = path.join(__dirname, "../supabase/migrations/20260930_user_streaks.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");

  console.log("Applying migration 20260930_user_streaks.sql...");
  await pool.query(sqlContent);
  console.log("Migration executed successfully!");

  // Verify
  const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'user_streaks';");
  console.log("Verified table exists:", res.rows);

  await pool.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
