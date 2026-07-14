async function test() {
  const url = "https://wellsfargo.myworkdayjobs.com/wday/cxs/wellsfargo/wellsfargojobs/jobs";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 10,
        offset: 0,
        searchText: ""
      })
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response Keys:", Object.keys(data));
    console.log("Jobs Count:", data.jobPostings?.length);
    if (data.jobPostings && data.jobPostings.length > 0) {
      console.log("First Job Sample:", JSON.stringify(data.jobPostings[0], null, 2));
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

test();
