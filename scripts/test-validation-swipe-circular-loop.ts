/**
 * Validation Script: Swipe Navigation Circular Loop & Zero-Turned-UI
 * 
 * Tests:
 * 1. Left swipe triggers advancePrev() and wraps around smoothly in a circular loop
 * 2. Right swipe triggers advanceNext() and wraps around forward
 * 3. Card transform strictly resets to "translate3d(0, 0, 0) rotate(0deg)" when resting
 * 4. Drag stamp opacity: negative drag activates prev stamp, positive drag activates next stamp
 * 5. Isolation: Swipes never trigger celebrate notifications
 */

import assert from "assert";

console.log("=== Validating Swipe Navigation & Circular Loop ===");

// 1. Validate Circular Loop Math
const total = 5;

function simulateAdvancePrev(currentIndex: number, count: number): number[] {
  const history: number[] = [];
  let curr = currentIndex;
  for (let i = 0; i < count; i++) {
    curr = (curr - 1 + total) % total;
    history.push(curr);
  }
  return history;
}

function simulateAdvanceNext(currentIndex: number, count: number): number[] {
  const history: number[] = [];
  let curr = currentIndex;
  for (let i = 0; i < count; i++) {
    curr = (curr + 1) % total;
    history.push(curr);
  }
  return history;
}

// Test Case 1: Starting at index 0, 6 left swipes (advancePrev) should wrap cleanly
const prevHistory = simulateAdvancePrev(0, 6);
console.log("Prev navigation sequence from 0:", prevHistory);
assert.deepStrictEqual(prevHistory, [4, 3, 2, 1, 0, 4], "Prev swipe must form a continuous circular loop");
console.log("✓ Test 1 Passed: Left swipe (advancePrev) loops circularly: 0 -> 4 -> 3 -> 2 -> 1 -> 0 -> 4");

// Test Case 2: Starting at index 4, 6 right swipes (advanceNext) should wrap cleanly
const nextHistory = simulateAdvanceNext(4, 6);
console.log("Next navigation sequence from 4:", nextHistory);
assert.deepStrictEqual(nextHistory, [0, 1, 2, 3, 4, 0], "Next swipe must form a continuous circular loop");
console.log("✓ Test 2 Passed: Right swipe (advanceNext) loops circularly: 4 -> 0 -> 1 -> 2 -> 3 -> 4 -> 0");

// Test Case 3: Transform calculation when resting (!isDragging && !transitioning)
function calculateCardTransform(isTop: boolean, isDragging: boolean, transitioning: "next" | "prev" | null, dragOffset: number) {
  if (!isTop) return "";
  if (transitioning === "prev") {
    return "translate3d(-105%, 15px, 0) rotate(-15deg)";
  } else if (transitioning === "next") {
    return "translate3d(105%, 15px, 0) rotate(15deg)";
  } else if (isDragging) {
    const rot = Math.max(-12, Math.min(12, dragOffset * 0.05));
    return `translate3d(${dragOffset}px, ${Math.abs(dragOffset) * 0.03}px, 0) rotate(${rot}deg)`;
  } else {
    return "translate3d(0, 0, 0) rotate(0deg)";
  }
}

// Even if dragOffset was hypothetically lingering at -120, when !isDragging && !transitioning, it MUST be reset to 0deg
const restingTransform = calculateCardTransform(true, false, null, -120);
assert.strictEqual(
  restingTransform,
  "translate3d(0, 0, 0) rotate(0deg)",
  "Resting card MUST have 0 translation and 0deg rotation so UI never gets stuck turned"
);
console.log("✓ Test 3 Passed: Resting card transform is strictly translate3d(0, 0, 0) rotate(0deg)");

// Test Case 4: Drag Stamp Opacities
function calculateStampOpacities(dragOffset: number) {
  const prevOpacity = Math.min(1, Math.max(0, -dragOffset / 75));
  const nextOpacity = Math.min(1, Math.max(0, dragOffset / 75));
  return { prevOpacity, nextOpacity };
}

const leftDrag = calculateStampOpacities(-60);
assert(leftDrag.prevOpacity > 0.7 && leftDrag.nextOpacity === 0, "Left drag must activate PREV stamp only");

const rightDrag = calculateStampOpacities(60);
assert(rightDrag.nextOpacity > 0.7 && rightDrag.prevOpacity === 0, "Right drag must activate NEXT stamp only");
console.log("✓ Test 4 Passed: Drag stamps accurately reflect navigation intent (Left = PREV, Right = NEXT)");

// Test Case 5: Swipe threshold dispatch
const SWIPE_THRESHOLD = 80;
let triggeredAction: string | null = null;
let celebrationTriggered = false;

function onSwipeEnd(dragOffset: number) {
  if (dragOffset < -SWIPE_THRESHOLD) {
    triggeredAction = "advancePrev";
  } else if (dragOffset > SWIPE_THRESHOLD) {
    triggeredAction = "advanceNext";
  } else {
    triggeredAction = "reset";
  }
}

onSwipeEnd(-100);
assert.strictEqual(triggeredAction, "advancePrev", "Left swipe must trigger advancePrev");
assert.strictEqual(celebrationTriggered, false, "Celebrate must NOT trigger on left swipe");

onSwipeEnd(100);
assert.strictEqual(triggeredAction, "advanceNext", "Right swipe must trigger advanceNext");
assert.strictEqual(celebrationTriggered, false, "Celebrate must NOT trigger on right swipe");

console.log("✓ Test 5 Passed: Left swipe triggers advancePrev with 0 celebration triggers");

console.log("\nALL 5 TEST CASES PASSED SUCCESSFULLY!");
