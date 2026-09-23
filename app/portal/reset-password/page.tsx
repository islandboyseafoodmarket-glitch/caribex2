"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function CustomerResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const finish = (sessionExists: boolean) => {
      if (mounted) {
        setHasSession(sessionExists);
        setReady(true);
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") finish(Boolean(session));
    });

    void supabase.auth.getSession().then(({ data }) => finish(Boolean(data.session)));
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function savePassword() {
    setError(null);
    setMessage(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword("");
    setConfirmation("");
    setMessage("Your password was updated successfully. You can now sign in to your customer portal.");
  }

  if (!ready) {
    return <main className="portal-page portal-centered"><section className="portal-card portal-first-login"><p>Preparing your secure password reset…</p></section></main>;
  }

  if (!hasSession) {
    return <main className="portal-page portal-centered"><section className="portal-card portal-first-login"><Image className="reset-page-logo" src="/imagenes/logo-clean.png" alt="Caribex Logistics Group" width={320} height={96} priority /><h1>Reset link unavailable</h1><p>This password-reset link may have expired or already been used. Request a new link from the customer portal.</p><Link href="/portal/login" className="portal-button">Return to customer portal</Link></section></main>;
  }

  return <main className="portal-page portal-centered"><section className="portal-card portal-first-login"><Image className="reset-page-logo" src="/imagenes/logo-clean.png" alt="Caribex Logistics Group" width={320} height={96} priority /><p className="customer-login-eyebrow">Customer portal security</p><h1>Change your password</h1><p>Choose a new password for your Caribex customer portal.</p><div className="portal-password-row"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" autoComplete="new-password" /><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirm new password" autoComplete="new-password" /><button type="button" className="portal-button" disabled={saving} onClick={() => void savePassword()}>{saving ? "Saving…" : "Save new password"}</button></div>{error && <small className="portal-error">{error}</small>}{message && <><small className="portal-success">{message}</small><Link href="/portal/login" className="customer-login-back">Sign in to the customer portal</Link></>}</section></main>;
}
