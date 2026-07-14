async function test() {
  console.log("Starting fetch...");
  try {
    const res = await fetch("https://api.lever.co/v0/postings/meesho?mode=json", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    console.log("Fetch status:", res.status);
    const data = await res.json();
    console.log("Fetch body length:", JSON.stringify(data).length);
  } catch (e: any) {
    console.error("Fetch failed:", e.message);
  }
}
test();
