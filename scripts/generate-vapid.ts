import webPush from "web-push";

const keys = webPush.generateVAPIDKeys();

console.log("\n=======================================================");
console.log("   PROXNET PUSH NOTIFICATIONS VAPID KEYS GENERATED");
console.log("=======================================================\n");
console.log("Add the following keys to your local .env.local file");
console.log("and to your Vercel Project Environment Variables:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
console.log(`NEXT_PUBLIC_VAPID_SUBJECT="mailto:your-email@example.com"\n`);
console.log("=======================================================\n");
