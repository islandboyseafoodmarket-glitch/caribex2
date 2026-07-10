"use client";

import React, { useState } from 'react';
import { supabase } from "../lib/supabaseClient";
import { useTranslation } from "react-i18next";

type ShipmentResult = {
  id: number;
  tracking: string;
  nombre_paqueteria: string | null;
  tipo_paquete: string | null;
  estado: string | null;
  hora_fecha: string | null;
  contenido: string | null;
  registro: string | null;
};

export function SeguimientoSection() {
  const { i18n } = useTranslation();
  const isEn = i18n.language.startsWith("en");

  const [clientNumber, setClientNumber] = useState("");
  const [email, setEmail] = useState("");
  const [shipments, setShipments] = useState<ShipmentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const trimmedClient = clientNumber.trim();
    const trimmedEmail = email.trim();

    if (!trimmedClient || !trimmedEmail) {
      setError(
        isEn
          ? "Please enter your client number and email."
          : "Ingrese su número de cliente y correo electrónico."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1) Buscar el cliente por número de cuenta y correo
      const {
        data: client,
        error: clientError,
      } = await supabase
        .from("numero_cliente")
        .select("id")
        .eq("numero_cliente", trimmedClient)
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (clientError) {
        throw clientError;
      }

      if (!client) {
        setShipments([]);
        setError(
          isEn
            ? "No client was found with that number and email. Please verify your details."
            : "No se encontró un cliente con ese número y correo electrónico. Verifique los datos."
        );
        return;
      }

      // 2) Cargar todos los envíos asociados a ese cliente
      const {
        data: shipmentsData,
        error: shipmentsError,
      } = await supabase
        .from("paquetes_registro")
        .select(
          "id, tracking, nombre_paqueteria, tipo_paquete, contenido, registro, estado, hora_fecha"
        )
        .eq("numero_cliente_id", client.id)
        .order("hora_fecha", { ascending: false });

      if (shipmentsError) {
        throw shipmentsError;
      }

      setShipments((shipmentsData as ShipmentResult[]) || []);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("Error al buscar envíos", err);
      setError(
        isEn
          ? "An error occurred while searching for your shipments. Please try again later."
          : "Ocurrió un error al buscar sus envíos. Intente de nuevo más tarde."
      );
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: (
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      ),
      title: isEn ? "Real-time updates" : "Actualizaciones en tiempo real",
      desc: isEn
        ? "Receive instant notifications about the status of your shipment."
        : "Reciba notificaciones instantáneas sobre el estado de su envío",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      ),
      title: isEn ? "Secure tracking" : "Seguimiento seguro",
      desc: isEn
        ? "Your shipment data is protected with enterprise-grade security."
        : "Sus datos de envío están protegidos con seguridad empresarial",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      ),
      title: isEn ? "7 ports in Honduras" : "7 puertos de Honduras",
      desc: isEn
        ? "Track shipments across all major ports in Honduras."
        : "Seguimiento de envíos en todos los principales puertos de Honduras",
    }
  ];

  return (
    <section className="seguimiento-page page-section">
      <div className="seguimiento-container">

        {/* Header Section */}
        <header className="seguimiento-header">
          <div className="seguimiento-header-content">
            <h1 className="seguimiento-title">
              {isEn ? "Shipment tracking" : "Seguimiento de envíos"}
            </h1>
          </div>

          <p className="seguimiento-subtitle">
            {isEn
              ? "Monitor your cargo in real time across all Honduran ports."
              : "Monitorea tu carga en tiempo real en todos los puertos de Honduras"}
          </p>
        </header>

        {/* Warning/Info Box */}
        <div className="seguimiento-info-box">
          <div className="seguimiento-info-content">
            <div className="seguimiento-info-title-row">

              <span className="seguimiento-warning-icon">

                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </span>
              <h2 className="seguimiento-info-title">
                {isEn
                  ? "Important: Use of your client number"
                  : "Importante: Uso del número de cliente"}
              </h2>

            </div>
            <ul className="seguimiento-info-list">
              <li>
                <span className="seguimiento-check">✓</span>{' '}
                {isEn ? (
                  <>
                    <strong className="seguimiento-bold">USE</strong> your
                    client number to claim packages at the Roatán office.
                  </>
                ) : (
                  <>
                    <strong className="seguimiento-bold">USE</strong> su número
                    de cliente para reclamar paquetes en la oficina de Roatán
                  </>
                )}
              </li>
              <li>
                <span className="seguimiento-cross">X</span>{' '}
                {isEn ? (
                  <>
                    <strong className="seguimiento-bold">DO NOT</strong> include
                    your client number in shipping addresses.
                  </>
                ) : (
                  <>
                    <strong className="seguimiento-bold">NO</strong> incluya su
                    número de cliente en las direcciones de envío
                  </>
                )}
              </li>
              <li>
                <span className="seguimiento-cross">X</span>{' '}
                {isEn ? (
                  <>
                    <strong className="seguimiento-bold">DO NOT</strong> use
                    your client number as a tracking number.
                  </>
                ) : (
                  <>
                    <strong className="seguimiento-bold">NO</strong> utilice su
                    número de cliente como número de seguimiento
                  </>
                )}
              </li>

            </ul>
            <div className="seguimiento-note">
              <span className="seguimiento-info-tag">i</span>
              <p className="seguimiento-note-text">
                {isEn ? (
                  <>
                    Your client number is{' '}
                    <strong className="seguimiento-bold">ONLY</strong> for
                    claiming packages in person at our Roatán office.
                  </>
                ) : (
                  <>
                    Su número de cliente es{' '}
                    <strong className="seguimiento-bold">SÓLO</strong> para
                    reclamar paquetes en persona en nuestra oficina de Roatán.
                  </>
                )}
              </p>
            </div>
            <p className="seguimiento-support-text">
              {isEn ? (
                <>
                  If you have questions about your client number or how to use
                  it, please contact our{' '}
                  <a href="#" className="seguimiento-link">
                    support team
                  </a>
                  .
                </>
              ) : (
                <>
                  Si tiene preguntas sobre su número de cliente o cómo usarlo,
                  comuníquese con nuestro{' '}
                  <a href="#" className="seguimiento-link">
                    equipo de soporte
                  </a>
                  .
                </>
              )}
            </p>

          </div>
        </div>

        {/* Search Container */}
        <div className="seguimiento-search-card">
          <div className="seguimiento-search-header">

            <span className="seguimiento-search-icon">

              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <div>
              <div className="seguimiento-search-title">
                {isEn ? "Track your shipments" : "Seguimiento de sus envíos"}
              </div>
              <div className="seguimiento-search-sub">
                {isEn
                  ? "Enter your client account number and email to view all your shipments."
                  : "Ingrese su número de cuenta de cliente y correo electrónico para ver todos sus envíos"}
              </div>

            </div>
          </div>
          <div className="seguimiento-search-body">
            <input
              type="text"
              placeholder={
                isEn
                  ? "Enter your client account number (e.g. RO-300)"
                  : "Ingrese su número de cuenta de cliente (por ejemplo, RO-300)"
              }
              value={clientNumber}

              onChange={(e) => setClientNumber(e.target.value)}
              className="seguimiento-input"
            />
            <input
              type="email"
              placeholder={
                isEn
                  ? "Enter the email associated with your account"
                  : "Ingrese el correo electrónico asociado a su cuenta"
              }

              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="seguimiento-input"
            />
            <button onClick={handleSearch} className="seguimiento-search-button">
              {isEn ? "Search" : "Buscar"}
            </button>

          </div>
        </div>
        {/* Resultados de envíos */}
        <div style={{ marginTop: "1.5rem" }}>
          {error && (
            <p style={{ color: "#b91c1c", marginBottom: "0.75rem" }}>{error}</p>
          )}

          {loading && (
            <p>{isEn ? "Loading shipments..." : "Cargando envíos..."}</p>
          )}

          {!loading && shipments.length > 0 && (
            <div>
              <h3 style={{ marginBottom: "0.75rem" }}>
                {isEn
                  ? `Shipments associated with your account (${shipments.length})`
                  : `Envíos asociados a su cuenta (${shipments.length})`}
              </h3>

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {shipments.map((s) => (
                  <li
                    key={s.id}

                    style={{
                      background: "#ffffff",
                      borderRadius: "12px",
                      padding: "0.9rem 1rem",
                      boxShadow: "0 2px 6px rgba(15,23,42,0.06)",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                      {isEn ? "Tracking:" : "Tracking:"} {s.tracking}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                      {isEn ? "Status" : "Estado"}: <strong>{s.estado || "-"}</strong>
                      {" · "}
                      {isEn ? "Package type" : "Tipo de paquete"}: {s.tipo_paquete || "-"}
                      {" · "}
                      {isEn ? "Courier" : "Paquetería"}: {s.nombre_paqueteria || "-"}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.25rem" }}>
                      {isEn ? "Content" : "Contenido"}: {s.contenido || "-"} ·{" "}
                      {isEn ? "Registry" : "Registro"}: {s.registro || "-"}
                    </div>

                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && !error && shipments.length === 0 && (
            <div className="seguimiento-features-grid">
              {features.map((f, i) => (
                <div key={i} className="seguimiento-feature-card">
                  <div className="seguimiento-feature-icon">{f.icon}</div>
                  <h3 className="seguimiento-feature-title">{f.title}</h3>
                  <p className="seguimiento-feature-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default SeguimientoSection;