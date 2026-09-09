import React from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

/**
 * Sección extendida de Inicio: servicios, ubicaciones, beneficios,
 * testimonios y CTA final. El estilo vive en globals.css con prefijo .inicio-*
 */
export function InicioSection({
  onRequestLclQuote,
}: {
  onRequestLclQuote?: () => void;
}) {
  const { i18n } = useTranslation();
  const isEn = i18n.language.startsWith("en");
  return (
    <section className="inicio-section page-section">
      <div className="inicio-container">
        <header className="inicio-section-header">
          <h1>{isEn ? "Our services" : "Nuestros servicios"}</h1>
          <p>
            {isEn
              ? "Comprehensive logistics solutions tailored to your needs"
              : "Soluciones logísticas integrales adaptadas a sus necesidades"}
          </p>
        </header>

        <div className="inicio-services-grid">
          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-blue">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            </div>
            {isEn ? (
              <>
                <h3>Full Container Load (FCL)</h3>
                <p>
                  Rent a full container for your shipment. Ideal for large cargo volumes.
                </p>
              </>
            ) : (
              <>
                <h3>Carga de contenedor completo (FCL)</h3>
                <p>
                  Alquile un contenedor completo para su envío. Ideal para grandes volúmenes de carga.
                </p>
              </>
            )}
          </div>

          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-emerald">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
            </div>
            {isEn ? (
              <>
                <h3>Less than Container Load (LCL)</h3>
                <p>
                  Share container space with other shipments. Only pay for what you use.
                </p>
              </>
            ) : (
              <>
                <h3>Carga menor a un contenedor (LCL)</h3>
                <p>
                  Comparte el espacio del contenedor con otros envíos. Solo pagas por lo que utilizas.
                </p>
              </>
            )}
          </div>

          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-violet">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            {isEn ? (
              <>
                <h3>Storage and warehousing</h3>
                <p>
                  Secure facilities in Honduran ports with professional inventory management.
                </p>
              </>
            ) : (
              <>
                <h3>Almacenamiento y depósito</h3>
                <p>
                  Instalaciones seguras en los puertos de Honduras con gestión profesional de inventario.
                </p>
              </>
            )}
          </div>

          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-orange">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            {isEn ? (
              <>
                <h3>Freight transportation</h3>
                <p>
                  Complete documentation, customs procedures and home delivery.
                </p>
              </>
            ) : (
              <>
                <h3>Transporte de mercancías</h3>
                <p>
                  Documentación completa, trámites aduaneros y entrega a domicilio.
                </p>
              </>
            )}
          </div>
        </div>

        <header className="inicio-section-header">
          <h2>{isEn ? "How It Works" : "¿Cómo funciona?"}</h2>
          <p>
            {isEn
              ? "Five simple steps to get your cargo to Honduras"
              : "Cinco pasos sencillos para llevar su carga a Honduras"}
          </p>
        </header>

        <div className="inicio-services-grid">
          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-emerald">1</div>
            <Link href="/registro-cliente" className="nav-btn">
              {isEn ? "Create Your Free Account" : "Cree su cuenta gratuita"}
            </Link>
            <p>
              {isEn
                ? "Set up your shipping profile and gain access to your personalized portal."
                : "Configure su perfil de envío y obtenga acceso a su portal personalizado."}
            </p>
          </div>

          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-blue">2</div>
            <h3>{isEn ? "Ship to Our Florida Warehouse" : "Envíe a nuestro almacén en Florida"}</h3>
            <p style={{ fontSize: "0.85rem", lineHeight: "1.4" }}>
              <strong>Your Name</strong>
              <br />
              1092 NE Industrial Blvd
              <br />
              Jensen Beach, Florida 34957
            </p>
          </div>

          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-orange">3</div>
            <h3>{isEn ? "Real-Time Arrival & Scanning" : "Recepción y escaneo en tiempo real"}</h3>
            <p>
              {isEn
                ? "We scan your package into your portal so you can track it through all stages."
                : "Escaneamos su paquete en su portal para que pueda rastrearlo en todas las etapas."}
            </p>
          </div>

          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-violet">4</div>
            <h3>{isEn ? "Expert Customs Management" : "Gestión experta de aduanas"}</h3>
            <p>
              {isEn
                ? "We handle all necessary documentation and port clearances for you."
                : "Nos encargamos de toda la documentación necesaria y los despachos portuarios por usted."}
            </p>
          </div>

          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-emerald">5</div>
            <h3>{isEn ? "Final Notification & Collection" : "Notificación final y recolección"}</h3>
            <p>
              {isEn
                ? "We notify you when your parcels are ready for pickup at your chosen port."
                : "Le notificamos cuando sus paquetes estén listos para recoger en el puerto elegido."}
            </p>
          </div>
        </div>

        <header className="inicio-section-header">
          <h2>
            {isEn
              ? "Our service locations"
              : "Nuestras ubicaciones de servicio"}
          </h2>
          <p>
            {isEn
              ? "Strategic ports in Honduras for efficient ocean transport"
              : "Puertos estratégicos en Honduras para un transporte marítimo eficiente"}
          </p>
        </header>

        <div className="inicio-locations-grid">
          <div className="inicio-location-card">
            <div className="inicio-location-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div className="inicio-location-info">
              <h4>Roatán</h4>
              <p>
                {isEn
                  ? "Caribbean hub with modern facilities"
                  : "Centro caribeño con instalaciones modernas"}
              </p>
            </div>
          </div>

          <div className="inicio-location-card">
            <div className="inicio-location-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div className="inicio-location-info">
              <h4>La Ceiba</h4>
              <p>
                {isEn
                  ? "Key port on the north coast"
                  : "Puerto importante en la costa norte"}
              </p>
            </div>
          </div>

          <div className="inicio-location-card">
            <div className="inicio-location-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div className="inicio-location-info">
              <h4>Trujillo</h4>
              <p>
                {isEn
                  ? "Historic port with growing capacity"
                  : "Puerto histórico con capacidad creciente"}
              </p>
            </div>
          </div>

          <div className="inicio-location-card">
            <div className="inicio-location-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div className="inicio-location-info">
              <h4>San Pedro Sula</h4>
              <p>
                {isEn
                  ? "The largest urban logistics center in the interior"
                  : "El mayor centro logístico urbano del interior"}
              </p>
            </div>
          </div>

          <div className="inicio-location-card">
            <div className="inicio-location-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div className="inicio-location-info">
              <h4>Tegucigalpa</h4>
              <p>
                {isEn
                  ? "Distribution center for the capital city"
                  : "Centro de distribución de la ciudad capital"}
              </p>
            </div>
          </div>

          <div className="inicio-location-card">
            <div className="inicio-location-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div className="inicio-location-info">
              <h4>Guanaja</h4>
              <p>
                {isEn
                  ? "Island port for Caribbean routes"
                  : "Puerto insular para rutas del Caribe"}
              </p>
            </div>
          </div>

          <div className="inicio-location-card">
            <div className="inicio-location-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div className="inicio-location-info">
              <h4>Utila</h4>
              <p>
                {isEn
                  ? "Secondary gateway to the Caribbean"
                  : "Puerta de entrada secundaria al Caribe"}
              </p>
            </div>
          </div>
        </div>

        <header className="inicio-section-header">
          <h2>
            {isEn
              ? "Why choose Caribex Logistics Group?"
              : "¿Por qué elegir Caribex Logistics Group?"}
          </h2>
          <p>
            {isEn
              ? "Excellence and commitment in every shipment"
              : "Excelencia y compromiso en cada envío"}
          </p>
        </header>

        <div className="inicio-benefits-grid">
          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-blue">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Competitive pricing" : "Precios competitivos"}</h4>
              <p>
                {isEn
                  ? "The best rates in the market with transparent pricing and no hidden fees."
                  : "Las mejores tarifas del mercado con una estructura de precios transparente y sin cargos ocultos."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-emerald">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Fast and reliable" : "Rápido y confiable"}</h4>
              <p>
                {isEn
                  ? "Quick processing and reliable transit times for your peace of mind."
                  : "Procesamiento rápido y tiempos de tránsito confiables para su tranquilidad."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-orange">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M8 12h8"/><path d="M8 16h5"/><path d="M8 8h6"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Expert support" : "Soporte de expertos"}</h4>
              <p>
                {isEn
                  ? "Dedicated team available Monday to Friday to assist you with your shipments."
                  : "Equipo dedicado disponible de lunes a viernes para ayudarle con sus envíos."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-green">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M5 7l7-4 7 4"/><path d="M5 17l7 4 7-4"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Wide coverage" : "Amplia cobertura"}</h4>
              <p>
                {isEn
                  ? "7 strategic ports in Honduras for maximum flexibility."
                  : "7 puertos estratégicos en Honduras para máxima flexibilidad."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-violet">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Safe handling" : "Manejo seguro"}</h4>
              <p>
                {isEn
                  ? "Professional cargo handling with optional insurance coverage available."
                  : "Manipulación profesional de carga con cobertura de seguro opcional disponible."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-red">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 3.18a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4.09a2 2 0 0 0 2 0l7-4.09A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Complete documentation" : "Documentación completa"}</h4>
              <p>
                {isEn
                  ? "Comprehensive customs clearance services and documentation included."
                  : "Servicios completos de despacho de aduanas y documentación incluidos."}
              </p>
            </div>
          </div>
        </div>

        <section className="inicio-pricing-section" style={{ marginTop: "3rem" }}>
          <header className="inicio-section-header" style={{ marginBottom: "1.5rem" }}>
            <h2>
              {isEn
                ? "Special rates"
                : "Tarifas especiales"}
            </h2>
            <p>
              {isEn
                ? "Flat rates for appliances, containers and electrical materials"
                : "Precios planos para electrodomésticos, contenedores y materiales eléctricos"}
            </p>
          </header>

          <div style={{ marginBottom: "2rem" }}>
            <h3
              style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
              }}
            >
              {isEn
                ? "Large Appliance Shipping"
                : "Línea Blanca / Large Appliance Shipping"}
            </h3>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <div className="inicio-price-pill">
                <span>
                  {isEn
                    ? "Washer / Dryers / Stoves"
                    : "Washer / Dryers / Stoves"}
                </span>
                <strong>$350.00</strong>
              </div>
              <div className="inicio-price-pill">
                <span>
                  {isEn
                    ? "Standard refrigerators"
                    : "Standard refrigerators"}
                </span>
                <strong>$425.00</strong>
              </div>
              <div className="inicio-price-pill">
                <span>
                  {isEn
                    ? "Dishwashers"
                    : "Dishwashers"}
                </span>
                <strong>$295.00</strong>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h3
              style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
              }}
            >
              {isEn
                ? "Bin & Barrel Pricing"
                : "Contenedores (Bins) / Bin & Barrel Pricing"}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {[
                ["16 gallon bin", "$40.00"],
                ["17 gallon bin", "$45.00"],
                ["18 gallon bin", "$47.50"],
                ["19 gallon bin", "$50.00"],
                ["20 gallon bin", "$55.00"],
                ["27 gallon bin", "$90.00"],
                ["30 gallon bin", "$95.00"],
                ["38 gallon bin", "$120.00"],
                ["40 gallon bin", "$128.00"],
                ["45 gallon bin / barrel", "$132.00"],
                ["50 gallon bin", "$140.00"],
                ["55 gallon bin", "$150.00"],
                ["60 gallon bin", "$160.00"],
                ["65 gallon bin", "$165.00"],
                ["70 gallon bin", "$170.00"],
                ["77 gallon bin", "$180.00"],
              ].map(([label, price]) => (

                <div key={label} className="inicio-price-pill">
                  <span>{label}</span>
                  <strong>{price}</strong>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3
              style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
              }}
            >
              {isEn
                ? "Electrical Wire (250 ft spools)"
                : "Cables y Materiales / Electrical Wire (250 ft spools)"}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "0.75rem",
              }}
            >
              <div className="inicio-price-pill">
                <span>
                  {isEn
                    ? "250 ft – 14/2 Wire"
                    : "250 ft – 14/2 Wire"}
                </span>
                <strong>$30.00</strong>
              </div>
              <div className="inicio-price-pill">
                <span>
                  {isEn
                    ? "250 ft – 12/2 Wire"
                    : "250 ft – 12/2 Wire"}
                </span>
                <strong>$30.00</strong>
              </div>
              <div className="inicio-price-pill">
                <span>
                  {isEn
                    ? "250 ft – 14/3 Wire"
                    : "250 ft – 14/3 Wire"}
                </span>
                <strong>$30.00</strong>
              </div>
              <div className="inicio-price-pill">
                <span>
                  {isEn
                    ? "250 ft – 10/2 Wire"
                    : "250 ft – 10/2 Wire"}
                </span>
                <strong>$35.00</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="inicio-cta-banner">
          <h2>
            {isEn
              ? "Ready to ship with us?"
              : "¿Listo para enviar con nosotros?"}
          </h2>
          <p>
            {isEn
              ? "Start today with Caribex Logistics Group. We are here to help you with FCL, LCL and warehousing services."
              : "Empiece hoy mismo con Caribex Logistics Group. Estamos aquí para ayudarle con sus servicios de FCL, LCL y almacenamiento."}
          </p>

          <div className="inicio-cta-buttons">
            <button
              className="inicio-btn inicio-btn-white"
              type="button"
              onClick={() => {
                if (onRequestLclQuote) onRequestLclQuote();
              }}
            >
              {isEn ? "Request a quote" : "Solicitar una cotización"}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
