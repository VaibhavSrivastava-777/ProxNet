import * as dotenv from "dotenv";
import * as fs from "fs";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function inspectFirecrawlRaw() {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) {
    console.error("No FIRECRAWL_API_KEY");
    return;
  }

  console.log("Fetching Dell markdown from Firecrawl...");
  const dellRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: "https://jobs.dell.com/",
      formats: ["markdown"],
      waitFor: 5000,
    })
  });
  const dellData = await dellRes.json();
  fs.writeFileSync("scripts/dell-markdown.md", dellData.data?.markdown || "NO DATA");
  console.log(`Saved dell-markdown.md (${dellData.data?.markdown?.length || 0} chars)`);

  console.log("Fetching Lenovo markdown from Firecrawl...");
  const lenovoRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: "https://jobs.lenovo.com/",
      formats: ["markdown"],
      waitFor: 5000,
    })
  });
  const lenovoData = await lenovoRes.json();
  fs.writeFileSync("scripts/lenovo-markdown.md", lenovoData.data?.markdown || "NO DATA");
  console.log(`Saved lenovo-markdown.md (${lenovoData.data?.markdown?.length || 0} chars)`);
}

inspectFirecrawlRaw().catch(console.error);
