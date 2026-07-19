// Quick check of OG title for job title fallback
const url = "https://www.linkedin.com/in/vaibhavsrivastava777/";
const ua = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

const res = await fetch(url, {
  headers: { "User-Agent": ua, "Accept": "text/html", "Accept-Language": "en-US,en" },
  redirect: "follow",
  signal: AbortSignal.timeout(15000),
});

const html = await res.text();
const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
console.log(`Page Title: "${titleMatch?.[1]?.trim()}"`);

// Extract OG title
const ogRegex = /<meta\s+(?:[^>]*?)?(?:property|name)=["']og:title["'][^>]*?content=["']([^"']+)["']/i;
const ogMatch = html.match(ogRegex);
console.log(`OG Title: "${ogMatch?.[1]}"`);

const ogRevRegex = /<meta\s+(?:[^>]*?)?content=["']([^"']+)["'][^>]*?(?:property|name)=["']og:title["']/i;
const ogRevMatch = html.match(ogRevRegex);
console.log(`OG Title (rev): "${ogRevMatch?.[1]}"`);
