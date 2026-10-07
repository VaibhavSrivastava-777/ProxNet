async function test(name: string, url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    console.log(`${name}: status ${res.status} (${res.statusText})`);
    if (res.ok) {
      const data = await res.json();
      console.log(`  Count: ${Array.isArray(data) ? data.length : (data.jobs?.length || data.content?.length || 0)}`);
    }
  } catch (e: any) {
    console.log(`${name}: error ${e.message}`);
  }
}

async function main() {
  await test("Greenhouse mongodb", "https://boards-api.greenhouse.io/v1/boards/mongodb/jobs");
  await test("Greenhouse mongodbinc", "https://boards-api.greenhouse.io/v1/boards/mongodbinc/jobs");
  await test("Greenhouse gitlab", "https://boards-api.greenhouse.io/v1/boards/gitlab/jobs");
  await test("Greenhouse hashicorp", "https://boards-api.greenhouse.io/v1/boards/hashicorp/jobs");
  await test("Greenhouse rippling", "https://boards-api.greenhouse.io/v1/boards/rippling/jobs");
  await test("Greenhouse stripe", "https://boards-api.greenhouse.io/v1/boards/stripe/jobs");
  await test("Greenhouse atlassian", "https://boards-api.greenhouse.io/v1/boards/atlassian/jobs");
}

main();
