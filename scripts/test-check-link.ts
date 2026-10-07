import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GET } from '../app/api/jobs/check-link/route';

async function main() {
  console.log('Testing link verification directly via GET handler...');

  // 1. Test closed Greenhouse job (Bugcrowd) that redirects to careers homepage
  const bugcrowdUrl = 'https://boards.greenhouse.io/bugcrowd/jobs/8174136';
  const req1 = new Request(`https://test.local/api/jobs/check-link?url=${encodeURIComponent(bugcrowdUrl)}&company=Bugcrowd&title=Application+Security+Engineer`);
  const res1 = await GET(req1);
  const data1 = await res1.json();
  console.log('\nBugcrowd (Redirected/Closed ATS link):');
  console.log(data1);

  // 2. Test fake 404 URL
  const fake404Url = 'https://boards.greenhouse.io/notarealcompany123456/jobs/999999999';
  const req2 = new Request(`https://test.local/api/jobs/check-link?url=${encodeURIComponent(fake404Url)}&company=FakeCo&title=Fake+Job`);
  const res2 = await GET(req2);
  const data2 = await res2.json();
  console.log('\n404 Fake URL:');
  console.log(data2);

  // 3. Test active job URL (e.g. Amazon or Lever)
  const activeUrl = 'https://www.amazon.jobs/en/jobs/10558940/software-development-engineer-seller-and-am-genai-tools';
  const req3 = new Request(`https://test.local/api/jobs/check-link?url=${encodeURIComponent(activeUrl)}&company=Amazon&title=Software+Development+Engineer`);
  const res3 = await GET(req3);
  const data3 = await res3.json();
  console.log('\nActive Amazon URL:');
  console.log(data3);
}

main().catch(console.error);
