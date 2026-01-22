import { createContext, useContext, type ReactNode } from "react";
import { useSession } from "./client";

type SessionData = ReturnType<typeof useSession>["data"];

interface AuthContextType {
  user: NonNullable<SessionData>["user"] | null;
  session: NonNullable<SessionData>["session"] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();

  const value: AuthContextType = {
    user: data?.user ?? null,
    session: data?.session ?? null,
    isLoading: isPending,
    isAuthenticated: !!data?.user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
