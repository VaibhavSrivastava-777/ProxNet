async function test() {
  const url = "https://careers.qorvo.com/sitemap-jobs.xml";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    console.log(`Qorvo Sitemap Status: ${res.status}`);
    const xml = await res.text();
    console.log(`Length: ${xml.length}`);
    const hasUrls = xml.includes("<url>");
    console.log(`Has <url> tags: ${hasUrls}`);
    if (hasUrls) {
      const match = xml.match(/<loc>([^<]+)<\/loc>/);
      console.log(`First loc: ${match ? match[1] : "none"}`);
    }
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
  }
}
test();
