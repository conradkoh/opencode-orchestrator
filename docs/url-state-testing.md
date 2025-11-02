# URL State Management - Testing Guide

## Overview

This document provides testing guidelines for the URL state management implementation in the `/app` page.

## Implementation Summary

### Key Changes

1. **New Hook**: `useAppUrlState()` - Manages URL query parameters as single source of truth
2. **Updated Component**: `ChatInterface` - Uses URL state instead of local state
3. **Page Wrapper**: `AppPage` - Wrapped in Suspense boundary for `useSearchParams`

### Files Modified

- `apps/webapp/src/modules/assistant/hooks/useAppUrlState.ts` (NEW)
- `apps/webapp/src/modules/assistant/components/ChatInterface.tsx` (MODIFIED)
- `apps/webapp/src/app/app/page.tsx` (MODIFIED)

## Render Loop Prevention

### What We Avoided

The implementation avoids common anti-patterns that cause render loops:

❌ **Anti-Pattern 1: useEffect syncing state**
```typescript
// BAD - causes loops
useEffect(() => {
  setLocalState(urlState);
}, [urlState]);

useEffect(() => {
  updateUrl(localState);
}, [localState]);
```

❌ **Anti-Pattern 2: Circular dependencies**
```typescript
// BAD - causes loops
useEffect(() => {
  if (machineId) {
    setWorkerId(null); // Triggers another effect
  }
}, [machineId]);

useEffect(() => {
  if (!workerId) {
    setMachineId(null); // Triggers previous effect
  }
}, [workerId]);
```

### What We Implemented

✅ **Pattern 1: Direct derivation**
```typescript
// GOOD - no sync needed
const { state } = useAppUrlState();
const { machineId } = state; // Derived directly from URL
```

✅ **Pattern 2: Actions update URL only**
```typescript
// GOOD - unidirectional flow
actions.setMachineId('machine-123'); // Updates URL
// URL change triggers re-render naturally
// Component reads new state from URL
```

✅ **Pattern 3: useEffect only for side effects**
```typescript
// GOOD - side effects, not state sync
useEffect(() => {
  if (selectedWorkerId) {
    connectWorker(selectedWorkerId); // Network call
  }
}, [selectedWorkerId]);
```

## Manual Testing Checklist

### Basic Functionality

- [ ] Navigate to `/app`
- [ ] Select a machine → URL updates with `?machineId=xxx`
- [ ] Select a worker → URL updates with `?workerId=yyy`
- [ ] Start a session → URL updates with `?sessionId=zzz`
- [ ] End session → URL removes `sessionId` param
- [ ] Change machine → URL clears `workerId` and `sessionId`
- [ ] Change worker → URL clears `sessionId` only

### URL Persistence

- [ ] Copy URL with params
- [ ] Open in new tab → State restored correctly
- [ ] Refresh page → State persists
- [ ] Browser back button → Previous state restored
- [ ] Browser forward button → Next state restored

### Edge Cases

- [ ] Navigate to `/app?machineId=invalid` → Handles gracefully
- [ ] Navigate to `/app?sessionId=xxx` (no worker) → Handles gracefully
- [ ] Select machine with no workers → Shows appropriate message
- [ ] Network error during session restore → Clears invalid session from URL

### Render Loop Detection

Open browser console and verify:

- [ ] No "Maximum update depth exceeded" errors
- [ ] No infinite loop warnings
- [ ] Console logs show reasonable number of renders (not hundreds)
- [ ] State changes trigger exactly one re-render

### Performance

- [ ] Selecting machine feels instant
- [ ] Selecting worker feels instant
- [ ] URL updates don't cause visible lag
- [ ] No flickering or UI jumps

## Automated Testing (Future)

### Unit Tests

```typescript
describe('useAppUrlState', () => {
  it('derives state from URL params', () => {
    // Test state derivation
  });

  it('updates URL when actions are called', () => {
    // Test URL updates
  });

  it('clears child params when parent changes', () => {
    // Test hierarchical clearing
  });
});
```

### Integration Tests

```typescript
describe('ChatInterface URL state', () => {
  it('restores state from URL on mount', () => {
    // Test URL restoration
  });

  it('updates URL when selections change', () => {
    // Test URL updates
  });

  it('handles invalid URL params gracefully', () => {
    // Test error handling
  });
});
```

## Debugging Tips

### Enable Debug Logging

The `ChatInterface` component includes debug logging:

```typescript
useEffect(() => {
  console.log('[ChatInterface] State:', {
    selectedMachineId,
    selectedWorkerId,
    urlSessionId,
    session,
    messagesCount: messages.length,
    showNewSession,
  });
}, [selectedMachineId, selectedWorkerId, urlSessionId, session, messages.length, showNewSession]);
```

Watch console for:
- State changes
- Render frequency
- Unexpected re-renders

### Check URL Updates

Open Network tab and filter for:
- No actual network requests for URL changes (should use `router.replace`)
- No page reloads

### React DevTools

1. Install React DevTools
2. Enable "Highlight updates when components render"
3. Verify components only re-render when necessary

## Known Limitations

1. **URL length**: Very long session IDs might hit URL length limits (unlikely)
2. **Special characters**: Session IDs with special characters need URL encoding (handled by URLSearchParams)
3. **Concurrent updates**: Multiple rapid URL updates might race (unlikely in practice)

## Success Criteria

✅ Implementation is successful if:

1. No render loop errors in console
2. State persists across page refresh
3. Browser back/forward buttons work correctly
4. URL is shareable and restores full state
5. Performance feels instant
6. No TypeScript errors
7. No linter warnings
8. All manual tests pass

## Verification Status

- ✅ TypeScript compilation: PASSED
- ✅ Biome linting: PASSED
- ✅ Code review: PASSED
- ⏳ Manual testing: PENDING (requires running dev server)
- ⏳ Integration testing: PENDING (requires backend implementation)

## Next Steps

1. Run dev server and perform manual testing
2. Test with real backend when available
3. Add automated tests
4. Monitor for any render loop issues in production
5. Consider adding URL state for additional features (model selection, filters, etc.)

