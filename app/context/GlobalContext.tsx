"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface SessionInfo {
  email: string;
  role: "admin" | "investor";
  userId: string;
}

interface GlobalState {
  session: SessionInfo | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const GlobalContext = createContext<GlobalState>({
  session: null,
  loading: true,
  refreshSession: async () => {},
  logout: async () => {},
});

export function GlobalProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      setSession(res.ok ? await res.json() : null);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => setSession(res.ok ? await res.json() : null))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <GlobalContext.Provider value={{ session, loading, refreshSession, logout }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobal() {
  return useContext(GlobalContext);
}
