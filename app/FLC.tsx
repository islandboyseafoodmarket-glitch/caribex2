"use client";
import React from 'react';
import Link from "next/link";
import { useTranslation } from "react-i18next";

const WHATSAPP_NUMBER = "50499274466"; // número oficial en formato internacional sin '+'

const FLC = () => {
  const { i18n } = useTranslation();
  const isEn = i18n.language.startsWith("en");

  const handleFclSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const data = new FormData(form);

    const fullName = (data.get("full_name") || "").toString();
    const email = (data.get("email") || "").toString();
    const phone = (data.get("phone") || "").toString();
    const company = (data.get("company") || "").toString();
    const originPort = (data.get("origin_port") || "").toString();
    const destinationPort = (data.get("destination_port") || "").toString();
    const cargoType = (data.get("cargo_type") || "").toString();
    const desiredDate = (data.get("desired_date") || "").toString();
    const weightKg = (data.get("weight_kg") || data.get("weight") || "").toString();
    const additionalNotes = (data.get("additional_notes") || "").toString();

    const message =
      `*Solicitud de cotización FCL*\n\n` +
      `*Nombre:* ${fullName}\n` +
      `*Correo:* ${email}\n` +
      `*Teléfono:* ${phone}\n` +
      (company ? `*Compañía:* ${company}\n` : "") +
      `\n*Detalles del envío*\n` +
      `*Puerto de origen:* ${originPort}\n` +
      `*Puerto de destino:* ${destinationPort}\n` +
      `*Tipo de carga:* ${cargoType}\n` +
      `*Fecha de envío deseada:* ${desiredDate}\n` +
      `*Peso (kg):* ${weightKg}\n` +
      (additionalNotes ? `\n*Notas adicionales:* ${additionalNotes}` : "");

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;
    window.open(url, "_blank");
  };

  return (
    <div className="page-section" style={styles.pageContainer}>
      <div style={styles.contentWrapper}>
        
        {/* 1. Header Section */}
        <header style={styles.header}>
          <h1 style={styles.mainTitle}>
            {isEn
              ? "Full Container Load (FCL) shipping services"
              : "Servicios de carga de contenedor completo (FCL)"}
          </h1>
          <p style={styles.subTitle}>
            {isEn
              ? "Efficient, reliable and cost-effective full container shipping solutions for your international cargo"
              : "Soluciones de envío de contenedores completos eficientes, confiables y rentables para su carga internacional"}
          </p>
          <Link href="/registro-cliente" style={styles.ctaButton}>
            {isEn ? "Get started today" : "Empieza hoy"}
          </Link>
        </header>

        {/* 2. ¿Qué es FCL? */}
        <section style={styles.contentCard}>
          <h2 style={styles.cardTitle}>{isEn ? "What is FCL?" : "¿Qué es FCL?"}</h2>
          <div style={styles.textBlock}>
            {isEn ? (
              <>
                <p style={styles.paragraph}>
                  Full container load (FCL) shipping means renting a full
                  container for your shipment. This is the most economical
                  option when you have enough cargo to fill a 20- or 40-foot
                  container.
                </p>
                <p style={styles.paragraph}>
                  With FCL, you have exclusive use of the container, which means
                  your cargo is not mixed with other shipments. This provides
                  greater security, faster transit times and more flexibility in
                  handling your goods.
                </p>
                <p style={styles.paragraph}>
                  FCL is ideal for companies with regular shipping needs, large
                  orders or cargo that requires dedicated handling.
                </p>
              </>
            ) : (
              <>
                <p style={styles.paragraph}>
                  El envío de carga completa (FCL) implica alquilar un
                  contenedor completo para su envío. Esta es la opción más
                  económica cuando tiene suficiente carga para llenar un
                  contenedor de 20 o 40 pies.
                </p>
                <p style={styles.paragraph}>
                  Con FCL, usted tiene el uso exclusivo del contenedor, lo que
                  significa que su carga no se mezcla con otros envíos. Esto le
                  proporciona mayor seguridad, tiempos de tránsito más rápidos y
                  mayor flexibilidad en el manejo de sus mercancías.
                </p>
                <p style={styles.paragraph}>
                  FCL es ideal para empresas con necesidades de envío regulares,
                  pedidos grandes o carga que requiere un manejo dedicado.
                </p>
              </>
            )}
          </div>
        </section>

        {/* 3. ¿Por qué elegir nuestros servicios FCL? */}
        <section style={styles.sectionMargin}>
          <h2 style={styles.sectionTitle}>
            {isEn
              ? "Why choose our FCL services?"
              : "¿Por qué elegir nuestros servicios FCL?"}
          </h2>
          <div className="flc-features-grid">
            <div style={styles.featureCardSmall}>
              <span style={styles.featureIconBlue}>$</span>
              <div>
                <h3 style={styles.featureTitleSmall}>
                  {isEn ? "Cost-effective" : "Rentable"}
                </h3>
                <p style={styles.featureDescSmall}>
                  {isEn
                    ? "Best rates for full-container shipments with no hidden fees"
                    : "Las mejores tarifas para envíos de contenedores completos sin cargos ocultos"}
                </p>
              </div>
            </div>
            <div style={styles.featureCardSmall}>
              <span style={styles.featureIconBlue}>🕒</span>
              <div>
                <h3 style={styles.featureTitleSmall}>
                  {isEn ? "Fast transit" : "Tránsito rápido"}
                </h3>
                <p style={styles.featureDescSmall}>
                  {isEn
                    ? "Optimized routing for fast delivery to your destination"
                    : "Enrutamiento optimizado para una entrega rápida a su destino"}
                </p>
              </div>
            </div>
            <div style={styles.featureCardSmall}>
              <span style={styles.featureIconBlue}>🛡️</span>
              <div>
                <h3 style={styles.featureTitleSmall}>
                  {isEn ? "Safe handling" : "Manejo seguro"}
                </h3>
                <p style={styles.featureDescSmall}>
                  {isEn
                    ? "Full container integrity with dedicated handling procedures"
                    : "Integridad total del contenedor con procedimientos de manipulación específicos"}
                </p>
              </div>
            </div>
            <div style={styles.featureCardSmall}>
              <span style={styles.featureIconBlue}>📍</span>
              <div>
                <h3 style={styles.featureTitleSmall}>
                  {isEn ? "Global coverage" : "Cobertura global"}
                </h3>
                <p style={styles.featureDescSmall}>
                  {isEn
                    ? "Connections with major ports worldwide for smooth delivery"
                    : "Conexiones con los principales puertos del mundo para una entrega fluida"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Tipos de contenedores disponibles */}
        <section style={styles.sectionMargin}>
          <h2 style={styles.sectionTitle}>
            {isEn ? "Available container types" : "Tipos de contenedores disponibles"}
          </h2>
          <div style={styles.gridContainer}>
            <div style={styles.containerBox}>
              <h3 style={styles.containerTitle}>
                {isEn
                  ? "Standard 20-foot container"
                  : "Contenedor estándar de 20 pies"}
              </h3>
              <p style={styles.containerText}>
                <strong>{isEn ? "Capacity:" : "Capacidad:"}</strong>{" "}
                {isEn ? "33 cubic meters" : "33 metros cúbicos"}
              </p>
              <p style={styles.containerText}>
                <strong>{isEn ? "Weight limit:" : "Límite de peso:"}</strong>{" "}
                {isEn
                  ? "up to 20 metric tons"
                  : "hasta 20 toneladas métricas"}
              </p>
              <p style={styles.containerHighlightBlue}>
                {isEn
                  ? "Ideal for small and medium shipments."
                  : "Ideal para envíos pequeños y medianos."}
              </p>
            </div>
            <div style={styles.containerBox}>
              <h3 style={styles.containerTitle}>
                {isEn
                  ? "Standard 40-foot container"
                  : "Contenedor estándar de 40 pies"}
              </h3>
              <p style={styles.containerText}>
                <strong>{isEn ? "Capacity:" : "Capacidad:"}</strong>{" "}
                {isEn ? "67 cubic meters" : "67 metros cúbicos"}
              </p>
              <p style={styles.containerText}>
                <strong>{isEn ? "Weight limit:" : "Límite de peso:"}</strong>{" "}
                {isEn
                  ? "up to 30 metric tons"
                  : "hasta 30 toneladas métricas"}
              </p>
              <p style={styles.containerHighlightBlue}>
                {isEn
                  ? "Most popular option for general cargo"
                  : "Más popular para carga general"}
              </p>
            </div>
            <div style={styles.containerBox}>
              <h3 style={styles.containerTitle}>
                {isEn ? "Specialized containers" : "Contenedores especializados"}
              </h3>
              <p style={styles.containerText}>
                <strong>{isEn ? "Capacity:" : "Capacidad:"}</strong> {""}
                {isEn ? "Varies" : "Varía"}
              </p>
              <p style={styles.containerText}>
                <strong>{isEn ? "Weight limit:" : "Límite de peso:"}</strong>{" "}
                {isEn ? "Varies" : "Varía"}
              </p>
              <p style={styles.containerHighlightBlue}>
                {isEn
                  ? "For refrigerated, hazardous or oversized cargo"
                  : "Para carga refrigerada, peligrosa o de gran tamaño"}
              </p>
            </div>
          </div>
        </section>

        {/* 5. Nuestro proceso FCL */}
        <section style={styles.sectionMargin}>
          <h2 style={styles.sectionTitle}>
            {isEn ? "Our FCL process" : "Nuestro proceso FCL"}
          </h2>
          <div style={styles.timelineContainer}>
            {(isEn
              ? [
                  {
                    n: 1,
                    t: "Booking",
                    d: "Contact us with your shipment details and receive a quote.",
                  },
                  {
                    n: 2,
                    t: "Documentation",
                    d: "We handle all required customs and shipping paperwork.",
                  },
                  {
                    n: 3,
                    t: "Loading",
                    d: "Your cargo is carefully loaded and secured in the container.",
                  },
                  {
                    n: 4,
                    t: "Transit",
                    d: "Real-time tracking of your container throughout the journey.",
                  },
                  {
                    n: 5,
                    t: "Delivery",
                    d: "Safe delivery to your destination with complete documentation.",
                  },
                ]
              : [
                  {
                    n: 1,
                    t: "Reserva",
                    d: "Contáctanos con los detalles de tu envío y recibe una cotización.",
                  },
                  {
                    n: 2,
                    t: "Documentación",
                    d: "Nos encargamos de toda la documentación aduanera y de envío necesaria.",
                  },
                  {
                    n: 3,
                    t: "Cargando",
                    d: "Su carga se carga cuidadosamente y se asegura en el contenedor.",
                  },
                  {
                    n: 4,
                    t: "Tránsito",
                    d: "Seguimiento en tiempo real de su contenedor durante todo el recorrido",
                  },
                  {
                    n: 5,
                    t: "Entrega",
                    d: "Entrega segura a su destino con documentación completa",
                  },
                ]
            ).map((step, idx, arr) => (
              <div key={idx} style={styles.timelineItem}>
                <div style={styles.timelineLeft}>
                  <div style={styles.timelineNumber}>{step.n}</div>
                  {idx !== arr.length - 1 && <div style={styles.timelineLine}></div>}
                </div>
                <div style={styles.timelineRight}>
                  <h4 style={styles.timelineTitle}>{step.t}</h4>
                  <p style={styles.timelineDesc}>{step.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Precios transparentes */}
        <section style={styles.priceCard}>
          <div style={styles.priceHeader}>
            <span style={styles.priceIcon}>$</span>
            <h3 style={styles.priceHeaderTitle}>
              {isEn ? "Transparent pricing" : "Precios transparentes"}
            </h3>
          </div>
          <p style={styles.priceIntro}>
            {isEn
              ? "Our FCL rates include all standard shipping costs. We provide detailed quotes based on:"
              : "Nuestros precios de FCL incluyen todos los costos de envío estándar. Ofrecemos presupuestos detallados basados en:"}
          </p>
          <ul style={styles.priceList}>
            {isEn ? (
              <>
                <li>✅ Container size (20-foot or 40-foot)</li>
                <li>✅ Origin and destination ports</li>
                <li>✅ Cargo type and weight</li>
                <li>✅ Seasonal demand</li>
                <li>✅ Current market rates</li>
              </>
            ) : (
              <>
                <li>✅ Tamaño del contenedor (20 pies o 40 pies)</li>
                <li>✅ Puertos de origen y destino</li>
                <li>✅ Tipo y peso de la carga</li>
                <li>✅ Demanda estacional</li>
                <li>✅ Tasas de mercado actuales</li>
              </>
            )}
          </ul>
          <p style={styles.priceFooter}>
            {isEn
              ? "Contact us today for a personalized quote!"
              : "¡Contáctanos hoy para una cotización personalizada!"}
          </p>
        </section>

        {/* 7. Documentación requerida */}
        <section style={styles.docCard}>
          <div style={styles.docHeader}>
            <span style={styles.docIcon}>!</span>
            <h3 style={styles.docHeaderText}>
              {isEn ? "Required documentation" : "Documentación requerida"}
            </h3>
          </div>
          <div style={styles.docBody}>
            <h4 style={styles.docSubTitle}>
              {isEn
                ? "Invoice requirement for FCL shipments"
                : "Requisito de factura para envíos FCL"}
            </h4>
            <p style={styles.docText}>
              {isEn
                ? "To process your FCL shipment, clients must provide a valid invoice for all purchases included in the container. This invoice must include:"
                : "Para procesar su envío FCL, los clientes deben presentar una factura válida por todas las compras incluidas en el contenedor. Esta factura debe incluir:"}
            </p>
            <ul style={styles.docList}>
              {isEn ? (
                <>
                  <li>
                    • Detailed list of all products/goods being shipped
                  </li>
                  <li>• Unit prices and total shipment value</li>
                  <li>• Seller/supplier information</li>
                  <li>• Invoice date and number</li>
                  <li>
                    • Harmonized customs tariff code (HS code), if available
                  </li>
                </>
              ) : (
                <>
                  <li>
                    • Lista detallada de todos los productos/bienes que se
                    envían
                  </li>
                  <li>• Precios unitarios y valor total del envío</li>
                  <li>• Información del vendedor/proveedor</li>
                  <li>• Fecha y número de factura</li>
                  <li>
                    • Código arancelario armonizado aduanero (código SA), si
                    está disponible
                  </li>
                </>
              )}
            </ul>
            <p style={styles.docNote}>
              {isEn
                ? "This documentation is required for customs clearance and to ensure compliance with international shipping regulations."
                : "Esta documentación es necesaria para el despacho de aduanas y para garantizar el cumplimiento de las regulaciones de envío internacional."}
            </p>
          </div>
        </section>

        {/* 8. FORMULARIO DE COTIZACIÓN */}
        <section id="fcl-quote-form" style={styles.formContainer}>
          <h2 style={styles.formMainTitle}>
            {isEn ? "FCL quote request" : "Solicitud de cotización de FCL"}
          </h2>

          <form
            style={styles.formElement}
            onSubmit={handleFclSubmit}
          >
            <input
              type="hidden"
              name="access_key"
              value="a9902180-bd09-42e8-a283-4b4033c7ef5d"
            />
            <input
              type="hidden"
              name="subject"
              value={
                isEn
                  ? "New FCL quote request from website"
                  : "Nueva cotización FCL desde el sitio web"
              }
            />

            <input type="hidden" name="service_type" value="FCL" />

            {/* Su información / Your information */}
            <div style={styles.formSection}>
              <h3 style={styles.formSectionTitle}>
                {isEn ? "Your information" : "Su información"}
              </h3>
              <div style={styles.formGrid}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {isEn ? "Full name *" : "Nombre completo *"}
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    placeholder={isEn ? "John Smith" : "Juan Pérez"}

                    style={styles.input}
                    required
                  />

                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {isEn ? "Email *" : "Correo electrónico *"}
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder={
                      isEn ? "john@example.com" : "juan@ejemplo.com"
                    }

                    style={styles.input}
                    required
                  />

                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {isEn ? "Phone *" : "Teléfono *"}
                  </label>
                  <input
                    type="text"
                    name="phone"
                    placeholder={
                      isEn ? "+504 89467476" : "+504 89467476"
                    }

                    style={styles.input}
                    required
                  />

                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {isEn ? "Company" : "Compañía"}
                  </label>
                  <input
                    type="text"
                    name="company"
                    placeholder={
                      isEn
                        ? "Your company name"
                        : "El nombre de su empresa"
                    }

                    style={styles.input}
                  />

                </div>
              </div>
            </div>

            {/* Detalles del envío / Shipment details */}
            <div style={styles.formSection}>
              <h3 style={styles.formSectionTitle}>
                {isEn ? "Shipment details" : "Detalles del envío"}
              </h3>
              <div style={styles.formGrid}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {isEn ? "Origin port *" : "Puerto de origen *"}
                  </label>

                  <select
                    style={styles.select}
                    name="origin_port"
                    required
                  >
                    <option value="">
                      {isEn
                        ? "Select origin port"
                        : "Seleccionar puerto de origen"}
                    </option>

                    <option value="Miami">Miami</option>
                    <option value="Houston">Houston</option>
                    <option value="Otro">Otro</option>
                  </select>

                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {isEn ? "Destination port *" : "Puerto de destino *"}
                  </label>

                  <select
                    style={styles.select}
                    name="destination_port"
                    required
                  >
                    <option value="">
                      {isEn
                        ? "Select destination port"
                        : "Seleccionar puerto de destino"}
                    </option>

                    <option value="Puerto Cortes">Puerto Cortés</option>
                    <option value="Roatan">Roatán</option>
                    <option value="Otro">Otro</option>
                  </select>

                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {isEn ? "Cargo type *" : "Tipo de carga *"}
                  </label>

                  <select
                    style={styles.select}
                    name="cargo_type"
                    required
                  >
                    <option value="">
                      {isEn
                        ? "Select cargo type"
                        : "Seleccione el tipo de carga"}
                    </option>
                    <option value="General">
                      {isEn ? "General cargo" : "Carga general"}
                    </option>
                    <option value="Refrigerada">
                      {isEn ? "Refrigerated" : "Refrigerada"}
                    </option>
                    <option value="Peligrosa">
                      {isEn ? "Hazardous" : "Peligrosa"}
                    </option>
                    <option value="Otro">{isEn ? "Other" : "Otro"}</option>

                  </select>

                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {isEn
                      ? "Desired shipment date *"
                      : "Fecha de envío deseada *"}
                  </label>

                  <input
                    type="date"
                    name="desired_date"
                    style={styles.input}
                    required
                  />

                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {isEn ? "Weight (kg) *" : "Peso (kg) *"}
                  </label>

                  <input
                    type="number"
                    name="weight_kg"
                    placeholder="1000"
                    style={styles.input}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Notas adicionales / Additional notes */}
            <div style={styles.formSection}>
              <h3 style={styles.formSectionTitle}>
                {isEn ? "Additional notes" : "Notas adicionales"}
              </h3>
              <textarea
                placeholder={
                  isEn
                    ? "Any special requirements or additional information..."
                    : "Cualquier requerimiento especial o información adicional..."
                }

                style={styles.textarea}
                name="additional_notes"
              ></textarea>
            </div>

            {/* Botón enviar / Submit button */}
            <div style={styles.submitContainer}>
              <button type="submit" style={styles.submitButton}>
                {isEn ? "Request a quote" : "Solicitar cotización"}
              </button>

              <p style={styles.submitFootnote}>
                {isEn
                  ? "Our team will contact you within 24 hours with a detailed quote."
                  : "Nuestro equipo se pondrá en contacto contigo en 24 horas con un presupuesto detallado."}
              </p>

            </div>
          </form>
        </section>

      </div>
    </div>
  );
};

const styles: Record<string, any> = {
  pageContainer: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f8fbff',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    padding: '120px 20px',
    boxSizing: 'border-box',
    color: '#1e293b',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: '1000px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '80px',
  },
  mainTitle: {
    fontSize: '52px',
    fontWeight: '800',
    color: '#0f172a',
    margin: '0 0 24px 0',
    lineHeight: '1.1',
    letterSpacing: '-1.5px',
  },
  subTitle: {
    fontSize: '20px',
    color: '#64748b',
    lineHeight: '1.6',
    maxWidth: '800px',
    margin: '0 auto 40px auto',
  },
  ctaButton: {
    backgroundColor: '#2563eb',
    color: '#fff',
    padding: '16px 40px',
    fontSize: '16px',
    fontWeight: '700',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
  },
  sectionMargin: {
    marginTop: '80px',
  },
  sectionTitle: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: '40px',
  },
  contentCard: {
    backgroundColor: '#fff',
    padding: '48px',
    borderRadius: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    border: '1px solid #f1f5f9',
  },
  cardTitle: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '32px',
  },
  paragraph: {
    fontSize: '17px',
    lineHeight: '1.7',
    color: '#475569',
    marginBottom: '24px',
  },
  grid2x2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  featureCardSmall: {
    backgroundColor: '#fff',
    padding: '24px',
    borderRadius: '16px',
    border: '1px solid #f1f5f9',
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
  },
  featureIconBlue: {
    fontSize: '24px',
    color: '#2563eb',
    fontWeight: 'bold',
  },
  featureTitleSmall: {
    fontSize: '17px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  },
  featureDescSmall: {
    fontSize: '14px',
    color: '#64748b',
    lineHeight: '1.5',
    margin: 0,
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },
  containerBox: {
    backgroundColor: '#fff',
    padding: '32px',
    borderRadius: '16px',
    border: '1px solid #f1f5f9',
    textAlign: 'left',
  },
  containerTitle: {
    fontSize: '18px',
    fontWeight: '700',
    marginBottom: '16px',
  },
  containerText: {
    fontSize: '15px',
    color: '#475569',
    margin: '4px 0',
  },
  containerHighlightBlue: {
    fontSize: '15px',
    color: '#2563eb',
    fontWeight: '600',
    marginTop: '16px',
  },
  timelineContainer: {
    maxWidth: '600px',
    margin: '0 auto',
  },
  timelineItem: {
    display: 'flex',
    gap: '20px',
  },
  timelineLeft: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  timelineNumber: {
    width: '32px',
    height: '32px',
    backgroundColor: '#2563eb',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '14px',
    zIndex: 2,
  },
  timelineLine: {
    width: '2px',
    flex: 1,
    backgroundColor: '#dbeafe',
    margin: '4px 0',
  },
  timelineRight: {
    paddingBottom: '32px',
  },
  timelineTitle: {
    fontSize: '17px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  },
  timelineDesc: {
    fontSize: '15px',
    color: '#64748b',
    margin: 0,
  },
  priceCard: {
    marginTop: '80px',
    backgroundColor: '#f0fdfa',
    padding: '40px',
    borderRadius: '20px',
    border: '1px solid #ccfbf1',
  },
  priceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  priceIcon: {
    fontSize: '20px',
    fontWeight: 'bold',
  },
  priceHeaderTitle: {
    fontSize: '20px',
    fontWeight: '700',
    margin: 0,
  },
  priceIntro: {
    fontSize: '16px',
    color: '#374151',
    marginBottom: '20px',
  },
  priceList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 24px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  priceFooter: {
    fontSize: '16px',
    color: '#2563eb',
    fontWeight: '700',
    margin: 0,
  },
  docCard: {
    marginTop: '40px',
    backgroundColor: '#fffbeb',
    padding: '40px',
    borderRadius: '20px',
    border: '1px solid #fef3c7',
  },
  docHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  docIcon: {
    width: '24px',
    height: '24px',
    border: '2px solid #92400e',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#92400e',
    fontWeight: '800',
    fontSize: '14px',
  },
  docHeaderText: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#92400e',
    margin: 0,
  },
  docSubTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#92400e',
    marginBottom: '16px',
  },
  docText: {
    fontSize: '15px',
    color: '#92400e',
    lineHeight: '1.6',
    marginBottom: '20px',
  },
  docList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 24px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    color: '#92400e',
    fontSize: '15px',
    fontWeight: '500',
  },
  docNote: {
    fontSize: '14px',
    fontStyle: 'italic',
    color: '#b45309',
    margin: 0,
  },
  // ESTILOS DEL FORMULARIO
  formContainer: {
    marginTop: '80px',
    backgroundColor: '#fff',
    padding: '48px',
    borderRadius: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    border: '1px solid #f1f5f9',
  },
  formMainTitle: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '40px',
    color: '#0f172a',
  },
  formElement: {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
  },
  formSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formSectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#334155',
    margin: 0,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '24px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '15px',
    backgroundColor: '#fff',
    color: '#64748b',
    outline: 'none',
  },
  uploadArea: {
    border: '2px dashed #e2e8f0',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#f8fbff',
  },
  uploadIcon: {
    fontSize: '32px',
  },
  uploadText: {
    fontSize: '15px',
    color: '#475569',
    margin: 0,
  },
  uploadLink: {
    color: '#2563eb',
    fontWeight: '600',
    cursor: 'pointer',
  },
  uploadSubtext: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: 0,
  },
  textarea: {
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '15px',
    minHeight: '120px',
    resize: 'vertical',
    outline: 'none',
  },
  submitContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    marginTop: '20px',
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    color: '#fff',
    padding: '16px',
    fontSize: '16px',
    fontWeight: '700',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  submitFootnote: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
  }
};

export default FLC;