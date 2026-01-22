import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Button, Spinner, tokens } from "@fluentui/react-components";
import { useAuth } from "@/auth/provider";
import { signIn } from "@/auth/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="login-container">
        <Spinner size="huge" label="Loading..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  const handleGoogleLogin = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: window.location.origin + "/",
    });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              color: tokens.colorNeutralForeground1,
            }}
          >
            SNL Employee Portal
          </h1>
          <p
            style={{ margin: "8px 0 0", color: tokens.colorNeutralForeground3 }}
          >
            Sign in to access the employee management system
          </p>
        </div>

        <Button
          appearance="primary"
          size="large"
          onClick={handleGoogleLogin}
          style={{ width: "100%", height: 48 }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            style={{ marginRight: 12 }}
          >
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        <p
          style={{
            marginTop: 24,
            fontSize: 12,
            color: tokens.colorNeutralForeground4,
          }}
        >
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
