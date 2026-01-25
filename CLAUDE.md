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

# Lint all packages
pnpm lint
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
│   │       ├── routes/      # API routes (employees, leaves, complaints, settings, audit, etc.)
│   │       ├── middleware/  # RBAC middleware, API logger
│   │       ├── app.ts       # Main Elysia app
│   │       └── index.ts     # Entry point
│   └── web/                 # React frontend (port 5173)
│       └── src/
│           ├── api/         # Eden client + TanStack Query hooks
│           ├── auth/        # Better Auth client
│           ├── components/
│           │   ├── desktop/ # Window management (Desktop, Window, Taskbar, WindowContext)
│           │   └── apps/    # Application windows (Profile, Settings, LeaveManagement, etc.)
│           ├── hooks/       # Custom hooks (useMobile)
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
- Better Auth handles Google SSO authentication with hooks for auth event logging
- RBAC middleware for role-based access control
- API logger middleware captures all API requests with user info
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
- Mobile-responsive layouts using `useMobile()` hook (768px breakpoint)

### Database
- Prisma ORM with PostgreSQL
- Output generated to `packages/db/src/generated/prisma`
- Driver adapter pattern with PrismaPg (connection pooling)

## Roles

- **EMPLOYEE**: Basic access (own profile, own leaves, submit complaints)
- **HR**: Can edit employees, manage complaints, configure settings, manage announcements
- **MANAGEMENT**: Can approve leave requests for assigned employees
- **DEVELOPER**: Full access to everything (superadmin, bypasses all role checks, access to Audit Logs)

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

Then register in `apps/api/src/routes/index.ts` and `apps/api/src/app.ts`:
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

### Adding a mutation with cache invalidation and action logging
```typescript
import { logAction } from "./audit";

export function useCreateExample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExampleInput) => {
      const { data, error } = await api.api.example.post(input);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["examples"] });
      logAction("create_example", "form", "Created new example", { ...variables });
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

### Shared role utilities
Located in `packages/shared/src/constants/index.ts`:
- `hasRole(userRole, requiredRoles)` - Check if user has one of the required roles (DEVELOPER bypasses)
- `canManageRole(actorRole, targetRole)` - Check if a role can manage another based on hierarchy

### User Type with Role
The `User` type in `apps/api/src/auth/index.ts` extends the Better Auth session user with the `role` field:
```typescript
export type User = Session["user"] & {
  role?: string | null;
};
```

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL`: PostgreSQL connection string
- `BETTER_AUTH_SECRET`: Min 32 character secret
- `BETTER_AUTH_URL`: Auth server URL (default: http://localhost:3000)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: From Google Cloud Console
- `PORT`: API server port (default: 3000)
- `FRONTEND_URL`: Frontend URL for CORS (default: http://localhost:5173)
- `VITE_API_URL`: API URL for frontend (default: http://localhost:3000)

## Window System

### Window State Management (windowStore.ts)
- Windows have states: `id`, `appId`, `title`, `isMinimized`, `isMaximized`, `isFocused`, `position`, `size`, `zIndex`, `animationState`, `refreshKey`
- Animation states: `idle`, `opening`, `closing`, `minimizing`, `restoring`, `maximizing`
- `refreshKey` is incremented when reload button is clicked to trigger data refresh
- `openWindow` accepts `forceNew` parameter - when true, always opens new window instance (used by desktop icons)
- Taskbar clicks focus existing window, desktop icon clicks open new instances

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

### Desktop Context Menu
- Right-click context menu only appears on desktop background (not inside app windows)
- Window.tsx uses `onContextMenu={(e) => e.stopPropagation()}` to prevent propagation

## Available Apps

| App | File | Description | Roles |
|-----|------|-------------|-------|
| Profile | `apps/Profile` | View/edit own profile, leave balance | All |
| Employee Directory | `apps/EmployeeDirectory` | List/edit employees | All (edit: HR) |
| Leave Management | `apps/LeaveManagement` | Request/approve leaves | All (approve: Management) |
| Complaint System | `apps/ComplaintSystem` | Submit/manage complaints | All (manage: HR) |
| Complaint Chat | `apps/ComplaintChat` | Real-time chat for complaints | All |
| Work Logs | `apps/WorkHours` | Track daily work hours | All |
| Calendar | `apps/Calendar` | Google Calendar integration | All |
| Notes | `apps/Notes` | Personal notes with folders | All |
| Settings | `apps/Settings` | App preferences, leave policy | All (policy: HR) |
| Announcements | `apps/Announcements` | Company announcements | All (manage: HR) |
| Team Dashboard | `apps/TeamDashboard` | Team overview for managers | MANAGEMENT, DEVELOPER |
| Team Calendar | `apps/TeamCalendar` | Team leave calendar | MANAGEMENT, DEVELOPER |
| Audit Logs | `apps/AuditLogs` | View action & API logs | DEVELOPER only |

## Audit Logging System

### Database Schema
- `ActionLog`: User actions (sign_in, sign_out, open_app, form submissions, navigation, etc.)
- `ApiLog`: All API requests with method, path, status, response time, user ID

### Backend Implementation
- **Auth hooks** (`apps/api/src/auth/index.ts`): Logs sign_in and sign_out events using `createAuthMiddleware`
- **API logger** (`apps/api/src/middleware/apiLogger.ts`): `logApiRequest()` function called from `onAfterHandle` hook
- **Audit routes** (`apps/api/src/routes/audit.ts`): Endpoints for fetching logs (DEVELOPER only)

### Frontend Implementation
- **Action logging** (`apps/web/src/api/queries/audit.ts`): `logAction(action, category, description, metadata)` helper
- Action logging added to: app opens, tab switches, form submissions, navigation events
- **AuditLogs app** shows both action logs and API logs with user name/email

### Adding Action Logging to Components
```typescript
import { logAction } from "@/api/queries/audit";

// Log navigation
const handleTabChange = (tab: string) => {
  setActiveTab(tab);
  logAction("switch_tab", "navigation", `Switched to ${tab} tab`, { tab });
};

// Log in mutation onSuccess
onSuccess: () => {
  logAction("create_item", "form", "Created new item");
}
```

### Action Categories
- `auth`: Sign in, sign out
- `app`: Open app, close app
- `navigation`: Tab switches, page navigation, view details
- `form`: Form submissions, updates, deletions

## Mobile Responsiveness

### useMobile Hook
```typescript
import { useMobile } from "@/hooks/useMobile";

export default function MyComponent() {
  const isMobile = useMobile(); // true when viewport < 768px
  
  return (
    <div style={{ 
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" 
    }}>
      {/* Content */}
    </div>
  );
}
```

### Mobile Patterns
- Tables become card lists on mobile
- Multi-column grids become single column
- Dialogs use full width on mobile
- Reduce padding/gaps on mobile
- Stack header elements vertically

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

## Elysia Hooks Order (apps/api/src/app.ts)

The order of middleware/hooks matters in Elysia:
```typescript
export const app = new Elysia()
  .use(cors(...))
  .use(swagger(...))
  .onRequest(...)        // 1. Request timing (before auth)
  .use(authPlugin)       // 2. Auth - derives user from session
  .onAfterHandle(...)    // 3. API logging (after auth, has user)
  .use(employeeRoutes)   // 4. Routes
  .use(leaveRoutes)
  // ... more routes
```

Hooks registered BEFORE routes apply to those routes. The `onAfterHandle` is placed after `authPlugin` so it has access to the `user` context for logging.
