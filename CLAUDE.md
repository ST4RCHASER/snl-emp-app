# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Push schema to database (development)
pnpm db:push

# Run database migrations
pnpm db:migrate

# Open Prisma Studio
pnpm db:studio

# Start all development servers (API + Web)
pnpm dev

# Start only API server
pnpm dev:api

# Start only Web server
pnpm dev:web

# Build all packages
pnpm build

# Type check all packages
pnpm typecheck
```

## Tech Stack

- **Runtime**: Bun
- **Package Manager**: pnpm (with workspaces)
- **Build System**: Turborepo
- **Backend**: ElysiaJS (type-safe web framework)
- **Frontend**: React 18 + Vite
- **Routing**: TanStack Router
- **Data Fetching**: TanStack Query
- **UI Components**: Fluent UI React v9
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Better Auth with Google SSO
- **Type Safety**: Eden Treaty (E2E type safety from API to client)
- **Language**: TypeScript (strict mode enabled)

## Project Structure

```
snl-emp-app/
├── apps/
│   ├── api/                 # ElysiaJS backend (port 3000)
│   │   └── src/
│   │       ├── auth/        # Better Auth configuration
│   │       ├── routes/      # API routes (employees, leaves, complaints, settings, announcements)
│   │       ├── middleware/  # RBAC middleware
│   │       ├── app.ts       # Main Elysia app
│   │       └── index.ts     # Entry point
│   └── web/                 # React frontend (port 5173)
│       └── src/
│           ├── api/         # Eden client + TanStack Query hooks
│           ├── auth/        # Better Auth client
│           ├── components/
│           │   ├── desktop/ # Window management (Desktop, Window, Taskbar, WindowContext)
│           │   └── apps/    # Application windows (Profile, Settings, LeaveManagement, etc.)
│           ├── stores/      # Zustand stores (windowStore)
│           └── routes/      # TanStack Router routes
├── packages/
│   ├── db/                  # Prisma client package
│   └── shared/              # Shared types and constants
└── prisma/
    └── schema.prisma        # Database schema
```

## Architecture

### Monorepo Structure
- Uses pnpm workspaces for package management
- Turborepo for task orchestration and caching
- Shared packages for code reuse between apps

### Backend (apps/api)
- ElysiaJS with method chaining for route definitions
- Better Auth handles Google SSO authentication
- RBAC middleware for role-based access control
- Routes export types for Eden Treaty inference
- Swagger documentation at `/swagger`

### Frontend (apps/web)
- Desktop-like UI similar to Synology DSM
- Window management with react-rnd (draggable/resizable)
- Zustand for window state management
- TanStack Query for server state
- Fluent UI v9 components
- Window animations (open, close, minimize, restore, maximize)
- Window refresh button to reload app data

### Database
- Prisma ORM with PostgreSQL
- Output generated to `packages/db/src/generated/prisma`
- Driver adapter pattern with PrismaPg (connection pooling)

## Roles

- **EMPLOYEE**: Basic access (own profile, own leaves, submit complaints)
- **HR**: Can edit employees, manage complaints, configure settings, manage announcements
- **MANAGEMENT**: Can approve leave requests for assigned employees
- **DEVELOPER**: Full access to everything (superadmin, bypasses all role checks)

## Key Patterns

### Adding a new API route
```typescript
// apps/api/src/routes/example.ts
import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/plugin.js";

export const exampleRoutes = new Elysia({ prefix: "/api/example" })
  .use(authPlugin)
  .get("/", async ({ user, error }) => {
    if (!user) return error(401, { message: "Unauthorized" });
    // ... handler logic
  });
```

Then register in `apps/api/src/app.ts`:
```typescript
.use(exampleRoutes)
```

### Using auth macros in routes
```typescript
// Require authentication only
.get("/protected", ({ user }) => { ... }, { auth: true })

// Require specific roles
.get("/admin", ({ user }) => { ... }, { roles: ["HR", "DEVELOPER"] })
```

### Adding a new TanStack Query hook
```typescript
// apps/web/src/api/queries/example.ts
import { queryOptions } from "@tanstack/react-query";
import { api } from "../client";

export const exampleQueries = {
  all: queryOptions({
    queryKey: ["examples"],
    queryFn: async () => {
      const { data, error } = await api.api.example.get();
      if (error) throw error;
      return data;
    },
  }),
};
```

### Adding a mutation with cache invalidation
```typescript
export function useCreateExample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExampleInput) => {
      const { data, error } = await api.api.example.post(input);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examples"] });
    },
  });
}
```

### Adding a new application window
1. Create component in `apps/web/src/components/apps/NewApp/index.tsx`
2. Register in `apps/web/src/components/apps/registry.ts`:
```typescript
{
  id: "new-app",
  name: "New App",
  icon: "IconName",  // Fluent UI icon name
  component: lazy(() => import("./NewApp")),
  defaultSize: { width: 800, height: 600 },
  roles: ["HR", "DEVELOPER"],  // Optional: restrict by role
}
```
3. Add icon mapping in `AppIcon.tsx` and `Taskbar.tsx`

### RBAC helper functions
Located in `apps/api/src/middleware/rbac.ts`:
- `requireRoles(user, roles)` - Check if user has required roles
- `isDeveloper(user)`, `isHR(user)`, `isManagement(user)`
- `canManageEmployees(user)`, `canApproveLeaves(user)`, `canManageComplaints(user)`, `canManageSettings(user)`

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL`: PostgreSQL connection string
- `BETTER_AUTH_SECRET`: Min 32 character secret
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: From Google Cloud Console
- `VITE_API_URL`: API URL for frontend (default: http://localhost:3000)

## Window System

### Window State Management (windowStore.ts)
- Windows have states: `id`, `appId`, `title`, `isMinimized`, `isMaximized`, `isFocused`, `position`, `size`, `zIndex`, `animationState`, `refreshKey`
- Animation states: `idle`, `opening`, `closing`, `minimizing`, `restoring`, `maximizing`
- `refreshKey` is incremented when reload button is clicked to trigger data refresh

### Window Refresh Pattern
Each app uses `useWindowRefresh` hook from `WindowContext.tsx` to invalidate TanStack Query cache when:
1. Window opens (on mount)
2. User clicks the reload button in title bar

```typescript
// In app component
import { useWindowRefresh } from "@/components/desktop/WindowContext";

export default function MyApp() {
  const queryKeys = useMemo(() => [["myQueryKey"]], []);
  useWindowRefresh(queryKeys);
  // ...
}
```

## Available Apps

| App | File | Description | Roles |
|-----|------|-------------|-------|
| Profile | `apps/Profile` | View/edit own profile, leave balance | All |
| Employee Directory | `apps/EmployeeDirectory` | List/edit employees | All (edit: HR) |
| Leave Management | `apps/LeaveManagement` | Request/approve leaves | All (approve: Management) |
| Complaint System | `apps/ComplaintSystem` | Submit/manage complaints | All (manage: HR) |
| Calendar | `apps/Calendar` | Google Calendar integration | All |
| Settings | `apps/Settings` | App preferences, leave policy | All (policy: HR) |
| Announcements | `apps/Announcements` | Company announcements | All (manage: HR) |

## Announcements Feature

### Database Schema (prisma/schema.prisma)
- `Announcement`: id, title, content (rich HTML), images (JSON), order, isActive, createdBy, timestamps
- `AnnouncementRead`: tracks which users have read which announcements

### Key Behaviors
- New announcements are created at order 0 (top), existing ones shift down
- API returns `isRead` flag for each announcement based on user's read receipts
- Auto-launches for non-HR users when there are unread announcements
- First announcement auto-selected and marked as read when window opens
- "Mark all as read" button appears when there are unread items

### Rich Text Editor (RichTextEditor.tsx)
- Uses contenteditable with document.execCommand
- Toolbar: undo/redo, headings, bold/italic/underline/strikethrough, alignment, lists, quote, code, link, image
- Image upload to `https://up.m1r.ai/upload` with `uploadType: 0`
- Uses useRef for initialization to prevent cursor jumping issues
