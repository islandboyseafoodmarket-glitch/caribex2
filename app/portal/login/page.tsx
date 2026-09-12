"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function CustomerPortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (signInError || !data.user) {
      await fetch("/api/customer-login-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      setError("We could not sign you in. Use your registered email and your Caribex account password."); setLoading(false); return;
    }
    const { data: customer, error: customerError } = await supabase.from("numero_cliente").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
    if (customerError || !customer) { await supabase.auth.signOut(); setError("This login is not connected to a customer portal account."); setLoading(false); return; }
    router.push("/portal");
  }

  async function forgotPassword() {
    if (!email) { setError("Enter your registered email first."); return; }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/portal` });
    await fetch("/api/customer-portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setMessage(resetError ? "We could not send the reset link." : "Check your email for a password-reset link.");
  }

  return <main className="customer-login-page"><section className="customer-login-card"><Image src="/imagenes/logo.png" alt="Caribex Logistics Group" width={165} height={50} /><p className="customer-login-eyebrow">Customer portal</p><h1>Track your shipments</h1><p className="customer-login-intro">Sign in to view your shipping history, shipment statuses, counts, invoices, and ferry bookings.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" required /></label><p className="customer-login-help">First-time sign-in? Use <strong>Caribex</strong> plus your account number, such as <strong>Caribex300</strong>. You will be required to create a new password.</p><button type="submit" className="portal-button" disabled={loading}>{loading ? "Signing in…" : "Sign in to customer portal"}</button></form><button type="button" className="customer-login-link" onClick={() => void forgotPassword()}>Forgot password?</button>{error && <p className="customer-login-error">{error}</p>}{message && <p className="customer-login-success">{message}</p>}<Link href="/" className="customer-login-back">Back to Caribex website</Link></section></main>;
}
