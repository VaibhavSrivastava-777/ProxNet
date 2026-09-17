import fs from "fs";
import path from "path";
import assert from "assert";

console.log("==================================================");
console.log("TEST: Chat Input Height & Viewport Blank Space Fixes");
console.log("==================================================");

// 1. Verify NavClient.tsx isChatRoom detection
const navClientPath = path.resolve(__dirname, "../components/NavClient.tsx");
const navClientCode = fs.readFileSync(navClientPath, "utf-8");

assert(
  navClientCode.includes('pathname.startsWith("/chat/")') &&
  navClientCode.includes('pathname.startsWith("/jobs/chat/")') &&
  navClientCode.includes('pathname.startsWith("/carpool/chat/")'),
  "NavClient isChatRoom must check /chat/, /jobs/chat/, and /carpool/chat/"
);
console.log("✓ NavClient: isChatRoom correctly hides mobile nav/header across all chat routes");

// 2. Verify app/layout.tsx viewport configuration
const layoutPath = path.resolve(__dirname, "../app/layout.tsx");
const layoutCode = fs.readFileSync(layoutPath, "utf-8");

assert(
  layoutCode.includes('interactiveWidget: "resizes-content"'),
  "app/layout.tsx viewport must include interactiveWidget: 'resizes-content'"
);
console.log("✓ app/layout.tsx: Viewport includes interactiveWidget: 'resizes-content'");

// 3. Verify app/globals.css .chat-textarea class
const globalsCssPath = path.resolve(__dirname, "../app/globals.css");
const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

assert(
  globalsCss.includes(".chat-textarea") &&
  globalsCss.includes("min-height: 40px !important") &&
  globalsCss.includes("max-height: 120px"),
  "app/globals.css must define .chat-textarea with min-height: 40px !important"
);
console.log("✓ globals.css: .chat-textarea defined with 40px base height, bypassing 80px default");

// 4. Verify ChatRoom.tsx WhatsApp input and viewport handling
const chatRoomPath = path.resolve(__dirname, "../components/chat/ChatRoom.tsx");
const chatRoomCode = fs.readFileSync(chatRoomPath, "utf-8");

assert(chatRoomCode.includes("viewportTop"), "ChatRoom must manage viewportTop");
assert(chatRoomCode.includes("vv.offsetTop"), "ChatRoom must track vv.offsetTop");
assert(chatRoomCode.includes('document.body.style.position = "fixed"'), "ChatRoom must lock body with position: fixed");
assert(chatRoomCode.includes("style={{ height: viewportHeight, top: viewportTop }}"), "ChatRoom container must use viewportHeight and viewportTop");
assert(chatRoomCode.includes("h-10 min-h-[40px] max-h-[120px] rounded-[20px]"), "ChatRoom textarea must use 40px matching height");
assert(chatRoomCode.includes("w-10 h-10 mb-0 flex items-center justify-center rounded-full"), "ChatRoom send button must be 40px matching circle");
console.log("✓ ChatRoom.tsx: Viewport offset tracking, fixed body lock, and 40px WhatsApp layout validated");

// 5. Verify JobChatRoom.tsx WhatsApp input and viewport handling
const jobChatRoomPath = path.resolve(__dirname, "../components/jobs/JobChatRoom.tsx");
const jobChatRoomCode = fs.readFileSync(jobChatRoomPath, "utf-8");

assert(jobChatRoomCode.includes("viewportTop"), "JobChatRoom must manage viewportTop");
assert(jobChatRoomCode.includes("vv.offsetTop"), "JobChatRoom must track vv.offsetTop");
assert(jobChatRoomCode.includes('document.body.style.position = "fixed"'), "JobChatRoom must lock body with position: fixed");
assert(jobChatRoomCode.includes("style={{ height: viewportHeight, top: viewportTop }}"), "JobChatRoom container must use viewportHeight and viewportTop");
assert(jobChatRoomCode.includes("h-10 min-h-[40px] max-h-[120px] rounded-[20px]"), "JobChatRoom textarea must use 40px matching height");
assert(jobChatRoomCode.includes("w-10 h-10 mb-0 flex items-center justify-center rounded-full"), "JobChatRoom send button must be 40px matching circle");
console.log("✓ JobChatRoom.tsx: Viewport offset tracking, fixed body lock, and 40px WhatsApp layout validated");

// 6. Verify CarpoolChatRoom.tsx WhatsApp input
const carpoolChatRoomPath = path.resolve(__dirname, "../components/carpool/CarpoolChatRoom.tsx");
const carpoolChatRoomCode = fs.readFileSync(carpoolChatRoomPath, "utf-8");

assert(carpoolChatRoomCode.includes("h-10 min-h-[40px] max-h-[120px] rounded-[20px]"), "CarpoolChatRoom textarea must use 40px matching height");
assert(carpoolChatRoomCode.includes("w-10 h-10 mb-0 flex items-center justify-center rounded-full"), "CarpoolChatRoom send button must be 40px matching circle");
console.log("✓ CarpoolChatRoom.tsx: 40px WhatsApp layout validated");

console.log("\nALL 6 VALIDATION CHECKS PASSED SUCCESSFULLY!");
