/**
 * Utility functions for formatting and parsing assistant display names.
 * Display names follow the format: `<machine_name>:<working_directory>`
 */

/**
 * Formats an assistant display name from machine name and working directory.
 * @param machineName - Name of the machine hosting the assistant
 * @param workingDirectory - Working directory path where the assistant operates
 * @returns Formatted display name in format `<machine_name>:<working_directory>`
 * @example
 * ```typescript
 * formatAssistantDisplayName("MacBook Pro", "/Users/dev/projects/my-app")
 * // Returns: "MacBook Pro:/Users/dev/projects/my-app"
 * ```
 */
export function formatAssistantDisplayName(machineName: string, workingDirectory: string): string {
  return `${machineName}:${workingDirectory}`;
}

/**
 * Parses an assistant display name back into its components.
 * @param displayName - Display name in format `<machine_name>:<working_directory>`
 * @returns Object with machineName and workingDirectory, or null if format is invalid
 * @example
 * ```typescript
 * parseAssistantDisplayName("MacBook Pro:/Users/dev/projects/my-app")
 * // Returns: { machineName: "MacBook Pro", workingDirectory: "/Users/dev/projects/my-app" }
 * ```
 */
export function parseAssistantDisplayName(displayName: string): {
  machineName: string;
  workingDirectory: string;
} | null {
  const colonIndex = displayName.indexOf(':');
  if (colonIndex === -1) return null;

  return {
    machineName: displayName.slice(0, colonIndex),
    workingDirectory: displayName.slice(colonIndex + 1),
  };
}
