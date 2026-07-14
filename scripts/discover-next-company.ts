import { discoverAts } from "../lib/ats-discovery";

async function run() {
  const companies = [
    "Accenture",
    "Optum",
    "Rakuten India",
    "EY",
    "Coverself",
    "Fitsol",
    "Farcast Biosciences",
    "Verint systems",
    "Diageo"
  ];

  for (const c of companies) {
    console.log(`Discovering ATS for "${c}"...`);
    const res = await discoverAts(c);
    if (res) {
      console.log(`🎉 Found! Company: ${c}, Provider: ${res.provider}, Token/URL: ${res.board}`);
    } else {
      console.log(`❌ No board found for ${c}`);
    }
  }
}

run();
