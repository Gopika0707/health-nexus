import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { JWTPayload, UserRole } from "@/types";

interface AuthState {
  token: string | null;
  role: UserRole | null;
  userId: string | null;
  patientId: string | null;
  doctorId: string | null;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, redirectTo: string) => void;
  logout: () => void;
}

const emptyAuth: AuthState = {
  token: null,
  role: null,
  userId: null,
  patientId: null,
  doctorId: null,
  isAuthenticated: false,
};

function decodeJWT(token: string): JWTPayload | null {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = decodeURIComponent(
      atob(normalized)
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(decoded) as JWTPayload;
  } catch {
    return null;
  }
}

function getStoredAuth(): AuthState {
  const token = localStorage.getItem("hn_token");
  if (!token) {
    return emptyAuth;
  }

  const decoded = decodeJWT(token);
  if (!decoded || decoded.exp * 1000 < Date.now()) {
    localStorage.removeItem("hn_token");
    return emptyAuth;
  }

  return {
    token,
    role: decoded.role,
    userId: decoded.user_id,
    patientId: decoded.patient_id ?? null,
    doctorId: decoded.doctor_id ?? null,
    isAuthenticated: true,
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [auth, setAuth] = useState<AuthState>(getStoredAuth);

  const login = useCallback((token: string, redirectTo: string) => {
    localStorage.setItem("hn_token", token);
    const decoded = decodeJWT(token);
    if (!decoded) {
      return;
    }

    setAuth({
      token,
      role: decoded.role,
      userId: decoded.user_id,
      patientId: decoded.patient_id ?? null,
      doctorId: decoded.doctor_id ?? null,
      isAuthenticated: true,
    });
    navigate(redirectTo);
  }, [navigate]);

  const logout = useCallback(() => {
    localStorage.removeItem("hn_token");
    setAuth(emptyAuth);
    navigate("/");
  }, [navigate]);

  useEffect(() => {
    const syncAuth = () => setAuth(getStoredAuth());
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  const value = useMemo(() => ({ ...auth, login, logout }), [auth, login, logout]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
