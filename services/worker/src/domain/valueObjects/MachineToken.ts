import type { MachineId, MachineSecret } from './Ids';
import { validateMachineId, validateMachineSecret } from './Ids';

/**
 * Value object representing a machine authentication token.
 * Format: `<machine_id>:<machine_secret>`
 * Immutable and validated on creation.
 */
export class MachineToken {
  private constructor(
    private readonly machineId: MachineId,
    private readonly secret: MachineSecret
  ) {}

  /**
   * Creates a MachineToken from machine ID and secret.
   * @param machineId - The machine identifier
   * @param secret - The machine secret
   * @returns A validated MachineToken instance
   * @throws Error if ID or secret is invalid
   */
  static create(machineId: string, secret: string): MachineToken {
    const validatedId = validateMachineId(machineId);
    const validatedSecret = validateMachineSecret(secret);
    return new MachineToken(validatedId, validatedSecret);
  }

  /**
   * Parses a token string in format `<machine_id>:<machine_secret>`.
   * @param token - Token string to parse
   * @returns A validated MachineToken instance
   * @throws Error if token format is invalid
   */
  static parse(token: string): MachineToken {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token: must be a non-empty string');
    }

    const colonIndex = token.indexOf(':');
    if (colonIndex === -1) {
      throw new Error('Invalid token format: must be in format <machine_id>:<machine_secret>');
    }

    const machineId = token.slice(0, colonIndex);
    const secret = token.slice(colonIndex + 1);

    if (!machineId || !secret) {
      throw new Error('Invalid token: both machine ID and secret must be non-empty');
    }

    return MachineToken.create(machineId, secret);
  }

  /**
   * Converts the token to string format.
   * @returns Token string in format `<machine_id>:<machine_secret>`
   */
  toString(): string {
    return `${this.machineId}:${this.secret}`;
  }

  /**
   * Gets the machine ID component of the token.
   * @returns Machine ID
   */
  getMachineId(): MachineId {
    return this.machineId;
  }

  /**
   * Gets the secret component of the token.
   * @returns Machine secret
   */
  getSecret(): MachineSecret {
    return this.secret;
  }

  /**
   * Checks equality with another MachineToken.
   * @param other - Token to compare with
   * @returns True if tokens are equal
   */
  equals(other: MachineToken): boolean {
    return this.machineId === other.machineId && this.secret === other.secret;
  }
}
