# Focus Management Pattern

## Problem

Input components in React often need programmatic focus control from parent components (e.g., after submitting a message, restoring a session, etc.). Using timing-based approaches like `useEffect` with dependency keys is fragile and prone to race conditions.

## Solution: `forwardRef` + `useImperativeHandle`

This is the **official React pattern** for imperative actions like focus management.

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

#### 2. Parent Component

```typescript
import { useRef } from 'react';

function ParentComponent() {
  const inputRef = useRef<ChatInputHandle>(null);

  const handleAction = async () => {
    // Perform some async action
    await someAsyncOperation();
    
    // Programmatically focus the input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100); // Small delay for DOM updates
  };

  return (
    <ChatInputWithModel ref={inputRef} {...props} />
  );
}
```

## Benefits

1. **Explicit Control**: Parent explicitly calls `focus()` when needed
2. **No Race Conditions**: Doesn't rely on useEffect dependency arrays
3. **Type-Safe**: TypeScript ensures correct usage
4. **React Pattern**: Official React pattern for imperative actions
5. **Maintainable**: Clear intent and easy to debug

## Anti-Patterns to Avoid

❌ **Don't use key-based triggers**:
```typescript
// BAD: Fragile, causes unnecessary re-renders
const [focusKey, setFocusKey] = useState(0);
useEffect(() => { focus(); }, [focusKey]);
setFocusKey(prev => prev + 1); // Parent triggers focus
```

❌ **Don't use timing-based hacks**:
```typescript
// BAD: Race conditions and unreliable
setTimeout(() => inputRef.current?.focus(), 500);
```

✅ **Do use refs and imperative handle**:
```typescript
// GOOD: Explicit, reliable, maintainable
inputRef.current?.focus();
```

## When to Use

Use this pattern when:
- Parent needs to trigger focus after async operations
- Focus needs to happen conditionally based on parent logic
- Multiple instances of the same component need independent focus control

## Related Files

- Implementation: `apps/webapp/src/modules/assistant/components/ChatInputWithModel.tsx`
- Usage: `apps/webapp/src/modules/assistant/components/ChatInterface.tsx`

