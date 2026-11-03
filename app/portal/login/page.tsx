"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { PORTAL_COPY, readPortalLanguage, savePortalLanguage, type PortalLanguage } from "../portal-copy";

export default function CustomerPortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState<PortalLanguage>("en");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const t = PORTAL_COPY[language];

  useEffect(() => {
    const initial = readPortalLanguage();
    setLanguage(initial);
    document.documentElement.lang = initial;
  }, []);

  function changeLanguage(next: PortalLanguage) {
    setLanguage(next);
    savePortalLanguage(next);
    document.documentElement.lang = next;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (signInError || !data.user) {
      await fetch("/api/customer-login-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalizedEmail, success: false, reason: signInError?.message || "No authenticated user" }) });
      setError(t.loginProvisioningError);
      setLoading(false);
      return;
    }
    const { data: customer, error: customerError } = await supabase.from("numero_cliente").select("id").eq("email", normalizedEmail).maybeSingle();
    if (customerError || !customer) {
      await supabase.auth.signOut();
      await fetch("/api/customer-login-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalizedEmail, success: false, reason: "Authenticated user is not linked to a customer account" }) });
      setError(t.loginLinkError);
      setLoading(false);
      return;
    }
    await fetch("/api/customer-login-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalizedEmail, success: true, reason: "Portal login successful" }) });
    router.push("/portal");
  }

  async function forgotPassword() {
    setError(null);
    setMessage(null);
    if (!email.trim()) { setError(t.enterEmail); return; }
    const response = await fetch("/api/customer-portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase() }) });
    setMessage(response.ok ? t.resetSent : t.resetFailed);
  }

  return (
    <main className="customer-login-page" lang={language}>
      <section className="customer-login-card">
        <div className="customer-login-topline"><span>{t.loginEyebrow}</span><div className="portal-language-toggle" role="group" aria-label={t.languageLabel}><button type="button" className={language === "en" ? "is-active" : ""} aria-pressed={language === "en"} onClick={() => changeLanguage("en")}>EN</button><span aria-hidden="true">|</span><button type="button" className={language === "es" ? "is-active" : ""} aria-pressed={language === "es"} onClick={() => changeLanguage("es")}>ES</button></div></div>
        <Image src="/imagenes/logo-pages.png" alt={t.brand} width={220} height={94} />
        <h1>{t.loginTitle}</h1>
        <p className="customer-login-intro">{t.loginIntro}</p>
        <form onSubmit={submit}>
          <label>{t.emailLabel}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t.emailPlaceholder} autoComplete="email" required /></label>
          <label>{t.passwordLabel}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t.passwordPlaceholder} autoComplete="current-password" required /></label>
          <p className="customer-login-help">{t.firstLoginHelp}</p>
          <button type="submit" className="portal-button" disabled={loading}>{loading ? t.signingIn : t.signIn}</button>
        </form>
        <button type="button" className="customer-login-link" onClick={() => void forgotPassword()}>{t.forgotPassword}</button>
        {error && <p className="customer-login-error" role="alert">{error}</p>}
        {message && <p className="customer-login-success" role="status">{message}</p>}
        <Link href="/" className="customer-login-back">{t.backToWebsite}</Link>
      </section>
    </main>
  );
}
