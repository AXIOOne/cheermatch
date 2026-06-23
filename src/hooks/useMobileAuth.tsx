import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { mobileSession, type MobileUser } from "@/lib/mobile-api";

type Ctx = {
  user: MobileUser | null;
  setUser: (u: MobileUser | null) => void;
  signOut: () => void;
  ready: boolean;
};

const MobileAuthContext = createContext<Ctx | null>(null);

export function MobileAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<MobileUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUserState(mobileSession.user);
    setReady(true);
  }, []);

  const value = useMemo<Ctx>(() => ({
    user,
    setUser: (u) => {
      if (u) mobileSession.save(u);
      else mobileSession.clear();
      setUserState(u);
    },
    signOut: () => {
      mobileSession.clear();
      setUserState(null);
    },
    ready,
  }), [user, ready]);

  return <MobileAuthContext.Provider value={value}>{children}</MobileAuthContext.Provider>;
}

export function useMobileAuth() {
  const ctx = useContext(MobileAuthContext);
  if (!ctx) throw new Error("useMobileAuth must be used within MobileAuthProvider");
  return ctx;
}
