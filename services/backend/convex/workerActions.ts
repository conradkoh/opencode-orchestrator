'use node';

import crypto from 'node:crypto';
import { internalAction } from './_generated/server';

/**
 * Internal action to generate a cryptographic secret.
 * Uses Node.js crypto for secure random generation.
 * Must be in a separate file with 'use node' directive.
 *
 * @returns Cryptographically secure random secret string (32 bytes, base64url-encoded)
 */
export const generateSecret = internalAction({
  args: {},
  handler: async () => {
    return crypto.randomBytes(32).toString('base64url');
  },
});
