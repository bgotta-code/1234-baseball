---
name: Mobile ghost-click on modals
description: On iOS/Android, a synthetic "ghost" click fires ~300ms after a tap at the same screen coordinates. If a modal opens on tap, the ghost click hits the backdrop and closes it instantly.
---

# Mobile ghost-click on modals

## The rule
Any modal/sheet that opens in response to a tap must guard its backdrop click-to-close against the mobile ghost click.

**Why:** iOS and Android fire a synthetic click event ~300ms after touchend at the same coordinates. If a modal opens from a tap, the ghost click lands on the backdrop and closes the modal before the user sees it — looks like the tap did nothing.

**How to apply:**
Add a `useRef(false)` flag (`backdropReady`) set to `true` via `setTimeout(..., 400)` in a `useEffect`. Guard the backdrop's `onClick` with `if (backdropReady.current && e.target === e.currentTarget) onClose()`. 400ms safely outlasts the 300ms ghost-click window.

```tsx
const backdropReady = useRef(false);
useEffect(() => {
  const t = setTimeout(() => { backdropReady.current = true; }, 400);
  return () => clearTimeout(t);
}, []);

// backdrop:
onClick={(e) => { if (backdropReady.current && e.target === e.currentTarget) onClose(); }}
```
