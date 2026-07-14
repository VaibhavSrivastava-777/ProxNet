async function test() {
  const url = "https://hcbt.fa.em2.oraclecloud.com/hcmRestApi/resources/11.13.18.05/recruitingCEJobRequisitions?onlyData=true&finder=findReqs;siteNumber=CX&expand=requisitionList&limit=5";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    console.log(`Status: ${res.status}`);
    if (res.status === 200) {
      const body: any = await res.json();
      console.log("Response body has items:", !!body.items);
      if (body.items && body.items.length > 0) {
        console.log("TotalJobsCount:", body.items[0].TotalJobsCount);
        const requisitions = body.items[0].requisitionList;
        console.log("Requisitions found:", requisitions ? requisitions.length : 0);
        if (requisitions && requisitions.length > 0) {
          console.log("First job title:", requisitions[0].Title);
          console.log("First job location:", requisitions[0].PrimaryLocation);
          console.log("First job Id:", requisitions[0].Id);
        }
      }
    }
  } catch (e: any) {
    console.error(e);
  }
}
test();
