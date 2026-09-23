import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { CREDIT_REWARDS } from "../lib/wallet";

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ ${msg}`);
  } else {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
}

console.log("=== Testing 100% Profile Completeness Reward ===\n");

// 1. Verify CREDIT_REWARDS configuration
assert(CREDIT_REWARDS.profile_100_percent !== undefined, "profile_100_percent is registered in CREDIT_REWARDS");
assert(CREDIT_REWARDS.profile_100_percent.amount === 5, "profile_100_percent grants exactly 5 credits");
assert(CREDIT_REWARDS.profile_100_percent.label.includes("100%"), "Reward label describes 100% profile completion");

// 2. Verify wallet.ts logic
const root = process.cwd();
const walletPath = join(root, "lib", "wallet.ts");
const walletCode = readFileSync(walletPath, "utf-8");
assert(walletCode.includes('reason === "profile_100_percent"'), "wallet.ts checks reason for profile_100_percent");
assert(walletCode.includes("profile_100_reward_claimed"), "wallet.ts tracks profile_100_reward_claimed flag in digest");

// 3. Verify completion-reward route
const rewardRoutePath = join(root, "app", "api", "profile", "completion-reward", "route.ts");
assert(existsSync(rewardRoutePath), "completion-reward route exists (app/api/profile/completion-reward/route.ts)");
const rewardRouteCode = readFileSync(rewardRoutePath, "utf-8");
assert(rewardRouteCode.includes("calculateProfileCompleteness"), "Reward route computes completeness");
assert(rewardRouteCode.includes("completeness < 100"), "Reward route rejects profiles under 100%");
assert(rewardRouteCode.includes('awardWalletCredits(user.id, "profile_100_percent")'), "Reward route calls awardWalletCredits");

// 4. Verify profile PATCH route auto-check
const profileRoutePath = join(root, "app", "api", "profile", "route.ts");
const profileRouteCode = readFileSync(profileRoutePath, "utf-8");
assert(profileRouteCode.includes("calculateProfileCompleteness(responseData)"), "profile route checks completeness on update");
assert(profileRouteCode.includes('awardWalletCredits(user.id, "profile_100_percent")'), "profile route auto-triggers award on 100% completion");

console.log("\nAll 100% profile reward tests passed successfully!");
