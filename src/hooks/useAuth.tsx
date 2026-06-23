import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'judge' | 'gym_coach';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  rolesLoaded: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isJudge: boolean;
  isGymCoach: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const authRequestId = useRef(0);

  const fetchUserRoles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_roles', { _user_id: userId });
      if (error) {
        console.error('Error fetching roles:', error);
        return [];
      }
      return (data || []) as AppRole[];
    } catch (err) {
      console.error('Error fetching roles:', err);
      return [];
    }
  }, []);

  const applySession = useCallback(async (nextSession: Session | null) => {
    const requestId = ++authRequestId.current;

    setLoading(true);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setRoles([]);
      setRolesLoaded(true);
      setLoading(false);
      return;
    }

    setRoles([]);
    setRolesLoaded(false);
    const nextRoles = await fetchUserRoles(nextSession.user.id);

    if (authRequestId.current !== requestId) return;

    setRoles(nextRoles);
    setRolesLoaded(true);
    setLoading(false);
  }, [fetchUserRoles]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Defer role fetching to avoid deadlock
        setTimeout(() => applySession(session), 0);
      }
    );

    // THEN check for existing session
    const initialRequestId = authRequestId.current;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (authRequestId.current !== initialRequestId) return;
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  const signIn = async (email: string, password: string) => {
    authRequestId.current += 1;
    setLoading(true);
    setRolesLoaded(false);
    setRoles([]);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setRolesLoaded(true);
    } else if (data.session) {
      await applySession(data.session);
    }
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRoles([]);
    setRolesLoaded(true);
    setLoading(false);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  
  const isAdmin = hasRole('admin');
  const isJudge = hasRole('judge');
  const isGymCoach = hasRole('gym_coach');

  return (
    <AuthContext.Provider value={{
      user,
      session,
      roles,
      loading,
      rolesLoaded,
      signIn,
      signUp,
      signOut,
      hasRole,
      isAdmin,
      isJudge,
      isGymCoach,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
