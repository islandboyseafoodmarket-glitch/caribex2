"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const INACTIVITY_LIMIT_MS = 3 * 60 * 60 * 1000;
const ACTIVITY_KEY = "caribex:last-activity";
const PUBLIC_PATHS = ["/login", "/portal/login", "/portal/reset-password"];

export default function InactivityGuard() {
  useEffect(() => {
    if (PUBLIC_PATHS.includes(window.location.pathname)) return;

    let lastActivity = Number(window.localStorage.getItem(ACTIVITY_KEY) || Date.now());
    let activityWriteAt = 0;
    let signingOut = false;

    const signOutForInactivity = async () => {
      if (signingOut) return;
      signingOut = true;
      await supabase.auth.signOut();
      window.localStorage.removeItem(ACTIVITY_KEY);
      window.location.assign(window.location.pathname.startsWith("/portal") ? "/portal/login" : "/login");
    };

    const recordActivity = () => {
      const now = Date.now();
      if (now - activityWriteAt < 30_000) return;
      activityWriteAt = now;
      lastActivity = now;
      window.localStorage.setItem(ACTIVITY_KEY, String(now));
    };

    const checkInactivity = () => {
      const stored = Number(window.localStorage.getItem(ACTIVITY_KEY) || lastActivity);
      lastActivity = Math.max(lastActivity, stored);
      if (Date.now() - lastActivity >= INACTIVITY_LIMIT_MS) void signOutForInactivity();
    };

    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    const interval = window.setInterval(checkInactivity, 30_000);
    checkInactivity();

    return () => {
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
