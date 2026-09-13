import "dotenv/config";

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  console.log("=========================================");
  console.log("  PROXNET RESEND DIAGNOSTIC & TEST TOOL  ");
  console.log("=========================================");

  if (!apiKey) {
    console.error("❌ RESEND_API_KEY is not set in environment.");
    process.exit(1);
  }

  console.log(`✅ API Key detected: ${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`);
  console.log(`📧 Sender: ${fromEmail}`);

  // 1. Check API Key validity
  console.log("\n[1/3] Validating API key against Resend...");
  try {
    const keyRes = await fetch("https://api.resend.com/api-keys", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!keyRes.ok) {
      console.error(`❌ API key validation failed (HTTP ${keyRes.status}):`, await keyRes.text());
      return;
    }
    const keyData = await keyRes.json();
    console.log("✅ API key is valid. Registered keys:", keyData.data?.length || 0);
  } catch (err) {
    console.error("❌ Network error checking API key:", err);
    return;
  }

  // 2. Check domain verification status
  console.log("\n[2/3] Checking domains in Resend account...");
  try {
    const domainRes = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (domainRes.ok) {
      const domainData = await domainRes.json();
      console.log(`Found ${domainData.data?.length || 0} registered domain(s):`);
      for (const d of domainData.data || []) {
        console.log(`  • Domain: ${d.name} (${d.status})`);
        
        // Trigger verify endpoint
        await fetch(`https://api.resend.com/domains/${d.id}/verify`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
        }).catch(() => {});

        // Fetch detailed domain with DNS records
        const detailRes = await fetch(`https://api.resend.com/domains/${d.id}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (detailRes.ok) {
          const detail = await detailRes.json();
          console.log(`    Status: ${detail.status}`);
          if (detail.records && detail.records.length > 0) {
            console.log("    DNS Records Verification Status:");
            for (const r of detail.records) {
              const icon = r.status === "verified" ? "✅" : (r.status === "failed" ? "❌" : "⏳");
              console.log(`      ${icon} [${r.type}] ${r.name} -> status: ${r.status}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("⚠️ Could not list domains:", err);
  }

  // 3. Send test email to account owner or custom recipient
  const targetEmail = process.argv[2] || "kaayastha@gmail.com";
  console.log(`\n[3/3] Sending test email to ${targetEmail}...`);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ProxNet <${fromEmail}>`,
        to: targetEmail,
        subject: "🎉 ProxNet Resend Integration Test",
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0A66C2;">ProxNet Email System Active</h2>
            <p style="font-size: 15px; color: #334155; line-height: 1.5;">
              This is a test notification confirming that the Resend email fallback integration is configured and running.
            </p>
            <div style="margin: 20px 0;">
              <a href="https://www.proxnet.in" style="background: #0A66C2; color: #fff; padding: 10px 20px; border-radius: 9999px; text-decoration: none; font-weight: bold;">
                Open ProxNet
              </a>
            </div>
            <p style="font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px;">
              ProxNet Notifications &bull; Sent via Resend API
            </p>
          </div>
        `,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("❌ Send failed:", JSON.stringify(result, null, 2));
      if (res.status === 403) {
        console.log("\nℹ️  Note: In Resend sandbox mode (onboarding@resend.dev), emails can only be sent to the account owner's email (kaayastha@gmail.com).");
        console.log("   To send to any recipient, complete domain verification for proxnet.in.");
      }
    } else {
      console.log(`✅ Email sent successfully! Message ID: ${result.id}`);
    }
  } catch (err) {
    console.error("❌ Error sending test email:", err);
  }

  console.log("\n=========================================");
}

main().catch(console.error);
