'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * Props for MachineTokenDisplay component.
 */
export interface MachineTokenDisplayProps {
  /** Registration token in format `<machine_id>:<machine_secret>` */
  token: string;
  /** Unique machine identifier */
  machineId: string;
}

/**
 * Component for displaying machine registration token and setup instructions.
 * Shows the machine ID, registration token with copy functionality, and next steps.
 *
 * @example
 * ```typescript
 * <MachineTokenDisplay
 *   token="mch_abc123:sec_xyz789"
 *   machineId="mch_abc123"
 * />
 * ```
 */
export function MachineTokenDisplay({ token, machineId }: MachineTokenDisplayProps) {
  const [copied, setCopied] = useState(false);

  /**
   * Copies the registration token to clipboard.
   */
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [token]);

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="space-y-4">
          <div>
            <p className="mb-2 font-medium">Machine ID:</p>
            <code className="block rounded bg-muted p-3 text-sm font-mono break-all">
              {machineId}
            </code>
          </div>

          <div>
            <p className="mb-2 font-medium">Registration Token:</p>
            <div className="flex gap-2">
              <code className="block flex-1 rounded bg-muted p-3 text-sm font-mono break-all">
                {token}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p className="font-medium">Next steps:</p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li>Copy the registration token above</li>
          <li>Clone this repository on your target machine</li>
          <li>
            Run{' '}
            <code className="bg-muted px-1 py-0.5 rounded">
              cd services/assistant && pnpm install
            </code>
          </li>
          <li>
            Run <code className="bg-muted px-1 py-0.5 rounded">pnpm run start</code>
          </li>
          <li>Paste the token when prompted</li>
          <li>Provide the root directory for your assistants</li>
        </ol>
      </div>

      <Alert
        variant="destructive"
        className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
      >
        <AlertDescription className="text-red-800 dark:text-red-400">
          <p className="font-medium mb-1">⚠️ Important</p>
          <p className="text-sm">
            Save this token securely. It will only be shown once and cannot be recovered. You'll
            need it to register your machine.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
