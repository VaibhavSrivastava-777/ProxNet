import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

console.log("FIRECRAWL_API_KEY present:", Boolean(process.env.FIRECRAWL_API_KEY));
console.log("OPENAI_API_KEY present:", Boolean(process.env.OPENAI_API_KEY));
console.log("SERPAPI_API_KEY present:", Boolean(process.env.SERPAPI_API_KEY));
