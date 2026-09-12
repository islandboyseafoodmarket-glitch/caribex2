"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabaseClient";
import styles from "./login.module.css";

export default function LoginRoute() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEn = i18n.language.startsWith("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      void fetch("/api/customer-login-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      // Mostrar el mensaje real de Supabase para depurar, con un fallback amigable
      setError(
        error?.message ||
          (isEn ? "Incorrect email or password" : "Usuario o contraseña incorrectos")
      );
      setLoading(false);
      return;
    }

    const userId = data.user.id;

    // ¿Es administrador?
    const { data: adminRow } = await supabase
      .from("administradores")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (adminRow) {
      setLoading(false);
      router.push("/panel-admin");
      return;
    }

    // ¿Es personal?
    const { data: personalRow } = await supabase
      .from("personal")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    setLoading(false);

    if (personalRow) {
      router.push("/gestion-almacen");
      return;
    }

    const { data: customerRow } = await supabase
      .from("numero_cliente")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (customerRow) {
      router.push("/portal");
      return;
    }

    // No tiene rol asignado
    setError(
      isEn
        ? "Your user does not have an assigned role (admin/staff)"
        : "Tu usuario no tiene un rol asignado (admin/personal)"
    );
    await supabase.auth.signOut();
  };

  const handleBack = () => {
    router.push("/");
  };

  const handleForgotPassword = async () => {
    if (!email) { setError(isEn ? "Enter your email first." : "Primero ingresa tu correo."); return; }
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/portal` });
    await fetch("/api/customer-portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setResetMessage(resetError ? (isEn ? "We could not send the reset link." : "No pudimos enviar el enlace de recuperación.") : (isEn ? "Check your email for a password-reset link." : "Revisa tu correo para el enlace de recuperación."));
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e1b4b 25%, #7f1d1d 75%, #dc2626 100%)",
        fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <div className={styles.loginCard} style={{ marginInline: "1rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1
            style={{
              fontSize: "1.875rem",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "0.5rem",
            }}
          >
            {isEn ? "Welcome" : "Bienvenido"}
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            {isEn
              ? "Log in to manage your shipments"
              : "Inicia sesión para gestionar tus paquetes"}
          </p>
          <p style={{ margin: "0.5rem 0 0", color: "#64748b", fontSize: "0.8rem", lineHeight: 1.45 }}>
            {isEn
              ? "Staff and admin sign-in only. Customer portal access uses a separate customer account."
              : "Acceso solo para personal y administradores. El portal del cliente usa una cuenta separada."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label htmlFor="email" className={styles.inputGroupLabel}>
              <span className="fas fa-user" aria-hidden="true" />
              {isEn ? "Email" : "Correo"}
            </label>
            <input
              id="email"
              type="email"
              className={`${styles.customInput} ${styles.inputBase}`}
              placeholder={isEn ? "email@example.com" : "correo@ejemplo.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className="label" htmlFor="password">
              {isEn ? "PASSWORD" : "CONTRASEÑA"}
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={`${styles.customInput} ${styles.inputBase}`}
                placeholder={
                  isEn ? "Enter your password" : "Ingresa tu contraseña"
                }
                style={{ paddingRight: "2.5rem" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#0ea5e9",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword
                    ? isEn
                      ? "Hide password"
                      : "Ocultar contraseña"
                    : isEn
                      ? "Show password"
                      : "Mostrar contraseña"
                }
              >
                {showPassword ? (
                  // ojo tachado
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 9.88A3 3 0 0 1 12 15a3 3 0 0 1-2.12-.88" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  // ojo normal
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <p style={{ margin: "-0.5rem 0 1rem", color: "#64748b", fontSize: "0.78rem", lineHeight: 1.45 }}>
            {isEn
              ? "First-time customer sign-in: use your registered email and the password Caribex + your account number (for example, Caribex347). You will be asked to create a new password."
              : "Primer inicio de sesión: usa tu correo registrado y la contraseña Caribex + tu número de cuenta (por ejemplo, Caribex347). Se te pedirá crear una nueva contraseña."}
          </p>

          <button type="submit" className={styles.btnSignin} disabled={loading}>
            <span
              className="fas fa-sign-in-alt"
              aria-hidden="true"
            />
            {loading
              ? isEn
                ? "Signing in..."
                : "Ingresando..."
              : isEn
                ? "Sign in"
                : "Iniciar Sesión"}
          </button>

          <button type="button" onClick={() => void handleForgotPassword()} style={{ display: "block", margin: "0.75rem auto 0", border: 0, background: "transparent", color: "#2563eb", cursor: "pointer", fontSize: "0.82rem" }}>
            {isEn ? "Forgot password?" : "¿Olvidaste tu contraseña?"}
          </button>

          {error && (
            <p style={{ marginTop: "0.75rem", color: "#dc2626", fontSize: "0.85rem", textAlign: "center" }}>
              {error}
            </p>
          )}
          {resetMessage && <p style={{ marginTop: "0.75rem", color: "#166534", fontSize: "0.85rem", textAlign: "center" }}>{resetMessage}</p>}

          <button type="button" className={styles.btnBack} onClick={handleBack}>
            <span className="fa-solid fa-arrow-left" aria-hidden="true" />
            {isEn ? "Back" : "Volver"}
          </button>
        </form>
      </div>
    </div>
  );
}
