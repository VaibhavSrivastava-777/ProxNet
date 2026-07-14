async function test() {
  const urls = [
    "https://ibegin.tcsapps.com/iBegin/",
    "https://ibegin.tcsapps.com/"
  ];
  for (const url of urls) {
    console.log(`Fetching ${url}...`);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      console.log(`  Response Status: ${res.status}`);
      const text = await res.text();
      console.log(`  Length: ${text.length}`);
    } catch (e: any) {
      console.error(`  Fetch Error:`, e.message || e);
    }
  }
}
test();
