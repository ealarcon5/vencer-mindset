// Auth context: phone-OTP sign-in via Supabase, plus a live session the whole
// app can read. Wraps the app in app/_layout.tsx.

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { deviceTimezone } from "./time";

type AuthState = {
  session: Session | null;
  loading: boolean;
  signInWithPhone: (phone: string) => Promise<{ error?: string }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInWithPhone(phone: string) {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error: error?.message };
  }

  async function verifyOtp(phone: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    if (error) return { error: error.message };
    // Store the device timezone on first sign-in so deadlines resolve correctly.
    if (data.user) {
      await supabase
        .from("profiles")
        .update({ timezone: deviceTimezone() })
        .eq("id", data.user.id);
    }
    return {};
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, loading, signInWithPhone, verifyOtp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
