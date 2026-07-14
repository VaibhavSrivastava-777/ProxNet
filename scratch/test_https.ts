import https from "https";

console.log("Starting https.get...");
https.get("https://api.lever.co/v0/postings/meesho?mode=json", (res) => {
  console.log("Status:", res.statusCode);
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    console.log("Data length:", data.length);
    try {
      const parsed = JSON.parse(data);
      console.log("Parsed array length:", Array.isArray(parsed) ? parsed.length : "not an array");
    } catch (e: any) {
      console.error("JSON parse failed:", e.message);
    }
  });
}).on("error", (err) => {
  console.error("Error:", err.message);
});
