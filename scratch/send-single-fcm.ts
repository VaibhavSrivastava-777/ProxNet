import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { sendNotification } from "../lib/notifications";

async function main() {
  const targetUserId = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";
  console.log(`Sending test FCM to user: ${targetUserId}...`);
  try {
    await sendNotification(targetUserId, {
      title: "ProxNet Test Message",
      body: "This is a direct test FCM message from the ProxNet development team.",
      url: "/"
    });
    console.log("FCM notification dispatched successfully!");
  } catch (e) {
    console.error("FCM dispatch failed:", e);
  }
}

main().catch(console.error);
