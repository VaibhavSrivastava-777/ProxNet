import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function checkResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not found in environment");
    return;
  }

  console.log("Checking Resend API with key prefix:", apiKey.slice(0, 10));

  // 1. Check API key and list recent sent emails
  try {
    const listRes = await fetch("https://api.resend.com/emails", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    console.log("Resend List Emails HTTP status:", listRes.status);
    const listData = await listRes.json();
    if (listRes.ok) {
      console.log("Total recent emails fetched:", listData?.data?.length);
      console.log("Recent emails sample (up to 5):");
      for (const item of (listData?.data || []).slice(0, 5)) {
        console.log(`- ID: ${item.id}, To: ${JSON.stringify(item.to)}, Subject: "${item.subject}", Created: ${item.created_at}`);
      }
    } else {
      console.error("Failed to list emails:", listData);
    }
  } catch (err) {
    console.error("Error listing emails from Resend:", err);
  }

  // 2. Test sending a direct test email to Vaibhav Srivastava
  const targetEmail = "vaibhav.srivastava@iiml.org";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@proxnet.in";

  console.log(`\nTesting direct email send via Resend to ${targetEmail} from ${fromEmail}...`);
  try {
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ProxNet <${fromEmail}>`,
        to: targetEmail,
        subject: "🔔 ProxNet Diagnostic Test: Email Delivery Verification",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
            <h2 style="color: #0f172a; margin-top: 0;">ProxNet Delivery Verification</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.5;">
              Hi Vaibhav,
            </p>
            <p style="color: #334155; font-size: 15px; line-height: 1.5;">
              This is an automated confirmation verifying that Resend transactional emails are functioning properly for your account (<strong>${targetEmail}</strong>).
            </p>
            <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0;">
              <span style="font-size: 13px; color: #047857; font-weight: bold;">Status: Operational</span><br/>
              <span style="font-size: 12px; color: #64748b;">Timestamp: ${new Date().toISOString()}</span>
            </div>
            <p style="color: #64748b; font-size: 13px;">
              ProxNet Local Professional Networking & Job Referrals
            </p>
          </div>
        `,
      }),
    });

    console.log("Send Email HTTP status:", sendRes.status);
    const sendData = await sendRes.json();
    console.log("Send Email response:", sendData);

    if (sendRes.ok && sendData.id) {
      console.log(`\nEmail successfully submitted! Resend Message ID: ${sendData.id}`);

      // Wait 2 seconds and fetch status
      await new Promise(r => setTimeout(r, 2000));
      const getRes = await fetch(`https://api.resend.com/emails/${sendData.id}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      const getData = await getRes.json();
      console.log("Detailed Email Status from Resend:", {
        id: getData.id,
        to: getData.to,
        from: getData.from,
        subject: getData.subject,
        created_at: getData.created_at,
        last_event: getData.last_event,
      });
    }
  } catch (err) {
    console.error("Error sending test email via Resend:", err);
  }
}

checkResend().catch(console.error);
