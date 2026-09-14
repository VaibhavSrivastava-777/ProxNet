import { generateContextEmail } from "../lib/email-templates";

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@proxnet.in";
  const targetEmail = process.argv[2] || "kaayastha@gmail.com";

  if (!apiKey) {
    console.error("❌ RESEND_API_KEY missing");
    process.exit(1);
  }

  console.log(`Sending context-specific test email to ${targetEmail}...`);

  // Test Profile Reminder with Clubbed Activity
  const email = generateContextEmail({
    recipientName: "Vaibhav",
    recipientEmail: targetEmail,
    title: "📝 Complete your ProxNet profile",
    body: "Add your designation, company, and location to get discovered by professional neighbors.",
    url: "/profile",
    data: { type: "profile_reminder" },
    otherUnreadNotifs: [
      {
        id: "1",
        title: "🔥 Strong Job Match (92%): Staff SRE at Google",
        body: "Strong match based on your Kubernetes and Distributed Systems experience.",
        url: "/jobs?jobId=123",
      },
      {
        id: "2",
        title: "📍 Meetup in 2 Days: Bangalore Cloud Native",
        body: "Happening at Indiranagar 6:00 PM. Tap to RSVP!",
        url: "/event/456",
      },
    ],
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `ProxNet <${fromEmail}>`,
      to: targetEmail,
      subject: email.subject,
      html: email.html,
    }),
  });

  const result = await res.json();
  if (res.ok) {
    console.log(`✅ Live context email delivered successfully! Resend ID: ${result.id}`);
  } else {
    console.error("❌ Resend error:", result);
  }
}

main().catch(console.error);
