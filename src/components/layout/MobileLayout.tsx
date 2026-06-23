import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMobileAuth } from "@/hooks/useMobileAuth";

export function MobileLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useMobileAuth();

  const canGoBack = location.pathname !== "/m" && location.pathname !== "/m/login";
  const showHeader = location.pathname !== "/m/login"
    && location.pathname !== "/m/forgot-password"
    && location.pathname !== "/m/reset-password"
    && !/\/record$/.test(location.pathname);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {showHeader && (
        <header
          className="bg-sidebar text-sidebar-foreground px-4 flex items-center justify-between sticky top-0 z-30"
          style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)", paddingBottom: "0.75rem" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {canGoBack ? (
              <button
                aria-label="Back"
                onClick={() => navigate(-1)}
                className="p-1 -ml-1 rounded-md hover:bg-sidebar-accent"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            ) : (
              <div className="h-7 w-7 rounded-md bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-bold">
                C
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Cheermatch</div>
              {user && <div className="text-[11px] text-sidebar-foreground/60 truncate">{user.organization_name || user.email}</div>}
            </div>
          </div>
          {user && (
            <Button
              variant="ghost" size="sm"
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => { signOut(); navigate("/m/login", { replace: true }); }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </header>
      )}
      <main
        className="flex-1"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
        <Outlet />
      </main>
    </div>
  );
}
