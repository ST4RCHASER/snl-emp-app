import { Suspense, useState, useMemo } from "react";
import { tokens, Spinner, Avatar, Button } from "@fluentui/react-components";
import {
  SignOut24Regular,
  ChevronLeft24Regular,
  Settings24Regular,
  Person24Regular,
  People24Regular,
  Calendar24Regular,
  ChatWarning24Regular,
  Clock24Regular,
  PeopleTeam24Regular,
} from "@fluentui/react-icons";
import { useAuth } from "@/auth/provider";
import { signOut } from "@/auth/client";
import { getAppById, type AppDefinition } from "../apps/registry";
import { WindowContext } from "./WindowContext";
import type { Role } from "@snl-emp/shared";

// Icon mapping for apps
const iconMap: Record<string, React.ReactNode> = {
  Person: <Person24Regular />,
  People: <People24Regular />,
  Calendar: <Calendar24Regular />,
  ChatWarning: <ChatWarning24Regular />,
  Clock: <Clock24Regular />,
  PeopleTeam: <PeopleTeam24Regular />,
  Settings: <Settings24Regular />,
};

// Mobile apps in specific order
const MOBILE_APP_ORDER = [
  "profile",
  "leave-management",
  "complaints",
  "work-logs",
  "employee-directory",
];

interface MobileAppDrawerProps {
  backgroundImage: string;
}

export function MobileAppDrawer({ backgroundImage }: MobileAppDrawerProps) {
  const { user } = useAuth();
  const [openApp, setOpenApp] = useState<AppDefinition | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const userRole = ((user as { role?: string })?.role as Role) || "EMPLOYEE";

  // Get apps in the specified order, filtered by role
  const availableApps = useMemo(() => {
    return MOBILE_APP_ORDER.map((appId) => getAppById(appId)).filter(
      (app): app is AppDefinition => {
        if (!app) return false;
        // Check role permissions
        if (!app.roles) return true;
        if (userRole === "DEVELOPER") return true;
        return app.roles.includes(userRole);
      },
    );
  }, [userRole]);

  const handleOpenApp = (app: AppDefinition) => {
    setOpenApp(app);
    setRefreshKey((k) => k + 1);
  };

  const handleCloseApp = () => {
    setOpenApp(null);
  };

  // If an app is open, show it full screen
  if (openApp) {
    const AppComponent = openApp.component;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          background: tokens.colorNeutralBackground1,
          zIndex: 1000,
        }}
      >
        {/* Mobile App Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: tokens.colorNeutralBackground3,
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
            flexShrink: 0,
          }}
        >
          <Button
            appearance="subtle"
            icon={<ChevronLeft24Regular />}
            onClick={handleCloseApp}
          />
          <span style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>
            {openApp.name}
          </span>
        </div>

        {/* App Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            background: tokens.colorNeutralBackground1,
          }}
        >
          <Suspense
            fallback={
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <Spinner size="large" />
              </div>
            }
          >
            <WindowContext.Provider
              value={{
                windowId: `mobile-${openApp}`,
                refreshKey,
                windowProps: undefined,
              }}
            >
              <AppComponent />
            </WindowContext.Provider>
          </Suspense>
        </div>
      </div>
    );
  }

  // Show app drawer (home screen)
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Status Bar / Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: "rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar
            size={36}
            name={user?.name || user?.email || "User"}
            image={{ src: user?.image || undefined }}
          />
          <div>
            <div
              style={{
                fontWeight: 600,
                color: "#fff",
                fontSize: 14,
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              {user?.name || user?.email?.split("@")[0] || "User"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.8)",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              {userRole}
            </div>
          </div>
        </div>
        <Button
          appearance="subtle"
          icon={<SignOut24Regular style={{ color: "#fff" }} />}
          onClick={async () => {
            await signOut();
            window.location.reload();
          }}
          style={{ color: "#fff" }}
        />
      </div>

      {/* App Grid */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "24px",
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 28,
            maxWidth: 320,
            margin: "0 auto",
          }}
        >
          {availableApps.map((app) => (
            <button
              key={app.id}
              onClick={() => handleOpenApp(app)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                padding: 12,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                borderRadius: 16,
                transition: "transform 0.15s, background 0.15s",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.9)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = "scale(0.9)";
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {/* App Icon */}
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 22,
                  background: "rgba(255, 255, 255, 0.95)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                  color: tokens.colorBrandForeground1,
                  fontSize: 40,
                }}
              >
                {iconMap[app.icon] || <Settings24Regular />}
              </div>
              {/* App Name */}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#fff",
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                  textAlign: "center",
                  lineHeight: 1.3,
                  maxWidth: 110,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {app.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Home Indicator */}
      <div
        style={{
          padding: "12px 0 20px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 134,
            height: 5,
            borderRadius: 3,
            background: "rgba(255,255,255,0.5)",
          }}
        />
      </div>
    </div>
  );
}
