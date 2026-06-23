import { Navigate, useLocation } from "react-router-dom";
import { useMobileAuth } from "@/hooks/useMobileAuth";

export function MobileProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, ready } = useMobileAuth();
  const location = useLocation();
  if (!ready) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/m/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
