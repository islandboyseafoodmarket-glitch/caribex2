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
          <h1>{isEn ? "Our Services" : "Nuestros servicios"}</h1>
          <p>
            {isEn
              ? "Comprehensive Logistics Solutions Tailored To Your Needs"
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
                  Rent A Full Container For Your Shipment. Ideal For Large Cargo Volumes.
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
                  Share Container Space With Other Shipments. Only Pay For What You Use.
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
                <h3>Storage And Warehousing</h3>
                <p>
                  Secure Facilities In Honduran Ports With Professional Inventory Management.
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
                <h3>Freight Transportation</h3>
                <p>
                  Complete Documentation, Customs Procedures And Home Delivery.
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
              ? "Five Simple Steps To Get Your Cargo To Honduras"
              : "Cinco pasos sencillos para llevar su carga a Honduras"}
          </p>
        </header>

        <div className="inicio-services-grid">
          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-emerald">1</div>
            <h3>{isEn ? "Create Your Free Account" : "Cree su cuenta gratuita"}</h3>
            <p>
              {isEn
                ? "Set Up Your Shipping Profile And Gain Access To Your Personalized Portal."
                : "Configure su perfil de envío y obtenga acceso a su portal personalizado."}
            </p>
            <Link
              href="/registro-cliente"
              className="nav-btn"
              style={{ display: "inline-block", marginTop: "0.75rem" }}
            >
              {isEn ? "Create Your Account" : "Cree su cuenta"}
            </Link>
          </div>

          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-blue">2</div>
            <h3>{isEn ? "Ship To Our Florida Warehouse" : "Envíe a nuestro almacén en Florida"}</h3>
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
                ? "We Scan Your Package Into Your Portal So You Can Track It Through All Stages."
                : "Escaneamos su paquete en su portal para que pueda rastrearlo en todas las etapas."}
            </p>
          </div>

          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-violet">4</div>
            <h3>{isEn ? "Expert Customs Management" : "Gestión experta de aduanas"}</h3>
            <p>
              {isEn
                ? "We Handle All Necessary Documentation And Port Clearances For You."
                : "Nos encargamos de toda la documentación necesaria y los despachos portuarios por usted."}
            </p>
          </div>

          <div className="inicio-card">
            <div className="inicio-icon-box inicio-bg-emerald">5</div>
            <h3>{isEn ? "Final Notification & Collection" : "Notificación final y recolección"}</h3>
            <p>
              {isEn
                ? "We Notify You When Your Parcels Are Ready For Pickup At Your Chosen Port."
                : "Le notificamos cuando sus paquetes estén listos para recoger en el puerto elegido."}
            </p>
          </div>
        </div>

        <header className="inicio-section-header">
          <h2>
            {isEn
              ? "Our Service Locations"
              : "Nuestras ubicaciones de servicio"}
          </h2>
          <p>
            {isEn
              ? "Strategic Ports In Honduras For Efficient Ocean Transport"
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
                  ? "Caribbean Hub With Modern Facilities"
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
                  ? "Key Port On The North Coast"
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
                  ? "Historic Port With Growing Capacity"
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
                  ? "The Largest Urban Logistics Center In The Interior"
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
                  ? "Distribution Center For The Capital City"
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
                  ? "Island Port For Caribbean Routes"
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
                  ? "Secondary Gateway To The Caribbean"
                  : "Puerta de entrada secundaria al Caribe"}
              </p>
            </div>
          </div>
        </div>

        <header className="inicio-section-header">
          <h2>
            {isEn
              ? "Why Choose Caribex Logistics Group?"
              : "¿Por qué elegir Caribex Logistics Group?"}
          </h2>
          <p>
            {isEn
              ? "Excellence And Commitment In Every Shipment"
              : "Excelencia y compromiso en cada envío"}
          </p>
        </header>

        <div className="inicio-benefits-grid">
          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-blue">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Competitive Pricing" : "Precios competitivos"}</h4>
              <p>
                {isEn
                  ? "The Best Rates In The Market With Transparent Pricing And No Hidden Fees."
                  : "Las mejores tarifas del mercado con una estructura de precios transparente y sin cargos ocultos."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-emerald">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Fast And Reliable" : "Rápido y confiable"}</h4>
              <p>
                {isEn
                  ? "Quick Processing And Reliable Transit Times For Your Peace Of Mind."
                  : "Procesamiento rápido y tiempos de tránsito confiables para su tranquilidad."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-orange">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M8 12h8"/><path d="M8 16h5"/><path d="M8 8h6"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Expert Support" : "Soporte de expertos"}</h4>
              <p>
                {isEn
                  ? "Dedicated Team Available Monday To Friday To Assist You With Your Shipments."
                  : "Equipo dedicado disponible de lunes a viernes para ayudarle con sus envíos."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-green">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M5 7l7-4 7 4"/><path d="M5 17l7 4 7-4"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Wide Coverage" : "Amplia cobertura"}</h4>
              <p>
                {isEn
                  ? "7 Strategic Ports In Honduras For Maximum Flexibility."
                  : "7 puertos estratégicos en Honduras para máxima flexibilidad."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-violet">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Safe Handling" : "Manejo seguro"}</h4>
              <p>
                {isEn
                  ? "Professional Cargo Handling With Optional Insurance Coverage Available."
                  : "Manipulación profesional de carga con cobertura de seguro opcional disponible."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-red">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 3.18a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4.09a2 2 0 0 0 2 0l7-4.09A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/></svg>
            </div>
            <div className="inicio-benefit-content">
              <h4>{isEn ? "Complete Documentation" : "Documentación completa"}</h4>
              <p>
                {isEn
                  ? "Comprehensive Customs Clearance Services And Documentation Included."
                  : "Servicios completos de despacho de aduanas y documentación incluidos."}
              </p>
            </div>
          </div>
        </div>

        <header className="inicio-section-header">
          <h2>
            {isEn
              ? "Special Programs For Businesses And Retailers"
              : "Programas especiales para empresas y minoristas"}
          </h2>
          <p>
            {isEn
              ? "Professional Shipping Solutions And Added-Value Services Designed To Help Your Business Grow."
              : "Soluciones profesionales de envío y servicios de valor agregado diseñados para ayudar a crecer su negocio."}
          </p>
        </header>

        <div className="inicio-benefits-grid">
          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-blue">
              <i className="fas fa-store" />
            </div>
            <div className="inicio-benefit-content">
              <h4>
                {isEn
                  ? "Business And Retailer Rates"
                  : "Tarifas para empresas y minoristas"}
              </h4>
              <p>
                {isEn
                  ? "Ask About Special Rates For Recurring Shipments, Retail Orders, And Commercial Cargo."
                  : "Consulte nuestras tarifas especiales para envíos recurrentes, pedidos minoristas y carga comercial."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-emerald">
              <i className="fas fa-percent" />
            </div>
            <div className="inicio-benefit-content">
              <h4>
                {isEn ? "10% Off Your First Shipment" : "10% de descuento en su primer envío"}
              </h4>
              <p>
                {isEn
                  ? "Create Your Free Account And Receive 10% Off Your First Shipment With Caribex."
                  : "Cree su cuenta gratuita y reciba un 10% de descuento en su primer envío con Caribex."}
              </p>
            </div>
          </div>

          <div className="inicio-benefit-item">
            <div className="inicio-benefit-icon inicio-bg-violet">
              <i className="fas fa-shopping-cart" />
            </div>
            <div className="inicio-benefit-content">
              <h4>
                {isEn ? "Personal Shopper Service" : "Servicio de comprador personal"}
              </h4>
              <p>
                {isEn
                  ? "Need Help Purchasing? You Pay The Store Price Plus A 25% Personal Shopper Service Fee. Shipping Is Charged Separately."
                  : "¿Necesita ayuda con su compra? Paga el precio de la tienda más un 25% por el servicio de comprador personal. El costo de envío se cobra por separado."}
              </p>
            </div>
          </div>
        </div>

        <section className="inicio-cta-banner">
          <h2>
            {isEn
              ? "Ready To Ship With Us?"
              : "¿Listo para enviar con nosotros?"}
          </h2>
          <p>
            {isEn
              ? "Start Today With Caribex Logistics Group. We Are Here To Help You With FCL, LCL And Warehousing Services."
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
              {isEn ? "Request A Quote" : "Solicitar una cotización"}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
