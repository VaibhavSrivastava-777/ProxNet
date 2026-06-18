---
name: vercel-production-diagnostic-endpoint
description: Creates and deploys a temporary Next.js API route to diagnose missing Vercel environment variables or database issues directly in production without exposing secrets.
---

# Vercel Production Diagnostic Endpoint

When a Next.js application behaves differently in Vercel production compared to local development (e.g., cron jobs failing, webhooks returning 401, or DB queries failing silently), the issue is often related to missing runtime environment variables (like `CRON_SECRET`) or schema mismatches.

## The Workflow

1.  **Identify the failing area:** Determine which environment variables or database queries are suspected to be failing in production.
2.  **Create a temporary diagnostic route:** Create a new route (e.g., `app/api/diagnostic/route.ts`) that checks for the presence of specific environment variables (`!!process.env.MY_SECRET`) rather than returning their actual values (to prevent leaking secrets). Include small test queries to verify database connectivity and schema relations.
3.  **Deploy to production:** Deploy the application using Vercel CLI (`npx vercel --prod --yes`).
4.  **Fetch the results:** Use `curl` or `Invoke-RestMethod` to hit the newly deployed diagnostic endpoint (e.g., `https://my-app.vercel.app/api/diagnostic`).
5.  **Analyze and Cleanup:** Analyze the JSON response to pinpoint the failure (e.g., `hasCronSecret: false`). Crucially, immediately delete the temporary route from the project and redeploy to clean up.

## Example Diagnostic Route

```typescript
// app/api/diagnostic-cron/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const hasCronSecret = !!process.env.CRON_SECRET;
    
    // Test DB connection without returning sensitive data
    // const { error } = await supabase.from("users").select("id").limit(1);

    return NextResponse.json({
      success: true,
      time: new Date().toISOString(),
      diagnostics: {
        cronSecretPresent: hasCronSecret,
        // dbConnected: !error,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```
