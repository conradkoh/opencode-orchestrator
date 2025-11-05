/**
 * Utility functions for formatting file paths and extracting usernames.
 */

/**
 * Formats a file path to be relative to the user's home directory.
 * Replaces the home directory prefix with ~
 *
 * @param path - Absolute file path
 * @param username - Optional username to use for home directory detection
 * @returns Formatted path with ~ prefix if applicable
 *
 * @example
 * formatPathToHome('/Users/john/Documents/project', 'john')
 * // Returns: '~/Documents/project'
 *
 * formatPathToHome('/home/jane/workspace', 'jane')
 * // Returns: '~/workspace'
 *
 * formatPathToHome('/opt/projects/app')
 * // Returns: '/opt/projects/app' (no home directory detected)
 */
export function formatPathToHome(path: string, username?: string): string {
  if (!path) return path;

  // If path already starts with ~, return as-is
  if (path.startsWith('~/') || path === '~') {
    return path;
  }

  // Common home directory patterns
  const patterns = [
    `/Users/${username}/`, // macOS
    `/home/${username}/`, // Linux
    `C:\\Users\\${username}\\`, // Windows
  ];

  // Try to replace with username if provided
  if (username) {
    for (const pattern of patterns) {
      if (path.startsWith(pattern)) {
        return path.replace(pattern, '~/');
      }
    }
  }

  // Fallback: try common patterns without username
  if (path.startsWith('/Users/')) {
    return path.replace(/^\/Users\/[^/]+\//, '~/');
  }
  if (path.startsWith('/home/')) {
    return path.replace(/^\/home\/[^/]+\//, '~/');
  }
  if (path.match(/^C:\\Users\\[^\\]+\\/)) {
    return path.replace(/^C:\\Users\\[^\\]+\\/, '~/');
  }

  return path;
}

/**
 * Extracts the username from a file path.
 *
 * @param path - Absolute file path
 * @returns Username if found, null otherwise
 *
 * @example
 * extractUsername('/Users/john/Documents/project')
 * // Returns: 'john'
 *
 * extractUsername('/home/jane/workspace')
 * // Returns: 'jane'
 *
 * extractUsername('/opt/projects/app')
 * // Returns: null
 */
export function extractUsername(path: string): string | null {
  if (!path) return null;

  // macOS pattern
  const macMatch = path.match(/^\/Users\/([^/]+)\//);
  if (macMatch) return macMatch[1];

  // Linux pattern
  const linuxMatch = path.match(/^\/home\/([^/]+)\//);
  if (linuxMatch) return linuxMatch[1];

  // Windows pattern
  const windowsMatch = path.match(/^C:\\Users\\([^\\]+)\\/);
  if (windowsMatch) return windowsMatch[1];

  return null;
}
