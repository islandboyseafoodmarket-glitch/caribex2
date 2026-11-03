"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { PORTAL_COPY, readPortalLanguage, savePortalLanguage, type PortalLanguage } from "../portal-copy";

export default function CustomerResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [language, setLanguage] = useState<PortalLanguage>("en");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = PORTAL_COPY[language];

  useEffect(() => {
    const initial = readPortalLanguage();
    setLanguage(initial);
    document.documentElement.lang = initial;
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

  function changeLanguage(next: PortalLanguage) {
    setLanguage(next);
    savePortalLanguage(next);
    document.documentElement.lang = next;
  }

  async function savePassword() {
    setError(null);
    setMessage(null);
    if (password.length < 8) { setError(t.passwordMin); return; }
    if (password !== confirmation) { setError(t.passwordMismatch); return; }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    setSaving(false);
    if (updateError) { setError(t.passwordError); return; }
    setPassword("");
    setConfirmation("");
    setMessage(t.resetSuccess);
  }

  const languageControl = <div className="portal-language-toggle" role="group" aria-label={t.languageLabel}><button type="button" className={language === "en" ? "is-active" : ""} aria-pressed={language === "en"} onClick={() => changeLanguage("en")}>EN</button><span aria-hidden="true">|</span><button type="button" className={language === "es" ? "is-active" : ""} aria-pressed={language === "es"} onClick={() => changeLanguage("es")}>ES</button></div>;

  if (!ready) return <main className="portal-page portal-centered" lang={language}><section className="portal-card portal-first-login portal-reset-card"><div className="portal-reset-top"><Image className="reset-page-logo" src="/imagenes/logo-pages.png" alt={t.brand} width={320} height={137} priority />{languageControl}</div><p>{t.resetPreparing}</p></section></main>;
  if (!hasSession) return <main className="portal-page portal-centered" lang={language}><section className="portal-card portal-first-login portal-reset-card"><div className="portal-reset-top"><Image className="reset-page-logo" src="/imagenes/logo-pages.png" alt={t.brand} width={320} height={137} priority />{languageControl}</div><h1>{t.resetUnavailable}</h1><p>{t.resetExpired}</p><Link href="/portal/login" className="portal-button">{t.returnPortal}</Link></section></main>;

  return (
    <main className="portal-page portal-centered" lang={language}>
      <section className="portal-card portal-first-login portal-reset-card">
        <div className="portal-reset-top"><Image className="reset-page-logo" src="/imagenes/logo-pages.png" alt={t.brand} width={320} height={137} priority />{languageControl}</div>
        <p className="customer-login-eyebrow">{t.resetEyebrow}</p>
        <h1>{t.resetTitle}</h1>
        <p>{t.resetDescription}</p>
        <div className="portal-password-row portal-reset-password-fields"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t.newPassword} autoComplete="new-password" /><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={t.confirmPassword} autoComplete="new-password" /><button type="button" className="portal-button" disabled={saving} onClick={() => void savePassword()}>{saving ? t.saving : t.saveNewPassword}</button></div>
        {error && <small className="portal-error" role="alert">{error}</small>}
        {message && <><small className="portal-success" role="status">{message}</small><Link href="/portal/login" className="customer-login-back">{t.signInAfterReset}</Link></>}
      </section>
    </main>
  );
}
