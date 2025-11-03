'use client';
import { Bot, Sparkles, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAppVersion } from '@/modules/app/useAppInfo';

export default function Home() {
  const appVersion = useAppVersion();
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-8 bg-gradient-to-b from-background to-muted/20">
      <main className="flex flex-col gap-8 items-center text-center max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="h-12 w-12 text-primary" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            OpenCode Orchestrator
          </h1>
        </div>

        <p className="text-xl text-muted-foreground max-w-2xl">
          AI assistant orchestration platform that seamlessly integrates OpenCode AI assistants with
          powerful real-time collaboration features.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 w-full">
          <div className="flex flex-col items-center gap-3 p-6 rounded-lg border bg-card">
            <Bot className="h-8 w-8 text-primary" />
            <h3 className="font-semibold">AI Assistants</h3>
            <p className="text-sm text-muted-foreground">
              Orchestrate multiple OpenCode AI assistants for different projects and workflows
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 p-6 rounded-lg border bg-card">
            <Zap className="h-8 w-8 text-primary" />
            <h3 className="font-semibold">Real-time Sync</h3>
            <p className="text-sm text-muted-foreground">
              Live updates and seamless state synchronization powered by Convex
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 p-6 rounded-lg border bg-card">
            <Sparkles className="h-8 w-8 text-primary" />
            <h3 className="font-semibold">Feature Rich</h3>
            <p className="text-sm text-muted-foreground">
              Chat, attendance, checklists, discussions, and presentations all in one platform
            </p>
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <Button size="lg" onClick={() => router.push('/app')}>
            Get Started
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.push('/login')}>
            Sign In
          </Button>
        </div>
      </main>

      <footer className="mt-16 text-sm text-muted-foreground">
        Version {appVersion ?? 'Loading...'}
      </footer>
    </div>
  );
}
