import { ScrapedJob } from "./scrape-strategies";

export async function extractJobsFromMarkdown(
  markdown: string,
  boardUrl: string,
  openaiKey: string
): Promise<ScrapedJob[]> {
  if (!markdown || markdown.trim() === "") return [];

  // Truncate markdown to avoid token limits (first 30k chars is usually enough for 20-50 jobs)
  const truncatedMarkdown = markdown.substring(0, 30000);

  const prompt = `
You are a precise JSON extractor. Extract job postings from the following markdown text scraped from a career page.
For each job, extract:
- title
- location (if not found, use "Remote")
- url (resolve relative URLs using base: ${boardUrl})

Respond ONLY with a JSON object containing a "jobs" array of objects. Do not include markdown formatting or backticks.
Example:
{
  "jobs": [
    {"title": "Software Engineer", "location": "Bengaluru, India", "url": "https://example.com/job/1"}
  ]
}

Markdown to parse:
---
${truncatedMarkdown}
---
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // fast and cheap
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" } // wait, json_object requires the prompt to specify returning an object
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    throw new Error(`OpenAI API failed: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;

  try {
    const parsed = JSON.parse(content);
    let jobs = [];
    if (Array.isArray(parsed)) {
      jobs = parsed;
    } else if (parsed.jobs && Array.isArray(parsed.jobs)) {
      jobs = parsed.jobs;
    } else {
      const values = Object.values(parsed);
      for (const v of values) {
        if (Array.isArray(v)) {
          jobs = v;
          break;
        }
      }
    }

    if (jobs.length === 0) {
      console.warn(`[LLM] Extracted 0 jobs. Markdown preview (first 200 chars): ${markdown.substring(0, 200).replace(/\n/g, ' ')}`);
    }

    return jobs.map((j: any) => ({
      title: j.title || "Unknown",
      location: j.location || "Remote",
      url: j.url || boardUrl,
      posted_at: new Date().toISOString(),
      description: j.title || "",
      source: "firecrawl_markdown_llm"
    }));
  } catch (e) {
    console.error("Failed to parse OpenAI response:", content);
    return [];
  }
}
