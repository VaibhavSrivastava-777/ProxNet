import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function inspectDellOracleFields() {
  const host = "https://iawmqy.fa.ocs.oraclecloud.com";
  const siteNumber = "careers";
  const apiUrl = `${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?finder=findReqs;siteNumber=${siteNumber}&expand=all&limit=2`;

  const res = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  const data = await res.json();
  const req = data.items?.[0]?.requisitionList?.[0];
  console.log("Keys in requisition:", Object.keys(req || {}));
  console.log("Sample fields:", {
    Id: req?.Id,
    Title: req?.Title,
    PrimaryLocation: req?.PrimaryLocation,
    PostedDate: req?.PostedDate,
    ExternalDescriptionStr: req?.ExternalDescriptionStr?.slice(0, 100),
    ShortDescriptionStr: req?.ShortDescriptionStr,
  });
}

inspectDellOracleFields().catch(console.error);
