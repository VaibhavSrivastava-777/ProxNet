import { SignJWT } from "jose";

async function main() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("❌ NEXTAUTH_SECRET is missing");
    process.exit(1);
  }

  const token = await new SignJWT({ adminId: "admin", suId: "admin", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));

  console.log("Invoking 9 AM Morning Reminders Cron with signed Admin Session...");
  const res = await fetch("https://www.proxnet.in/api/cron/morning-reminders", {
    method: "POST",
    headers: {
      "Cookie": `admin_session=${token}`,
      "Content-Type": "application/json",
    },
  });

  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  // Also check Monday 9 AM Job Digest Cron (since today is Monday!)
  console.log("\nInvoking Monday 9 AM Job Digest Cron with signed Admin Session...");
  const digestRes = await fetch("https://www.proxnet.in/api/cron/job-digest", {
    method: "POST",
    headers: {
      "Cookie": `admin_session=${token}`,
      "Content-Type": "application/json",
    },
  });
  console.log("Job Digest Status:", digestRes.status);
  const digestData = await digestRes.json();
  console.log("Job Digest Response:", JSON.stringify(digestData, null, 2));
}

main().catch(console.error);
