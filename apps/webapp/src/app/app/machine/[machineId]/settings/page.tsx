import { ArrowLeftIcon, ServerIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MachineSettingsContent } from '@/modules/assistant/components/MachineSettingsContent';

/**
 * Machine settings page.
 * Displays machine details and allows deletion.
 *
 * @param params - Route parameters containing machineId
 */
export default async function MachineSettingsPage({
  params,
}: {
  params: Promise<{ machineId: string }>;
}) {
  const { machineId } = await params;

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <ServerIcon className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Machine Settings</h1>
        </div>
      </div>

      {/* Settings Content */}
      <MachineSettingsContent machineId={machineId} />
    </div>
  );
}
