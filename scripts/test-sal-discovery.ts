import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { discoverAts } from "../lib/ats-discovery";

async function testSalDiscovery() {
  console.log("Discovering ATS for Sal Securities...");
  const res = await discoverAts("Sal Securities");
  console.log("Discovery result:", res);
}

testSalDiscovery().catch(console.error);
