"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, Menu, Phone, Send, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InicioSection } from "./inicio";
import AcercaSection from "./acerca";
import SeguimientoSection from "./seguimiento";
import FCL from "./FCL";
import LCL from "./LCL";

type PageId =
  | "inicio"
  | "acerca"
  | "seguimiento"
  | "calculadora"
  | "fcl"
  | "lcl"
  | "contacto";

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const [activePage, setActivePage] = useState<PageId>("inicio");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPromoOpen, setIsPromoOpen] = useState(false);

  const [serviceRate, setServiceRate] = useState<number>(18.5);
  const [largo, setLargo] = useState<number | "">("");
  const [alto, setAlto] = useState<number | "">("");
  const [ancho, setAncho] = useState<number | "">("");

  const [contactState, setContactState] = useState<
    "idle" | "processing" | "sent"
  >("idle");

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activePage]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsPromoOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  const { ft3, costo } = useMemo(() => {
    const l = typeof largo === "number" ? largo : 0;
    const h = typeof alto === "number" ? alto : 0;
    const a = typeof ancho === "number" ? ancho : 0;

    const volume = (l * h * a) / 1728;
    const total = volume * serviceRate;
    return { ft3: volume, costo: total };
  }, [largo, alto, ancho, serviceRate]);

  const toggleLanguage = () => {
    const current = i18n.language.startsWith("en") ? "en" : "es";
    const next = current === "es" ? "en" : "es";
    i18n.changeLanguage(next);
  };

  const handleSubmitContact: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (contactState === "processing") return;
    setContactState("processing");

    const form = e.target as HTMLFormElement;
    const data = new FormData(form);

    const body = new FormData();
    body.append("access_key", "a9902180-bd09-42e8-a283-4b4033c7ef5d");
    body.append("subject", t("contact.subject"));
    body.append("from_name", data.get("nombre") as string);
    body.append("reply_to", data.get("email") as string);
    body.append("message", data.get("mensaje") as string);

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body,
      });
      if (res.ok) {
        setContactState("sent");
        form.reset();
        setTimeout(() => setContactState("idle"), 3000);
      } else {
        setContactState("idle");
        alert(t("common.errorSending"));
      }
    } catch {
      setContactState("idle");
      alert(t("common.errorSending"));
    }
  };

  const buttonLabel = useMemo(() => {
    if (contactState === "processing") return t("common.processing");
    if (contactState === "sent") return t("common.sent");
    return t("common.sendMessage");
  }, [contactState, t]);

  return (
    <main>
      {isPromoOpen && (
        <div className="caribex-popup" role="dialog" aria-modal="true" aria-labelledby="caribex-promo-title">
          <button type="button" className="caribex-popup__overlay" aria-label="Close promotion" onClick={() => setIsPromoOpen(false)} />
          <section className="caribex-popup__card">
            <button type="button" className="caribex-popup__close" aria-label="Close promotion" onClick={() => setIsPromoOpen(false)}>
              <X size={22} />
            </button>
            <div className="caribex-popup__logo-wrap">
              <Image src="/imagenes/logo.png" alt="Caribex Logistics Group" width={240} height={72} className="caribex-popup__logo" />
            </div>
            <p className="caribex-popup__eyebrow">Caribex Logistics Group</p>
            <h2 id="caribex-promo-title">
              {i18n.language.startsWith("en") ? "Get 10% Off Your First Shipment!" : "¡Obtenga un 10% de descuento en su primer envío!"}
            </h2>
            <p>
              {i18n.language.startsWith("en")
                ? "Create your free Caribex account and enjoy reliable shipping solutions for personal, business, and retail shipments."
                : "Cree su cuenta gratuita de Caribex y disfrute de soluciones confiables para envíos personales, comerciales y minoristas."}
            </p>
            <ul className="caribex-popup__benefits">
              {(i18n.language.startsWith("en")
                ? ["Special rates for businesses and retailers", "Real-time shipment tracking", "Professional customs and documentation support", "Pickup options through strategic ports in Honduras"]
                : ["Tarifas especiales para empresas y minoristas", "Seguimiento de envíos en tiempo real", "Apoyo profesional con aduanas y documentación", "Opciones de recolección en puertos estratégicos de Honduras"]
              ).map((benefit) => <li key={benefit}>{benefit}</li>)}
            </ul>
            <Link href="/registro-cliente" className="caribex-popup__button" onClick={() => setIsPromoOpen(false)}>
              {i18n.language.startsWith("en") ? "Create Your Account" : "Cree su cuenta"}
            </Link>
          </section>
        </div>
      )}
      <nav className="nav">
        <button
          type="button"
          className="logo-container logo-button-reset"
          onClick={() => {
            setActivePage("inicio");
            setIsMobileMenuOpen(false);
          }}
        >
          <div className="logo-box">
            <Image
              src="/imagenes/logo-trimmed.png"
              alt="Caribex Logistics Group"
              width={220}
              height={97}
              className="logo-image"
            />
          </div>
        </button>

        {/* Botón hamburguesa (solo móvil) + selector de idioma compacto */}
        <div className="nav-mobile-header-actions">
          <button
            type="button"
            className="nav-toggle"
            aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <button
            type="button"
            className="nav-lang-toggle nav-lang-toggle-mobile-inline"
            onClick={toggleLanguage}
          >
            <span
              className={
                "nav-lang-option" +
                (i18n.language.startsWith("es") ? " nav-lang-option-active" : "")
              }
            >
              {t("nav.es")}
            </span>
            <span className="nav-lang-separator">|</span>
            <span
              className={
                "nav-lang-option" +
                (i18n.language.startsWith("en") ? " nav-lang-option-active" : "")
              }
            >
              {t("nav.en")}
            </span>
          </button>
        </div>

        {/* Navegación de escritorio */}
        <div className="nav-desktop">
          <ul className="nav-links">
            <li>
              <button
                type="button"
                onClick={() => setActivePage("inicio")}
                className={
                  "nav-link-button" +
                  (activePage === "inicio" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.inicio")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setActivePage("acerca")}
                className={
                  "nav-link-button" +
                  (activePage === "acerca" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.acerca")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setActivePage("fcl")}
                className={
                  "nav-link-button" +
                  (activePage === "fcl" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.fcl")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setActivePage("lcl")}
                className={
                  "nav-link-button" +
                  (activePage === "lcl" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.lcl")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setActivePage("seguimiento")}
                className={
                  "nav-link-button" +
                  (activePage === "seguimiento" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.seguimiento")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setActivePage("calculadora")}
                className={
                  "nav-link-button" +
                  (activePage === "calculadora" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.calculadora")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setActivePage("contacto")}
                className={
                  "nav-link-button" +
                  (activePage === "contacto" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.contacto")}
              </button>
            </li>
          </ul>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link href="/registro-cliente" className="nav-btn">
              {t("nav.registroClientes")}
            </Link>
            <Link href="/login" className="nav-btn">
              {t("nav.login")}
            </Link>
            <button
              type="button"
              className="nav-lang-toggle"
              onClick={toggleLanguage}
            >
              <span
                className={
                  "nav-lang-option" +
                  (i18n.language.startsWith("es") ? " nav-lang-option-active" : "")
                }
              >
                {t("nav.es")}
              </span>
              <span className="nav-lang-separator">|</span>
              <span
                className={
                  "nav-lang-option" +
                  (i18n.language.startsWith("en") ? " nav-lang-option-active" : "")
                }
              >
                {t("nav.en")}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Menú móvil desplegable */}
      {isMobileMenuOpen && (
        <div className="nav-mobile-menu">
          <ul className="nav-links nav-links-mobile">
            <li>
              <button
                type="button"
                onClick={() => {
                  setActivePage("inicio");
                  setIsMobileMenuOpen(false);
                }}
                className={
                  "nav-link-button" +
                  (activePage === "inicio" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.inicio")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setActivePage("acerca");
                  setIsMobileMenuOpen(false);
                }}
                className={
                  "nav-link-button" +
                  (activePage === "acerca" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.acerca")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setActivePage("seguimiento");
                  setIsMobileMenuOpen(false);
                }}
                className={
                  "nav-link-button" +
                  (activePage === "seguimiento" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.seguimiento")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setActivePage("calculadora");
                  setIsMobileMenuOpen(false);
                }}
                className={
                  "nav-link-button" +
                  (activePage === "calculadora" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.calculadora")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setActivePage("fcl");
                  setIsMobileMenuOpen(false);
                }}
                className={
                  "nav-link-button" +
                  (activePage === "fcl" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.fcl")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setActivePage("lcl");
                  setIsMobileMenuOpen(false);
                }}
                className={
                  "nav-link-button" +
                  (activePage === "lcl" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.lcl")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setActivePage("contacto");
                  setIsMobileMenuOpen(false);
                }}
                className={
                  "nav-link-button" +
                  (activePage === "contacto" ? " nav-link-button-active" : "")
                }
              >
                {t("nav.contacto")}
              </button>
            </li>
          </ul>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0 1rem 1rem" }}>
            <Link href="/registro-cliente" className="nav-btn nav-btn-mobile">
              {t("nav.registroClientes")}
            </Link>
            <Link href="/login" className="nav-btn nav-btn-mobile">
              {t("nav.login")}
            </Link>
          </div>
        </div>
      )}

      {/* INICIO */}
      {activePage === "inicio" && (
        <>
          <section className="hero page-section">
            <div className="hero-content">
              <span className="hero-badge">{t("home.badge")}</span>
              <h1>
                {t("home.titleLine1")}
                <br />
                <span>{t("home.titleHighlight")}</span>
              </h1>
              <p>
                {t("home.subtitle")}
              </p>
              <div className="hero-actions">
                <button
                  type="button"
                  className="hero-primary-btn"
                  onClick={() => {
                    setActivePage("fcl");
                    setTimeout(() => {
                      if (typeof window === "undefined") return;
                      const el = document.getElementById("fcl-quote-form");
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }, 200);
                  }}
                >
                  {t("home.primaryCta")}
                </button>
                <button
                  type="button"
                  className="hero-secondary-btn"
                  onClick={() => setActivePage("seguimiento")}
                >
                  {t("home.secondaryCta")}
                </button>
              </div>
            </div>
          </section>

          <InicioSection
            onRequestLclQuote={() => {
              setActivePage("lcl");
              setTimeout(() => {
                if (typeof window === "undefined") return;
                const el = document.getElementById("lcl-quote-form");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }, 200);
            }}
          />
        </>
      )}

      {/* ACERCA */}
      {activePage === "acerca" && <AcercaSection />}

      {/* SEGUIMIENTO */}
      {activePage === "seguimiento" && <SeguimientoSection />}

      {/* FCL */}
      {activePage === "fcl" && <FCL />}

      {/* LCL */}
      {activePage === "lcl" && <LCL />}

      {/* CALCULADORA */}
      {activePage === "calculadora" && (
        <section className="calc-page page-section">
          <div className="section-header">
            <h2>{t("calc.title")}</h2>
            <p>{t("calc.description")}</p>
          </div>
          <div className="calc-container">
            <div className="calc-info">
              <h3>{t("calc.howItWorksTitle")}</h3>
              <p>{t("calc.howItWorksText")}</p>
              <div className="calc-formula">
                <code>{t("calc.formula")}</code>
              </div>
            </div>
            <div className="calc-form">
              <div className="input-group">
                <label>{t("calc.serviceSelected")}</label>
                <select
                  value={serviceRate}
                  onChange={(e) => setServiceRate(Number(e.target.value))}
                >
                  <option value={18.5}>{t("calc.optionStandard")}</option>
                  <option value={25}>{t("calc.optionFragile")}</option>
                </select>
              </div>
              <div className="dimensions-grid">
                <div className="input-group">
                  <label>{t("calc.length")}</label>
                  <input
                    type="number"
                    value={largo}
                    onChange={(e) =>
                      setLargo(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="0"
                  />
                </div>
                <div className="input-group">
                  <label>{t("calc.height")}</label>
                  <input
                    type="number"
                    value={alto}
                    onChange={(e) =>
                      setAlto(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="0"
                  />
                </div>
                <div className="input-group">
                  <label>{t("calc.width")}</label>
                  <input
                    type="number"
                    value={ancho}
                    onChange={(e) =>
                      setAncho(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="result-box">
                <div className="result-label">{t("calc.totalLabel")}</div>
                <div className="result-main">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(costo || 0)}
                </div>
                <div className="result-detail">
                  {ft3.toFixed(2)} ft³ {t("calc.totalFeet")}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CONTACTO */}
      {activePage === "contacto" && (
        <section className="contact-page page-section">
          <div className="contact-container">
            <div className="contact-sidebar">
              <h2>{t("contact.title")}</h2>
              <p>{t("contact.description")}</p>
              <div className="info-card">
                <Phone size={24} />
                <div>
                  <h4>{t("contact.phoneLabel")}</h4>
                  <p>+504 89467476</p>
                </div>
              </div>
              <div className="info-card">
                <Mail size={24} />
                <div>
                  <h4>{t("contact.emailLabel")}</h4>
                  <p>admin@caribexlogistics.com</p>
                </div>
              </div>
            </div>
            <div className="contact-main">
              <form onSubmit={handleSubmitContact}>
                <div className="input-wrapper">
                  <input
                    type="text"
                    name="nombre"
                    placeholder=" "
                    required
                  />
                  <label>{t("contact.fullName")}</label>
                </div>
                <div className="input-wrapper">
                  <input
                    type="email"
                    name="email"
                    placeholder=" "
                    required
                  />
                  <label>{t("contact.yourEmail")}</label>
                </div>
                <div className="input-wrapper">
                  <textarea
                    name="mensaje"
                    rows={4}
                    placeholder=" "
                    required
                  />
                  <label>{t("contact.messageLabel")}</label>
                </div>
                <button
                  type="submit"
                  className={
                    "submit-button" +
                    (contactState === "sent" ? " submit-button-sent" : "")
                  }
                  disabled={contactState === "processing"}
                >
                  {buttonLabel}
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-grid">
            {/* Columna 1: Info Empresa */}
            <div className="footer-column">
              <h2 className="footer-brand-title">{t("footer.companyName")}</h2>
              <p className="footer-brand-subtitle">
                {t("footer.companySubtitle")}
              </p>
              <div className="footer-contact-list">
                <div className="footer-contact-item">
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
                    className="text-blue-400"
                  >
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>Roatán, Honduras</span>
                </div>
                <div className="footer-contact-item">
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
                    className="text-blue-400"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span>admin@caribexlogistics.com</span>
                </div>
                <div className="footer-contact-item">
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
                    className="text-blue-400"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>+504 89467476</span>
                </div>
              </div>
            </div>

            {/* Columna 2: Enlaces Rápidos */}
            <div className="footer-column">
              <h3 className="footer-column-title">{t("footer.quickLinks")}</h3>
              <ul className="footer-links">
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-button"
                    onClick={() => setActivePage("acerca")}
                  >
                    {t("footer.aboutUs")}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-button"
                    onClick={() => setActivePage("inicio")}
                  >
                    {t("footer.services")}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-button"
                    onClick={() => setActivePage("seguimiento")}
                  >
                    {t("footer.tracking")}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-button"
                    onClick={() => setActivePage("contacto")}
                  >
                    {t("footer.contact")}
                  </button>
                </li>
              </ul>
            </div>

            {/* Columna 3: Legal */}
            <div className="footer-column">
              <h3 className="footer-column-title">{t("footer.legal")}</h3>
              <ul className="footer-links">
                <li>
                  <a href="#" className="footer-link">
                    {t("footer.privacy")}
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    {t("footer.terms")}
                  </a>
                </li>
              </ul>
            </div>

            {/* Columna 4: Servicios */}
            <div className="footer-column">
              <h3 className="footer-column-title">{t("footer.servicesTitle")}</h3>
              <ul className="footer-services-list">
                <li className="footer-service-item">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-400"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <button
                    type="button"
                    className="footer-link footer-link-button footer-service-button"
                    onClick={() => setActivePage("fcl")}
                  >
                    {t("footer.serviceFclLcl")}
                  </button>
                </li>
                <li className="footer-service-item">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-400"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <button
                    type="button"
                    className="footer-link footer-link-button footer-service-button"
                    onClick={() => setActivePage("lcl")}
                  >
                    {t("footer.serviceForwarder")}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <span>{t("footer.copyright")}</span>
            <span>{t("footer.poweredBy")}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
