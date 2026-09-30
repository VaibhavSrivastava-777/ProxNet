import fs from "fs";
import path from "path";

function runTest() {
  console.log("==================================================================");
  console.log("   TEST SUITE: WHATSAPP-STYLE CHAT ALIGNMENT & BUBBLE STYLING");
  console.log("==================================================================\n");

  let allPassed = true;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (details) console.error(`     Details: ${details}`);
      allPassed = false;
    }
  }

  // 1. Direct Chat: ChatRoom.tsx
  console.log("1. Checking Direct Chat (ChatRoom.tsx)...");
  const chatRoomPath = path.join(process.cwd(), "components", "chat", "ChatRoom.tsx");
  const chatRoomCode = fs.readFileSync(chatRoomPath, "utf-8");

  assert(
    chatRoomCode.includes('w-full flex ${m.isOwn ? "justify-end" : "justify-start"}'),
    "ChatRoom wraps messages in full-width row with dynamic justify-end / justify-start",
    "Sent messages must align right (justify-end) and received left (justify-start)"
  );
  assert(
    chatRoomCode.includes('flex flex-col max-w-[85%] sm:max-w-[75%] ${isNew ? "animate-fadeInUp" : ""} ${'),
    "ChatRoom sizes bubble column with max-w-[85%] sm:max-w-[75%] (without rigid w-full)",
    "Prevents short messages from stretching or aligning to left of container"
  );
  assert(
    chatRoomCode.includes('flex items-center gap-1.5 max-w-full ${m.isOwn ? "justify-end" : "justify-start"}'),
    "ChatRoom inner bubble wrapper correctly justifies sent messages to end",
    "Ensures bubble hugs the right edge for sent messages"
  );
  assert(
    chatRoomCode.includes("var(--whatsapp-bubble-sent)") && chatRoomCode.includes("var(--whatsapp-bubble-received)"),
    "ChatRoom applies signature WhatsApp bubble colors for sent & received messages"
  );

  // 2. Job Referral Chat: JobChatRoom.tsx
  console.log("\n2. Checking Job Referral Chat (JobChatRoom.tsx)...");
  const jobChatRoomPath = path.join(process.cwd(), "components", "jobs", "JobChatRoom.tsx");
  const jobChatRoomCode = fs.readFileSync(jobChatRoomPath, "utf-8");

  assert(
    jobChatRoomCode.includes("const isMe = m.isOwn ?? (m.sender_id === userId);"),
    "JobChatRoom evaluates isMe using both m.isOwn and m.sender_id === userId"
  );
  assert(
    jobChatRoomCode.includes('w-full flex ${isMe ? "justify-end" : "justify-start"}'),
    "JobChatRoom wraps messages in full-width row with justify-end / justify-start",
    "Sent messages must be on the right, received on the left"
  );
  assert(
    jobChatRoomCode.includes('flex flex-col max-w-[85%] sm:max-w-[75%] ${'),
    "JobChatRoom sizes bubble column responsive with max-w-[85%] sm:max-w-[75%]"
  );
  assert(
    jobChatRoomCode.includes('flex items-center gap-1.5 max-w-full ${isMe ? "justify-end" : "justify-start"}'),
    "JobChatRoom aligns bubble to right edge when isMe is true"
  );
  assert(
    jobChatRoomCode.includes("var(--whatsapp-bubble-sent)") && jobChatRoomCode.includes("var(--whatsapp-bubble-received)"),
    "JobChatRoom applies signature WhatsApp bubble colors for sent & received messages"
  );

  // 3. Job Chat API: route.ts
  console.log("\n3. Checking Job Chat API Route (/api/jobs/chat/[threadId])...");
  const jobChatApiPath = path.join(process.cwd(), "app", "api", "jobs", "chat", "[threadId]", "route.ts");
  const jobChatApiCode = fs.readFileSync(jobChatApiPath, "utf-8");

  assert(
    jobChatApiCode.includes("isOwn: m.sender_id === user.id"),
    "Job Chat API route sets isOwn property for every returned message"
  );

  // 4. Carpool Chat: CarpoolChatRoom.tsx
  console.log("\n4. Checking Carpool Chat (CarpoolChatRoom.tsx)...");
  const carpoolChatRoomPath = path.join(process.cwd(), "components", "carpool", "CarpoolChatRoom.tsx");
  const carpoolChatRoomCode = fs.readFileSync(carpoolChatRoomPath, "utf-8");

  assert(
    carpoolChatRoomCode.includes('w-full flex ${m.isOwn ? "justify-end" : "justify-start"}'),
    "CarpoolChatRoom wraps messages in full-width row with justify-end / justify-start",
    "Sent messages must be on the right, received on the left"
  );
  assert(
    carpoolChatRoomCode.includes('flex flex-col max-w-[85%] sm:max-w-[75%] ${'),
    "CarpoolChatRoom sizes bubble container with max-w-[85%] sm:max-w-[75%]"
  );
  assert(
    carpoolChatRoomCode.includes('flex items-center gap-1.5 max-w-full ${m.isOwn ? "justify-end" : "justify-start"}'),
    "CarpoolChatRoom aligns bubble to right edge when m.isOwn is true"
  );
  assert(
    carpoolChatRoomCode.includes("var(--whatsapp-bubble-sent)") && carpoolChatRoomCode.includes("var(--whatsapp-bubble-received)"),
    "CarpoolChatRoom applies signature WhatsApp bubble colors for sent & received messages"
  );

  // 5. ProxNet AI Chat: app/proxnet-ai/page.tsx
  console.log("\n5. Checking ProxNet AI Chat (app/proxnet-ai/page.tsx)...");
  const aiChatPath = path.join(process.cwd(), "app", "proxnet-ai", "page.tsx");
  const aiChatCode = fs.readFileSync(aiChatPath, "utf-8");

  assert(
    aiChatCode.includes('w-full flex ${isOwn ? "justify-end" : "justify-start"}'),
    "ProxNet AI chat wraps messages in full-width row with dynamic justify-end / justify-start",
    "User prompt messages must align right, AI answers must align left"
  );
  assert(
    aiChatCode.includes('flex flex-col max-w-[85%] sm:max-w-[75%] ${'),
    "ProxNet AI chat sizes bubble container with max-w-[85%] sm:max-w-[75%]"
  );
  assert(
    aiChatCode.includes('flex items-center gap-1.5 max-w-full ${isOwn ? "justify-end" : "justify-start"}'),
    "ProxNet AI chat inner bubble wrapper justifies user messages to the right"
  );
  assert(
    aiChatCode.includes("var(--whatsapp-bubble-sent)") && aiChatCode.includes("var(--whatsapp-bubble-received)"),
    "ProxNet AI chat applies signature WhatsApp bubble colors for sent & received messages"
  );

  // 6. WhatsApp CSS Tokens: globals.css
  console.log("\n6. Checking WhatsApp CSS variables (app/globals.css)...");
  const globalsCssPath = path.join(process.cwd(), "app", "globals.css");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

  assert(
    globalsCss.includes("--whatsapp-bubble-sent: #d9fdd3;") && globalsCss.includes("--whatsapp-bubble-received: #ffffff;"),
    "Light theme has WhatsApp sent bubble (#d9fdd3) and received bubble (#ffffff)"
  );
  assert(
    globalsCss.includes("--whatsapp-bubble-sent: #005c4b;") && globalsCss.includes("--whatsapp-bubble-received: #202c33;"),
    "Dark theme has WhatsApp sent bubble (#005c4b) and received bubble (#202c33)"
  );
  assert(
    globalsCss.includes(".whatsapp-chat-bg"),
    "WhatsApp background pattern class (.whatsapp-chat-bg) is configured"
  );

  console.log("\n==================================================================");
  if (allPassed) {
    console.log("   🎉 ALL CHAT ALIGNMENT & WHATSAPP STYLING TESTS PASSED!");
    console.log("==================================================================");
    process.exit(0);
  } else {
    console.error("   ❌ SOME CHAT ALIGNMENT TESTS FAILED!");
    console.log("==================================================================");
    process.exit(1);
  }
}

runTest();
