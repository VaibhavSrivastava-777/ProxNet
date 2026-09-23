import * as fs from "fs";

interface Result {
  company: string;
  provider: string;
  boardTokenOrUrl: string;
  status: "SUCCESS" | "ZERO_JOBS" | "ERROR" | "NO_ATS";
  jobsCount: number;
  sampleJobTitle?: string;
  sampleJobLocation?: string;
  sampleJobUrl?: string;
  error?: string;
  durationMs: number;
}

const raw = fs.readFileSync("scrape_validation_report.json", "utf-8");
const results: Result[] = JSON.parse(raw);

console.log("=== SUCCESSFUL COMPANIES (" + results.filter(r => r.status === "SUCCESS").length + ") ===");
results.filter(r => r.status === "SUCCESS").forEach((r, i) => {
  console.log(`${i + 1}. **${r.company}** [${r.provider}] -> "${r.sampleJobTitle}" (${r.sampleJobLocation})`);
});

console.log("\n=== COMPANIES WITH 0 JOBS RETURNED (" + results.filter(r => r.status === "ZERO_JOBS").length + ") ===");
results.filter(r => r.status === "ZERO_JOBS").forEach((r, i) => {
  console.log(`${i + 1}. **${r.company}** [${r.provider}] -> URL: ${r.boardTokenOrUrl.slice(0, 50)}... Reason: ${r.error || "0 jobs found on portal"}`);
});

console.log("\n=== COMPANIES WITH ERRORS (" + results.filter(r => r.status === "ERROR").length + ") ===");
results.filter(r => r.status === "ERROR").forEach((r, i) => {
  console.log(`${i + 1}. **${r.company}** [${r.provider}] -> ${r.error}`);
});

console.log("\n=== COMPANIES WITH NO ATS DETECTED (" + results.filter(r => r.status === "NO_ATS").length + ") ===");
results.filter(r => r.status === "NO_ATS").forEach((r, i) => {
  console.log(`${i + 1}. **${r.company}**`);
});
