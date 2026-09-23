import assert from "assert";
import { searchCompanies, searchDesignations, rankAndFilterSuggestions } from "../lib/data/curated-suggestions";
import { GET as getCompanies } from "../app/api/companies/route";
import { GET as getTitles } from "../app/api/companies/titles/route";
import { parseLinkedInProfile } from "../lib/linkedin/parse-profile";
import { formatLinkedInUrl } from "../lib/linkedin/normalize-url";

async function runTests() {
  console.log("=================================================");
  console.log("TEST SUITE: LinkedIn Parsing & Autocomplete Verification");
  console.log("=================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`  ✓ ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`  ❌ ${name}:`, err.message);
            throw err;
          });
      } else {
        console.log(`  ✓ ${name}`);
        passed++;
      }
    } catch (err: any) {
      console.error(`  ❌ ${name}:`, err.message);
      throw err;
    }
  }

  // 1. Test Company Search & Ranking
  console.log("👉 Group 1: Company Autocomplete Algorithm");

  test('searchCompanies("Goo") returns "Google" as top result', () => {
    const results = searchCompanies("Goo");
    assert(results.length > 0, "Should return results for 'Goo'");
    assert.strictEqual(results[0], "Google", "First result for 'Goo' must be 'Google'");
  });

  test('searchCompanies("Fli") returns "Flipkart"', () => {
    const results = searchCompanies("Fli");
    assert(results.includes("Flipkart"), "Should include Flipkart");
    assert.strictEqual(results[0], "Flipkart", "First result for 'Fli' must be 'Flipkart'");
  });

  test('searchCompanies("Micro") returns "Microsoft"', () => {
    const results = searchCompanies("Micro");
    assert(results.includes("Microsoft"), "Should include Microsoft");
    assert.strictEqual(results[0], "Microsoft", "First result for 'Micro' must be 'Microsoft'");
  });

  test('searchCompanies merges additional DB companies', () => {
    const dbCompanies = ["Googly Innovations", "Google Cloud Partner"];
    const results = searchCompanies("Goo", dbCompanies);
    assert(results.includes("Google"), "Should include curated Google");
    assert(results.includes("Googly Innovations"), "Should include DB company");
  });

  // 2. Test Designation Search & Ranking
  console.log("\n👉 Group 2: Designation Autocomplete Algorithm");

  test('searchDesignations("Soft") returns "Software Engineer" / "Software Development Engineer"', () => {
    const results = searchDesignations("Soft");
    assert(results.length > 0, "Should return results for 'Soft'");
    assert(
      results.some((r) => r.toLowerCase().startsWith("software")),
      "Results must start with Software"
    );
  });

  test('searchDesignations("Prod") returns "Product Manager"', () => {
    const results = searchDesignations("Prod");
    assert(results.includes("Product Manager"), "Should include Product Manager");
  });

  test('searchDesignations("Eng") word-boundary and prefix matching', () => {
    const results = searchDesignations("Eng");
    assert(results.length > 0, "Should return results for 'Eng'");
    assert(
      results.includes("Engineering Manager") || results.some((r) => r.includes("Engineer")),
      "Should include Engineering Manager or roles with Engineer"
    );
  });

  // 3. Test API /api/companies Route Handler
  console.log("\n👉 Group 3: /api/companies API Route");

  await test("GET /api/companies?q=Goo returns JSON with Google", async () => {
    const req = new Request("http://localhost:3000/api/companies?q=Goo");
    const res = await getCompanies(req);
    assert.strictEqual(res.status, 200, "Status must be 200");
    const body = await res.json();
    assert(Array.isArray(body.companies), "Body must contain companies array");
    assert(body.companies.includes("Google"), "Body companies must include Google");
    assert.strictEqual(body.companies[0], "Google", "Top company must be Google");
  });

  await test("GET /api/companies?q=Ama returns Amazon", async () => {
    const req = new Request("http://localhost:3000/api/companies?q=Ama");
    const res = await getCompanies(req);
    const body = await res.json();
    assert(body.companies.includes("Amazon"), "Body companies must include Amazon");
  });

  // 4. Test API /api/companies/titles Route Handler
  console.log("\n👉 Group 4: /api/companies/titles API Route");

  await test("GET /api/companies/titles?q=Soft returns Software Engineer", async () => {
    const req = new Request("http://localhost:3000/api/companies/titles?q=Soft");
    const res = await getTitles(req);
    assert.strictEqual(res.status, 200, "Status must be 200");
    const body = await res.json();
    assert(Array.isArray(body.titles), "Body must contain titles array");
    assert(
      body.titles.some((t: string) => t.toLowerCase().includes("software")),
      "Titles must include software roles"
    );
  });

  await test("GET /api/companies/titles without company returns curated titles instead of empty", async () => {
    const req = new Request("http://localhost:3000/api/companies/titles");
    const res = await getTitles(req);
    assert.strictEqual(res.status, 200, "Status must be 200");
    const body = await res.json();
    assert(body.titles.length > 10, "Should return general curated titles when company is omitted");
  });

  // 5. Test LinkedIn URL Normalization & Validation
  console.log("\n👉 Group 5: LinkedIn URL Handling & Extraction Engine");

  test("formatLinkedInUrl cleans tracking parameters and formats correctly", () => {
    const dirty = "https://www.linkedin.com/in/satyanadella/?utm_source=share&utm_medium=member_desktop";
    const cleaned = formatLinkedInUrl(dirty);
    assert.strictEqual(cleaned, "https://www.linkedin.com/in/satyanadella");
  });

  test("formatLinkedInUrl handles usernames without prefix", () => {
    const raw = "in/satyanadella";
    const cleaned = formatLinkedInUrl(raw);
    assert.strictEqual(cleaned, "https://www.linkedin.com/in/satyanadella");
  });

  await test("parseLinkedInProfile rejects invalid URLs cleanly", async () => {
    const res = await parseLinkedInProfile("not-a-linkedin-url");
    assert.strictEqual(res.success, false, "Should return success: false for invalid URL");
    assert(res.error, "Should include error message");
  });

  console.log(`\n=================================================`);
  console.log(`ALL TESTS PASSED: ${passed}/${total}`);
  console.log(`=================================================`);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
