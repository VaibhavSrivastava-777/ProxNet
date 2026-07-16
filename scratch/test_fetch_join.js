async function test() {
  console.log("Fetching http://localhost:3001/join/PX-G2xLZa (following redirects)...");
  try {
    const res = await fetch("http://localhost:3001/join/PX-G2xLZa");
    console.log("Final Status:", res.status);
    console.log("Final URL:", res.url);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

test();
