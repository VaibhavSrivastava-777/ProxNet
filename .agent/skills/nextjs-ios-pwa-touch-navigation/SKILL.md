---
name: nextjs-ios-pwa-touch-navigation
description: Resolves issues with touch events, onClick handlers, and navigation stalling in Next.js applications deployed as Progressive Web Apps (PWAs) on iOS Safari.
---

# Next.js iOS PWA Touch Navigation Fix

## The Problem
When a Next.js application is saved to the home screen on iOS (as a PWA), certain interactive elements (especially `<button>` tags with `onClick` handlers that trigger state changes and `router.push`) may fail to fire reliably. Users report tapping on items (like notification dropdowns or list items) and nothing happening, despite it working fine on Android and desktop.

This is caused by a combination of iOS Safari's hover state emulation on touch and Next.js's router execution context stalling inside asynchronous event handlers on iOS PWAs.

## The Solution
Instead of using `<button onClick={() => { ...; router.push(url); }}>`, you must use Next.js's native `<Link>` component.

### Incorrect Pattern
```tsx
<button 
  onClick={async () => {
    await markAsRead(id);
    router.push(url);
  }}
>
  View Notification
</button>
```

### Correct Pattern
Wrap the element in a `<Link>` for reliable navigation, but retain the `onClick` solely for the side-effects.

```tsx
<Link 
  href={url}
  onClick={() => {
    // Fire side effects. Do not await them if they block navigation.
    markAsRead(id).catch(console.error);
    // State updates like closing a dropdown are fine
    setIsOpen(false);
  }}
>
  <div>View Notification</div>
</Link>
```

## When to use this skill
- When debugging a bug report specifically mentioning iOS, Safari, or "saved to home screen" not responding to clicks.
- When you are writing a navigation menu or notification dropdown and need it to be bulletproof on mobile.
