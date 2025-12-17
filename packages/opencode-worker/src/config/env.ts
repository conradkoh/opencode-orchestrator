import { Effect } from 'effect';

export interface EnvConfig {
  readonly CONVEX_URL: string;
}

export const loadEnv = Effect.gen(function* () {
  const convexUrl = process.env.CONVEX_URL;

  if (!convexUrl) {
    return yield* Effect.fail(new Error('CONVEX_URL environment variable is required'));
  }

  return {
    CONVEX_URL: convexUrl,
  } as EnvConfig;
});
