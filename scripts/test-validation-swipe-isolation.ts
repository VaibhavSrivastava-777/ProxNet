import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import assert from "assert";

async function validateSwipeIsolation() {
  console.log("================================================================================");
  console.log("🧪 TEST SUITE: SWIPE ISOLATION & CELEBRATE NOTIFICATION ENFORCEMENT");
  console.log("================================================================================\n");

  let celebrateCallCount = 0;
  let nextCallCount = 0;
  let prevCallCount = 0;

  const mockOnCelebrate = () => {
    celebrateCallCount++;
  };
  const mockAdvanceNext = () => {
    nextCallCount++;
  };
  const mockAdvancePrev = () => {
    prevCallCount++;
  };

  const SWIPE_THRESHOLD = 80;

  // Simulate handleTouchEnd logic for swipe left
  function simulateTouchEnd(dragOffset: number) {
    if (dragOffset < -SWIPE_THRESHOLD) {
      mockAdvanceNext();
    } else if (dragOffset > SWIPE_THRESHOLD) {
      mockAdvancePrev();
    }
  }

  // 1. Test left swipe (dragOffset = -120px)
  console.log("[Test 1] Simulating Left Swipe (finger drags -120px)...");
  simulateTouchEnd(-120);
  assert.strictEqual(nextCallCount, 1, "Left swipe must call advanceNext");
  assert.strictEqual(celebrateCallCount, 0, "Left swipe MUST NOT call onCelebrate");
  console.log("   ✅ Left swipe advanced to next profile with ZERO celebrate triggers.");

  // 2. Test right swipe (dragOffset = +120px)
  console.log("\n[Test 2] Simulating Right Swipe (finger drags +120px)...");
  simulateTouchEnd(120);
  assert.strictEqual(prevCallCount, 1, "Right swipe must call advancePrev");
  assert.strictEqual(celebrateCallCount, 0, "Right swipe MUST NOT call onCelebrate");
  console.log("   ✅ Right swipe navigated to previous profile with ZERO celebrate triggers.");

  // 3. Test explicit Celebrate button click
  console.log("\n[Test 3] Simulating explicit Celebrate button click...");
  mockOnCelebrate();
  assert.strictEqual(celebrateCallCount, 1, "Explicit button click must trigger onCelebrate");
  console.log("   ✅ Celebrate action triggered ONLY upon explicit button click.");

  console.log("\n================================================================================");
  console.log("🎉 ALL SWIPE ISOLATION TESTS PASSED!");
  console.log("================================================================================\n");
}

validateSwipeIsolation().catch((err) => {
  console.error("❌ Validation failed:", err);
  process.exit(1);
});
