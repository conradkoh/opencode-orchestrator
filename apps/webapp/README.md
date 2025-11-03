# OpenCode Orchestrator - Web Application

The frontend web application for OpenCode Orchestrator, built with Next.js 15 and Convex.

## Features

- 🔐 **Authentication**: Google OAuth and anonymous login
- 💬 **AI Chat Interface**: Real-time chat with OpenCode assistants
- 👥 **Session Management**: Create and manage multiple chat sessions
- 🎨 **Dark Mode**: Fully themed UI with light/dark mode support
- 📊 **Admin Dashboard**: System administration and configuration
- 📱 **PWA Support**: Progressive web app capabilities
- 🔄 **Real-time Updates**: Live data synchronization via Convex

## Getting Started

### Running from Root

The recommended way to run the application is from the project root:

```bash
# From project root
pnpm run dev
```

This will start both the webapp at http://localhost:3000 and the Convex backend.

### Running Standalone

If you need to run just the webapp:

```bash
# From apps/webapp directory
cd apps/webapp
pnpm run dev
```

> **Note**: Ensure the Convex backend is running separately when using standalone mode.

## Project Structure

```
apps/webapp/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── app/                # Main application pages
│   │   ├── login/              # Authentication pages
│   │   ├── test/               # Test/demo pages
│   │   └── layout.tsx          # Root layout
│   ├── components/             # Reusable UI components (ShadCN)
│   ├── modules/                # Feature modules
│   │   ├── admin/              # Admin dashboard
│   │   ├── assistant/          # AI assistant chat
│   │   ├── auth/               # Authentication
│   │   ├── attendance/         # Attendance tracking
│   │   ├── checklist/          # Checklist features
│   │   ├── discussion/         # Discussion forums
│   │   ├── presentation/       # Presentation mode
│   │   └── theme/              # Theme management
│   └── lib/                    # Utilities and helpers
├── public/                     # Static assets
└── package.json
```

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **UI Components**: ShadCN UI with Radix UI primitives
- **Styling**: Tailwind CSS v4
- **Backend**: Convex (real-time database and serverless functions)
- **Authentication**: Session-based with convex-helpers
- **Icons**: Lucide React, Radix Icons, React Icons
- **Forms**: React Hook Form with Zod validation
- **State Management**: Convex reactive queries

## Development Guidelines

See the [Frontend Development Guidelines](../../.cursor/rules) for coding standards and best practices, including:

- Dark mode implementation patterns
- ShadCN component usage
- Authentication patterns with session helpers
- Feature flag configuration

## Building

```bash
# Type checking
pnpm run typecheck

# Production build
pnpm run build

# Start production server
pnpm run start
```

## Deployment

See the [root README](../../README.md#deployment) for deployment instructions covering both Convex backend and Vercel frontend deployment.
