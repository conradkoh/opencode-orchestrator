import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Navigation } from './Navigation';

// Mock the auth module
vi.mock('@/modules/auth/AuthProvider', () => ({
  useAuthState: vi.fn(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock UserMenu component
vi.mock('@/components/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu">User Menu</div>,
}));

// Mock feature flags
vi.mock('@workspace/backend/config/featureFlags', () => ({
  featureFlags: {
    disableLogin: false,
  },
}));

import { useAuthState } from '@/modules/auth/AuthProvider';

describe('Navigation', () => {
  it('renders title link to "/" when user is not authenticated', () => {
    vi.mocked(useAuthState).mockReturnValue({
      state: 'unauthenticated',
    } as any);

    render(<Navigation />);

    const titleLink = screen.getByRole('link', { name: /next convex/i });
    expect(titleLink).toBeInTheDocument();
    expect(titleLink).toHaveAttribute('href', '/');
  });

  it('renders title link to "/app" when user is authenticated', () => {
    vi.mocked(useAuthState).mockReturnValue({
      state: 'authenticated',
      user: {
        type: 'anonymous',
        id: 'test-user-id',
        displayName: 'Test User',
      },
    } as any);

    render(<Navigation />);

    const titleLink = screen.getByRole('link', { name: /next convex/i });
    expect(titleLink).toBeInTheDocument();
    expect(titleLink).toHaveAttribute('href', '/app');
  });

  it('renders login button when user is not authenticated', () => {
    vi.mocked(useAuthState).mockReturnValue({
      state: 'unauthenticated',
    } as any);

    render(<Navigation />);

    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
  });

  it('renders user menu when user is authenticated', () => {
    vi.mocked(useAuthState).mockReturnValue({
      state: 'authenticated',
      user: {
        type: 'anonymous',
        id: 'test-user-id',
        displayName: 'Test User',
      },
    } as any);

    render(<Navigation />);

    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });

  it('renders nothing when auth state is loading', () => {
    vi.mocked(useAuthState).mockReturnValue(undefined);

    render(<Navigation />);

    // Should not render login button or user menu
    expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
  });
});
