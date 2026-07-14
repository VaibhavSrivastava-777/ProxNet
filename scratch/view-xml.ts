async function test() {
  const url = "https://careers.qorvo.com/sitemap-jobs.xml";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const xml = await res.text();
    console.log(xml.substring(0, 800));
  } catch (e: any) {
    console.error(e);
  }
}
test();
