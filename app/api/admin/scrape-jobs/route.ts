import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = await getAdminSession();
  
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  
  // 1. Get unique companies from users table
  const { data: users, error } = await supabase
    .from("users")
    .select("company")
    .not("company", "is", null);
    
  if (error || !users) {
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
  }
  
  // Create a lowercase set of target companies for filtering
  const targetCompanies = new Set(users.map(u => (u.company as string).toLowerCase().trim()).filter(Boolean));
  if (targetCompanies.size === 0) {
    return NextResponse.json({ success: true, totalAdded: 0, message: "No companies found in ProxNet" });
  }

  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_TOKEN is missing in environment" }, { status: 500 });
  }

  // 2. Trigger Apify Actor synchronously (run and wait for dataset)
  // We pass the companies as keywords to heavily restrict what Apify returns
  const keywords = Array.from(targetCompanies);
  
  const apifyInput = {
    "aiHasSalary": false,
    "aiVisaSponsorshipFilter": false,
    "hasSalary": false,
    "includeCompanyDetails": false,
    "includeLinkedIn": false,
    "populateAiRemoteLocation": false,
    "populateAiRemoteLocationDerived": false,
    "remote only (legacy)": false,
    "removeAgency": false,
    "timeRange": "14d",
    "limit": 1000, // Fetch a large batch to increase chances of matching local companies
    "descriptionType": "text"
  };

  let datasetItems: any[] = [];
  try {
    // Call the synchronous run-sync-get-dataset-items endpoint
    const apifyRes = await fetch(`https://api.apify.com/v2/acts/fantastic-jobs~career-site-job-listing-api/run-sync-get-dataset-items?token=${APIFY_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apifyInput)
    });
    
    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      return NextResponse.json({ error: "Apify failed", details: errText }, { status: 500 });
    }
    
    datasetItems = await apifyRes.json();
  } catch (e) {
    return NextResponse.json({ error: "Apify request failed", details: String(e) }, { status: 500 });
  }

  let totalAdded = 0;
  
  // 3. Process jobs and generate embeddings
  for (const job of datasetItems) {
    // Extra safety: make sure the job actually belongs to one of our companies
    const jobOrg = (job.organization || "").toLowerCase().trim();
    
    // Simple matching
    let isMatch = false;
    for (const tc of targetCompanies) {
      if (jobOrg.includes(tc) || tc.includes(jobOrg)) {
        isMatch = true;
        break;
      }
    }
    
    if (!isMatch) continue;

    // Generate Embedding using OpenAI
    let embedding = null;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    
    if (OPENAI_KEY && job.title && job.description_text) {
      try {
        const textToEmbed = `Title: ${job.title}\nCompany: ${job.organization}\nDescription: ${job.description_text}`.slice(0, 8000); 
        const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input: textToEmbed,
            model: "text-embedding-3-small"
          })
        });
        
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          if (oaiData.data && oaiData.data.length > 0) {
            embedding = oaiData.data[0].embedding;
          }
        }
      } catch(e) {
        console.error("OpenAI embedding failed", e);
      }
    }

    const location = (job.locations_alt && job.locations_alt.length > 0) 
                     ? job.locations_alt[0] 
                     : "Remote";

    const { error: insertError } = await supabase.from("scraped_jobs").upsert({
      company: job.organization,
      title: job.title,
      location: location,
      url: job.url,
      description: job.description_text,
      ats_source: job.source || "apify",
      posted_at: job.date_posted || null,
      embedding: embedding // Requires pgvector extension in Supabase
    }, { onConflict: "url" });
    
    if (!insertError) {
      totalAdded++;
    }
  }

  return NextResponse.json({ success: true, totalAdded, totalProcessed: datasetItems.length });
}
