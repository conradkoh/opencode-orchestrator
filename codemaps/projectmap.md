# Opencode Orchestrator - Project Map

## Project Overview

A distributed system for orchestrating local workers through a web interface. Users can delegate tasks to machines running the Opencode worker, enabling remote code execution and automation through a chat-based interface.

## Project Structure

### Root Configuration Files

- `package.json` - Root workspace configuration and monorepo scripts
- `pnpm-workspace.yaml` - PNPM workspace configuration
- `nx.json` - Nx monorepo build orchestration
- `biome.json` - Code linting and formatting configuration
- `README.md` - Project documentation

### Root Scripts

- `scripts/setup.js` - Initial project setup and configuration

### Documentation Structure

#### Knowledge Management Directories

- `docs/` - Technical documentation and architectural guides
  - `account-recovery.md` - Account recovery flow documentation
  - `graceful-shutdown.md` - Graceful shutdown patterns
- `guides/` - Development guides and procedures
  - `mdx/rendering-mdx.md` - MDX rendering implementation guide
  - `pwa/pwa-setup.md` - Progressive Web App setup guide
- `spec/` - System design specifications
  - `design.md` - High-level system design and architecture
- `codemaps/` - Feature implementation maps and project structure
  - `projectmap.md` - This file - overall project structure
  - `templates/` - Codemap and projectmap templates

### Frontend Application (`apps/webapp/`)

#### Configuration Files

- `package.json` - Frontend dependencies and scripts
- `next.config.ts` - Next.js configuration
- `tsconfig.json` - TypeScript configuration
- `postcss.config.mjs` - PostCSS and Tailwind configuration
- `components.json` - ShadCN UI component configuration
- `project.json` - Nx project configuration
- `mdx.d.ts` - MDX type definitions
- `manifest.ts` - PWA manifest configuration

#### Routes Structure (`src/app/`)

- `/` - Homepage and landing page
- `/login/` - Authentication flows
  - `/login/[loginRequestId]/` - Login request handling
  - `/login/code/` - Code-based login
  - `/login/google/` - Google OAuth flows
- `/recover/` - Account recovery
- `/app/` - Main application routes (authenticated)
  - `/app/admin/` - Admin panel
  - `/app/profile/` - User profile management
- `/api/` - API routes
  - `/api/auth/` - Authentication endpoints
  - `/api/test/` - Test endpoints
- `/test/` - Development testing pages

#### UI Components (`src/components/`)

##### Core Components

- `Navigation.tsx` - Main navigation component
- `ThemeToggle.tsx` - Dark mode toggle
- `UserMenu.tsx` - User menu dropdown
- `UnauthorizedPage.tsx` - Unauthorized access page
- `CallbackErrorCard.tsx` - OAuth callback error display
- `CallbackSuccessCard.tsx` - OAuth callback success display
- `DateRangePicker.tsx` - Date range selection component
- `MdxLayout.tsx` - MDX content layout wrapper

##### UI Library (`src/components/ui/`)

- ShadCN UI component system with Tailwind styling
- Components: alert-dialog, alert, badge, button, calendar, card, checkbox, collapsible, dialog, dropdown-menu, input, label, popover, progress, radio-group, scroll-area, select, separator, skeleton, sonner, switch, tabs, textarea, tooltip

#### Frontend Utilities (`src/lib/`)

- `utils.ts` - Common utility functions and helpers (cn, etc.)

#### Frontend Modules (`src/modules/`)

- `admin/` - Admin-specific functionality
  - `AdminGuard.tsx` - Admin route protection
- `app/` - Application-level context
  - `AppInfoProvider.tsx` - App info context provider
  - `useAppInfo.ts` - App info hook
- `attendance/` - Attendance tracking feature
  - `components/` - Attendance UI components
  - `hooks/` - Attendance-related hooks
  - `types.ts` - Attendance type definitions
- `auth/` - Authentication module
  - `AuthProvider.tsx` - Auth context provider
  - `RequireLogin.tsx` - Login requirement guard
  - `ConnectButton.tsx` - Connection UI
  - `GoogleLoginButton.tsx` - Google OAuth button
  - `AnonymousLoginButton.tsx` - Anonymous login
  - `LoginCodeGenerator.tsx` - Login code generation
  - `LoginWithCode.tsx` - Code-based login UI
  - `useGoogleLoginFlow.ts` - Google OAuth flow hook
- `checklist/` - Checklist feature
  - `checklist.tsx` - Main checklist component
  - `checklist-empty-state.tsx` - Empty state UI
  - `checklist-inline-input.tsx` - Inline input component
  - `types.ts` - Checklist types
  - `use-checklist-sync.ts` - Checklist sync hook
- `discussion/` - Discussion feature
  - `discussion.tsx` - Main discussion component
  - `discussion-form.tsx` - Discussion form
  - `discussion-conclusion.tsx` - Conclusion component
  - `use-discussion-sync.ts` - Discussion sync hook
- `password-protection/` - Password protection feature
  - `PasswordProtect.tsx` - Password protection wrapper
  - `PasswordProtectContext.tsx` - Password context
  - `PasswordProtectedConditionalRender.tsx` - Conditional render
  - `password-utils.ts` - Password utilities
  - `README.md` - Feature documentation
- `presentation/` - Presentation feature
  - `presentation-container.tsx` - Container component
  - `presentation-controls.tsx` - Control panel
  - `slide.tsx` - Slide component
  - `use-presentation-sync.ts` - Presentation sync hook
  - `readme.md` - Feature documentation
- `profile/` - User profile management
  - `NameEditForm.tsx` - Name editing form
- `theme/` - Theme management
  - `ThemeProvider.tsx` - Theme context provider
  - `ThemeSettings.tsx` - Theme settings UI
  - `theme-utils.ts` - Theme utilities
- `worker/` - Worker orchestration ✅
  - `components/` - Worker UI components ✅
    - `ChatInterface.tsx` - Main chat container with session management
    - `WorkerSelector.tsx` - Worker dropdown selector
    - `ModelSelector.tsx` - Model dropdown selector
    - `SessionList.tsx` - Session list for restoration
    - `ChatMessageList.tsx` - Message history display
    - `ChatInput.tsx` - Message input component
    - `ChatMessage.tsx` - Individual message bubble
  - `hooks/` - Worker-related hooks ✅
    - `useWorkers.ts` - Fetch workers (mock)
    - `useWorkerSessions.ts` - Fetch sessions (mock)
    - `useWorkerChat.ts` - Chat session management (mock)
  - `utils/` - Worker utilities ✅
    - `workerFormatter.ts` - Display name formatting
  - `types.ts` - Worker type definitions ✅
- `machine/` - Machine management ✅
  - `components/` - Machine UI components ✅
    - `MachineEmptyState.tsx` - Empty state component
    - `CreateMachineDialog.tsx` - Machine creation dialog
    - `MachineTokenDisplay.tsx` - Token display component
  - `hooks/` - Machine-related hooks ✅
    - `useMachines.ts` - Fetch machines (mock)
    - `useCreateMachine.ts` - Create machine (mock)
  - `types.ts` - Machine type definitions ✅

#### Frontend Scripts

- `scripts/generate-pwa-assets.js` - PWA asset generation

### Backend Services (`services/backend/`)

#### Configuration Files

- `package.json` - Backend dependencies and configuration
- `tsconfig.json` - TypeScript configuration for backend
- `vitest.config.mts` - Vitest testing configuration
- `test.setup.ts` - Test environment setup
- `project.json` - Nx project configuration

#### Backend Functions (`convex/`)

##### Core Functions

- `appinfo.ts` - Application info queries
- `auth.ts` - Authentication functions
- `attendance.ts` - Attendance tracking functions
- `checklists.ts` - Checklist CRUD operations
- `discussions.ts` - Discussion management
- `presentations.ts` - Presentation functions
- `serviceDesk.ts` - Service desk operations
- `cleanupTasks.ts` - Background cleanup tasks
- `migration.ts` - Database migration functions
- `crypto.ts` - Cryptographic utilities
- **[TODO]** `machines.ts` - Machine registration and management (NEW)
- **[TODO]** `workers.ts` - Worker registration and lifecycle (NEW)
- **[TODO]** `chat.ts` - Chat session management (NEW)

##### Auth Feature (`convex/auth/`)

- `google.ts` - Google OAuth implementation

##### System Functions (`convex/system/`)

- `system/auth/google.ts` - System-level Google auth

##### Generated Files (`convex/_generated/`)

- Auto-generated Convex API types and runtime code

#### Backend Configuration (`config/`)

- `featureFlags.ts` - Feature flag definitions

#### Database Schema & Data Layer

- `convex/schema.ts` - Convex database schema definitions
- **[TODO]** Schema additions:
  - **[TODO]** `machines` table - Machine registrations
  - **[TODO]** `workers` table - Worker instances
  - **[TODO]** `chatSessions` table - Chat sessions
  - **[TODO]** `chatMessages` table - Chat messages
  - **[TODO]** `chatChunks` table - Streaming chunks

#### Backend Modules (`modules/`)

- `auth/` - Authentication business logic
  - `accessControl.ts` - Access control logic
  - `codeUtils.ts` - Code generation utilities
  - `getAuthUser.ts` - User authentication helpers
  - `types/AuthState.ts` - Auth state types
- **[TODO]** `machine/` - Machine domain logic (NEW)
  - **[TODO]** `types.ts` - Machine types and interfaces
  - **[TODO]** `machineAuth.ts` - Machine authentication
  - **[TODO]** `machineRegistry.ts` - Machine registration logic
- **[TODO]** `worker/` - Worker domain logic (NEW)
  - **[TODO]** `types.ts` - Worker types and interfaces
  - **[TODO]** `workerRegistry.ts` - Worker registration logic
  - **[TODO]** `sessionManager.ts` - Session lifecycle management

#### Backend Testing

- `auth.spec.ts` - Authentication test suite
- **[TODO]** `machines.spec.ts` - Machine tests (NEW)
- **[TODO]** `workers.spec.ts` - Worker tests (NEW)
- **[TODO]** `chat.spec.ts` - Chat tests (NEW)

### Worker Service (`services/worker/`) **[TODO - NEW SERVICE]**

#### Configuration Files

- **[TODO]** `package.json` - Worker dependencies
- **[TODO]** `tsconfig.json` - TypeScript configuration
- **[TODO]** `.env.example` - Environment variable template

#### Worker Implementation (`src/`)

##### Core Files

- **[TODO]** `index.ts` - Main entry point
- **[TODO]** `machine.ts` - Machine process implementation
- **[TODO]** `worker.ts` - Worker process implementation
- **[TODO]** `config.ts` - Configuration management

##### Interfaces (`src/interfaces/`)

- **[TODO]** `IMachine.ts` - Machine interface definition
- **[TODO]** `IWorker.ts` - Worker interface definition
- **[TODO]** `IChatSession.ts` - Chat session interface

##### Services (`src/services/`)

- **[TODO]** `convexClient.ts` - Convex connection client
- **[TODO]** `opencodeClient.ts` - Opencode SDK client wrapper
- **[TODO]** `fileSystem.ts` - File system operations
- **[TODO]** `processManager.ts` - Process lifecycle management

##### Utils (`src/utils/`)

- **[TODO]** `tokenStorage.ts` - Machine token persistence
- **[TODO]** `idGenerator.ts` - nanoid wrapper for ID generation
- **[TODO]** `logger.ts` - Logging utilities

## Monorepo Workspaces

### Workspace Configuration

- **Package Manager**: PNPM (v8+)
- **Workspace Root**: `/` (project root)
- **Workspace Packages**:
  - `apps/*` - Frontend applications
  - `services/*` - Backend services and workers

### Entry Points

- **Frontend**: `apps/webapp/` → `@opencode-orchestrator/webapp`
- **Backend**: `services/backend/` → `@opencode-orchestrator/backend`
- **Worker**: `services/worker/` → `@opencode-orchestrator/worker` **[TODO]**

### Workspace Scripts

- `dev` - Start development servers
- `build` - Build all packages
- `test` - Run all tests
- `lint` - Run linting across workspace

## Tech Stack

### Package Manager

- **PNPM** (v8+) - Fast, disk space efficient package manager
- **Workspace Feature**: Monorepo support with workspace protocol

### Frontend Framework

- **Next.js** (v15+) - React framework with App Router
- **React** (v18+) - UI library
- **TypeScript** (v5+) - Type-safe JavaScript

### Frontend UI & Styling

- **ShadCN UI** - Component system built on Radix UI
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Unstyled, accessible component primitives
- **Lucide React** - Icon library
- **React Icons** - Additional icon sets

### Backend Framework

- **Convex** (v1+) - Realtime backend-as-a-service platform
- **Convex Helpers** - Session management and auth utilities
- **Zod** - Schema validation and type inference

### Development Tools

- **Nx** (v20+) - Monorepo build orchestration and task running
- **Vite** - Fast build tool and dev server (via Vitest)
- **Vitest** - Unit testing framework

### Linting & Formatting

- **Biome** - Fast linter and formatter (Prettier/ESLint replacement)

### Authentication & Security

- **Google OAuth** - Social login provider
- **Convex Sessions** - Server-side session management via convex-helpers
- **Crypto Module** - Cryptographic utilities for tokens and secrets

### Content Management

- **MDX** - Markdown with JSX for rich content authoring

### Build & Deployment

- **Next.js Build** - Production optimization and static generation
- **PWA Support** - Progressive Web App capabilities

### Core Libraries & Dependencies

- **date-fns** - Date manipulation and formatting
- **nanoid** - Compact, URL-safe unique ID generation **[TODO - ADD]**
- **clsx** / **tailwind-merge** - Conditional CSS class utilities

### Third-Party Service Clients

- **Opencode SDK** - Local code execution and session management **[TODO - ADD]**

### Testing Strategy

- **Vitest** - Backend unit testing (configured for Convex functions)
- **Frontend Testing** - Not yet implemented **[TODO]**
- **Backend Testing** - Partial coverage (auth.spec.ts exists)
- **Integration Testing** - Not yet implemented **[TODO]**
- **Type Checking** - TypeScript strict mode enabled
- **Quality Gates** - Biome linting enforced

## Development Patterns

### Authentication & Authorization

- **Session Management** - convex-helpers SessionIdArg pattern for backend auth
- **Frontend Hooks** - useSessionQuery, useSessionMutation, useSessionAction
- **Auth Provider** - React context provider for auth state
- **Protected Routes** - RequireLogin and AdminGuard components
- **Machine Authentication** - Token-based auth with `<machine_id>:<machine_secret>` format **[TODO]**

### Code Organization & Quality

- **Feature Modules** - Organized by domain in `src/modules/`
- **Shared Components** - Reusable UI in `src/components/`
- **Type Safety** - Strict TypeScript with explicit interfaces
- **Configuration Management** - Centralized feature flags in backend config
- **ID Generation** - Client-side nanoid for all primary identifiers **[TODO]**

### User Experience & Interface

- **Dark Mode** - Theme provider with system preference detection
- **Semantic Colors** - Prefer semantic color classes (foreground, background, muted, etc.)
- **Responsive Design** - Mobile-first with Tailwind breakpoints
- **Real-time Updates** - Convex subscriptions for live data
- **Progressive Enhancement** - PWA capabilities for offline support

### Cross-Cutting Concerns

- **Error Handling** - Callback error/success cards for OAuth flows
- **Loading States** - Skeleton components for async data
- **Toast Notifications** - Sonner for user feedback
- **Real-time Communication** - Convex subscriptions for bidirectional data flow **[TODO - EXPAND FOR CHAT]**

## Architecture Patterns

### Three-Tier Distributed Architecture

- **Presentation Layer**: Next.js webapp with React components
- **Coordination Layer**: Convex backend as source of truth and real-time message broker
- **Execution Layer**: Local worker machines running Opencode processes **[TODO]**

### Worker Orchestration Pattern **[TODO]**

- **Stateless Workers**: All state stored in Convex, workers are disposable
- **Session-based Execution**: Each chat spawns isolated Opencode session
- **Dual-channel Messaging**: Streaming chunks + full messages for real-time UX
- **Graceful Recovery**: Workers can restart and resume from Convex state

### ID Management Strategy **[TODO]**

- **Client-Generated IDs**: nanoid for machines (frontend), workers (machine process), sessions (Opencode)
- **Convex IDs Ignored**: Custom IDs used for all business logic
- **Cross-System Identity**: IDs meaningful across all system boundaries

## Core Interfaces **[TODO]**

### Machine Interface

```typescript
interface IMachine {
  // Machine identification
  readonly machineId: string;
  readonly machineToken: string; // Format: <machine_id>:<machine_secret>
  readonly rootDirectory: string;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Worker management
  registerWorker(workingDirectory: string): Promise<string>; // Returns workerId
  getWorkers(): Promise<IWorker[]>;

  // Status
  getStatus(): MachineStatus;
  heartbeat(): Promise<void>;
}

interface MachineStatus {
  online: boolean;
  lastSeen: Date;
  workerCount: number;
}
```

### Worker Interface

```typescript
interface IWorker {
  // Worker identification
  readonly workerId: string;
  readonly machineId: string;
  readonly workingDirectory: string;

  // Session management
  startSession(): Promise<string>; // Returns sessionId
  endSession(sessionId: string): Promise<void>;
  getSessions(): Promise<IChatSession[]>;

  // Message handling
  processMessage(sessionId: string, message: string): Promise<void>;

  // Status
  getStatus(): WorkerStatus;
}

interface WorkerStatus {
  activeSessionCount: number;
  lastActivity: Date;
}

interface IChatSession {
  sessionId: string;
  workerId: string;
  status: "active" | "idle" | "terminated";
  lastActivity: Date;
  idleTimeout: number; // milliseconds, default 300000 (5 min)
}
```

## Implementation Status

### Implemented ✅

- Frontend: Next.js app with auth, profile, admin
- Backend: Convex with auth, feature flags
- UI: ShadCN component library with dark mode
- Auth: Google OAuth and anonymous login
- Features: Attendance, checklists, discussions, presentations, password protection
- **Worker Chat UI**: Complete frontend implementation with mock data ✅
  - Machine management (empty state, creation, token display)
  - Worker selection and status display
  - Session list and restoration
  - Chat interface with message streaming simulation
  - Flat, polished design

### In Progress 🚧

- Backend implementation for worker orchestration (backend APIs still TODO)

### Not Started ❌ **[TODO]**

- Worker service implementation (services/worker/)
- Machine registration backend APIs
- Worker registration backend APIs
- Chat session backend APIs
- Opencode integration
- Backend worker/machine Convex functions
- Dual-channel messaging backend
- Session timeout and recovery backend
- Integration tests for orchestration flows
