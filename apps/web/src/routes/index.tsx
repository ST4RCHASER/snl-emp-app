import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Spinner } from "@fluentui/react-components";
import { useAuth } from "@/auth/provider";
import { Desktop } from "@/components/desktop/Desktop";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        }}
      >
        <Spinner size="huge" label="Loading..." style={{ color: "white" }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <Desktop />;
}
