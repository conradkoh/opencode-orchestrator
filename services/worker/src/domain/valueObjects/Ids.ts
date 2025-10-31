import { nanoid } from 'nanoid';

/**
 * Branded type for Machine ID to prevent type confusion.
 */
export type MachineId = string & { readonly __brand: 'MachineId' };

/**
 * Branded type for Worker ID to prevent type confusion.
 */
export type WorkerId = string & { readonly __brand: 'WorkerId' };

/**
 * Branded type for Session ID to prevent type confusion.
 */
export type SessionId = string & { readonly __brand: 'SessionId' };

/**
 * Branded type for Machine Secret to prevent type confusion.
 */
export type MachineSecret = string & { readonly __brand: 'MachineSecret' };

/**
 * Generates a new Worker ID using nanoid.
 * @returns A unique Worker ID
 */
export function generateWorkerId(): WorkerId {
  return `wkr_${nanoid()}` as WorkerId;
}

/**
 * Validates and casts a string to MachineId.
 * @param id - String to validate
 * @returns Validated Machine ID
 * @throws Error if ID is invalid
 */
export function validateMachineId(id: string): MachineId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Invalid Machine ID: must be a non-empty string');
  }
  return id as MachineId;
}

/**
 * Validates and casts a string to WorkerId.
 * @param id - String to validate
 * @returns Validated Worker ID
 * @throws Error if ID is invalid
 */
export function validateWorkerId(id: string): WorkerId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Invalid Worker ID: must be a non-empty string');
  }
  return id as WorkerId;
}

/**
 * Validates and casts a string to SessionId.
 * @param id - String to validate
 * @returns Validated Session ID
 * @throws Error if ID is invalid
 */
export function validateSessionId(id: string): SessionId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Invalid Session ID: must be a non-empty string');
  }
  return id as SessionId;
}

/**
 * Validates and casts a string to MachineSecret.
 * @param secret - String to validate
 * @returns Validated Machine Secret
 * @throws Error if secret is invalid
 */
export function validateMachineSecret(secret: string): MachineSecret {
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error('Invalid Machine Secret: must be a non-empty string');
  }
  return secret as MachineSecret;
}
