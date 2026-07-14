import * as https from "https";

function test() {
  const data = JSON.stringify({
    appliedFacets: {},
    limit: 100,
    offset: 0,
    searchText: ""
  });

  const options = {
    hostname: "wf.wd1.myworkdayjobs.com",
    port: 443,
    path: "/wday/cxs/wf/WellsFargoJobs/jobs",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  };

  const req = https.request(options, (res) => {
    console.log("Status:", res.statusCode);
    let body = "";
    res.on("data", (chunk) => {
      body += chunk;
    });
    res.on("end", () => {
      console.log("Body:", body);
    });
  });

  req.write(data);
  req.end();
}

test();
