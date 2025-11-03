# Focus Management Pattern

## Problem

Input components in React often need programmatic focus control from parent components (e.g., after submitting a message, restoring a session, etc.). Using timing-based approaches like `useEffect` with dependency keys is fragile and prone to race conditions.

Additionally, when parent components conditionally render different instances of the same component (e.g., "new session" input vs "active session" input), imperative focus calls from callbacks can target unmounted components.

## Solution: `forwardRef` + `useImperativeHandle` + Effect-based Focus

This combines React's **official pattern for imperative actions** with **declarative state management** for focus control.

### Implementation

#### 1. Child Component (Input Component)

```typescript
import { forwardRef, useImperativeHandle, useRef } from 'react';

// Define the imperative handle interface
export interface ChatInputHandle {
  focus: () => void;
}

export const ChatInputWithModel = forwardRef<ChatInputHandle, ChatInputWithModelProps>(
  function ChatInputWithModel(props, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Expose focus method to parent
    useImperativeHandle(ref, () => ({
      focus: () => {
        if (textareaRef.current && !props.disabled) {
          textareaRef.current.focus();
        }
      },
    }), [props.disabled]);

    return (
      <textarea ref={textareaRef} {...props} />
    );
  }
);
```

#### 2. Parent Component (with State-based Focus Triggering)

```typescript
import { useRef, useState, useEffect } from 'react';

function ParentComponent() {
  const inputRef = useRef<ChatInputHandle>(null);
  const [shouldFocusInput, setShouldFocusInput] = useState(false);

  // Effect that handles focus after component re-renders
  useEffect(() => {
    if (shouldFocusInput) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          inputRef.current?.focus();
          setShouldFocusInput(false); // Reset flag
        }, 100);
      });
    }
  }, [shouldFocusInput]);

  const handleAction = async () => {
    // Perform some async action
    await someAsyncOperation();
    
    // Trigger focus declaratively
    setShouldFocusInput(true);
  };

  return (
    <ChatInputWithModel ref={inputRef} {...props} />
  );
}
```

**Why use state instead of direct calls?**
- When parent conditionally renders different component instances, refs may point to unmounted components
- State ensures focus is applied after React completes re-rendering
- More predictable timing with React's render cycle

## Benefits

1. **Declarative**: Focus is triggered by state changes, not imperative calls
2. **Reliable Timing**: Uses `requestAnimationFrame` + state to ensure components are mounted
3. **Handles Conditional Rendering**: Works when parent switches between component instances
4. **Type-Safe**: TypeScript ensures correct usage via `ChatInputHandle` interface
5. **React Pattern**: Combines official patterns (refs + state) properly
6. **Maintainable**: Clear intent and easy to debug

## Anti-Patterns to Avoid

❌ **Don't use key-based triggers**:
```typescript
// BAD: Fragile, causes unnecessary re-renders
const [focusKey, setFocusKey] = useState(0);
useEffect(() => { focus(); }, [focusKey]);
setFocusKey(prev => prev + 1); // Parent triggers focus
```

❌ **Don't call focus directly from callbacks**:
```typescript
// BAD: May target unmounted component when conditional rendering
const handleAction = async () => {
  await someAction();
  inputRef.current?.focus(); // Component might not be mounted yet!
};
```

❌ **Don't use long arbitrary timeouts**:
```typescript
// BAD: Race conditions and unreliable
setTimeout(() => inputRef.current?.focus(), 500);
```

✅ **Do use state + useEffect + refs**:
```typescript
// GOOD: Declarative, reliable, works with conditional rendering
setShouldFocusInput(true);
// useEffect handles focus after component mounts/updates
```

## When to Use

Use this pattern when:
- Parent needs to trigger focus after async operations
- Focus needs to happen conditionally based on parent logic
- Multiple instances of the same component need independent focus control

## Related Files

- Implementation: `apps/webapp/src/modules/assistant/components/ChatInputWithModel.tsx`
- Usage: `apps/webapp/src/modules/assistant/components/ChatInterface.tsx`

