"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Mode = "registro" | "acceso";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("registro");
  const router = useRouter();

  return (
    <div className="login-wrapper">
      <main className="login-main">
        <div className="login-card">
          <div className="login-card-logo">
            <Image
              src="/imagenes/logo-clean.png"
              alt="Caribex Logistics Group"
              width={220}
              height={80}
              className="login-logo-image"
            />
          </div>
          <div className="login-tabs">
            <button
              type="button"
              onClick={() => setMode("registro")}
              className={
                "login-tab-button" + (mode === "registro" ? " active" : "")
              }
            >
              Registro
            </button>
            <button
              type="button"
              onClick={() => setMode("acceso")}
              className={
                "login-tab-button" + (mode === "acceso" ? " active" : "")
              }
            >
              Acceso
            </button>
            <div
              className="login-tab-indicator"
              style={{ transform: mode === "registro" ? "translateX(0%)" : "translateX(100%)" }}
            />
          </div>

          {mode === "registro" ? (
            <RegistroForm />
          ) : (
            <AccesoForm onLoginSuccess={() => router.push("/gestion-almacen")} />
          )}
        </div>
      </main>
    </div>
  );
}

function RegistroForm() {
  return (
    <div className="login-form-container">
      <div className="login-form-header">
        <h2>Crear Cuenta</h2>
        <p>Regístrate para gestionar tus envíos</p>
      </div>
      <form className="login-form">
        <div className="login-field">
          <label>Nombre de Usuario</label>
          <input type="text" placeholder="Crea tu usuario" />
        </div>
        <div className="login-field">
          <label>Contraseña</label>
          <input type="password" placeholder="Mínimo 8 caracteres" />
        </div>
        <button type="submit" className="login-primary-button">
          Registrarse
        </button>
      </form>
      <Link href="/" className="login-back-link">
        ← Volver al inicio
      </Link>
    </div>
  );
}

type AccesoFormProps = {
  onLoginSuccess: () => void;
};

function AccesoForm({ onLoginSuccess }: AccesoFormProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Aquí iría la validación / autenticación real en el futuro
    onLoginSuccess();
  };

  return (
    <div className="login-form-container">
      <div className="login-form-header">
        <h2>Bienvenido</h2>
        <p>Ingresa para rastrear tus paquetes</p>
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-field">
          <label>Nombre de Usuario</label>
          <input type="text" placeholder="Tu usuario" />
        </div>
        <div className="login-field">
          <label>Contraseña</label>
          <input type="password" placeholder="Tu contraseña" />
        </div>
        <button type="submit" className="login-primary-button">
          Iniciar Sesión
        </button>
      </form>
      <Link href="/" className="login-back-link">
        ← Volver al inicio
      </Link>
    </div>
  );
}
