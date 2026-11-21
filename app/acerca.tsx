import React from "react";
import { useTranslation } from "react-i18next";

export function AcercaSection() {
  const { i18n } = useTranslation();
  const isEn = i18n.language.startsWith("en");

  return (
    <section className="acerca-section page-section">
      <div className="acerca-container">
        <section className="acerca-intro">
          {isEn ? (
            <>
              <h1>About our company</h1>
              <p>
                Caribex Logistics Group is a modern, agile international
                transport and cargo consolidation company based in Roatán,
                Honduras. Founded to simplify global shipping for businesses and
                individuals across Honduras, we combine personalized customer
                care with smart digital tools to move your cargo safely,
                transparently, and on schedule.
              </p>
              <h2>Flexible shipping built around your needs</h2>
              <p>
                Whether you are a growing business restocking inventory or an
                individual importing personal goods, we tailor our freight
                solutions to fit your budget and timeline.
              </p>
              <ul>
                <li><strong>Full Container Load (FCL):</strong> Dedicated 20ft and 40ft containers for high-volume shipments requiring direct transit and maximum security.</li>
                <li><strong>Less Than Container Load (LCL):</strong> Smart cargo consolidation for smaller shipments—from a single box or pallet to partial loads—so you only pay for the exact space you use.</li>
                <li><strong>End-to-End Support:</strong> From warehousing and cargo consolidation to customs documentation and local delivery across Roatán, San Pedro Sula, La Ceiba, Trujillo, Tegucigalpa, Utila, and Guanaja, we handle the complex logistics so you do not have to.</li>
              </ul>
              <h2>Why ship with Caribex?</h2>
              <ul>
                <li><strong>Direct, personal attention:</strong> As a dedicated team, you never get lost in a corporate call center. You work directly with logistics specialists who proactively monitor your cargo from origin to destination.</li>
                <li><strong>Modern digital convenience:</strong> Get instant rate estimates with our online Shipping Calculator, manage your account through Client Signup, and track shipments, documents, and invoices anytime inside our Customer Portal.</li>
                <li><strong>Transparent and reliable:</strong> No hidden surprises—just clear communication, competitive consolidation rates, and dependable sailing schedules.</li>
              </ul>
              <p>
                At Caribex Logistics Group, we are committed to earning your
                trust with every shipment and growing alongside your business as
                your dedicated logistics partner.
              </p>
            </>
          ) : (
            <>
              <h1>Acerca de nuestra empresa</h1>
              <p>
                Caribex Logistics Group es una empresa moderna y ágil de
                transporte internacional y consolidación de carga con sede en
                Roatán, Honduras. Nacimos para simplificar los envíos globales
                para empresas y particulares en todo Honduras, combinando una
                atención personalizada con herramientas digitales inteligentes
                para mover su carga de forma segura, transparente y puntual.
              </p>
              <h2>Envíos flexibles según sus necesidades</h2>
              <p>
                Ya sea que una empresa en crecimiento esté reabasteciendo su
                inventario o que una persona esté importando bienes personales,
                adaptamos nuestras soluciones de carga a su presupuesto y plazo.
              </p>
              <ul>
                <li><strong>Contenedor completo (FCL):</strong> Contenedores dedicados de 20 y 40 pies para cargas de gran volumen que requieren tránsito directo y máxima seguridad.</li>
                <li><strong>Carga consolidada (LCL):</strong> Consolidación inteligente para envíos pequeños, desde una caja o palé hasta cargas parciales, para que pague únicamente por el espacio que utiliza.</li>
                <li><strong>Atención integral:</strong> Desde almacenamiento y consolidación hasta documentación aduanera y entrega local en Roatán, San Pedro Sula, La Ceiba, Trujillo, Tegucigalpa, Utila y Guanaja, nos encargamos de la logística compleja por usted.</li>
              </ul>
              <h2>¿Por qué enviar con Caribex?</h2>
              <ul>
                <li><strong>Atención directa y personal:</strong> Como equipo dedicado, usted no se pierde en un centro de llamadas corporativo. Trabaja directamente con especialistas que supervisan su carga desde el origen hasta el destino.</li>
                <li><strong>Conveniencia digital moderna:</strong> Obtenga estimaciones instantáneas con nuestra Calculadora de Envíos, administre su cuenta desde el Registro de Clientes y consulte envíos, documentos y facturas en cualquier momento desde nuestro Portal del Cliente.</li>
                <li><strong>Transparencia y confianza:</strong> Sin sorpresas ocultas: comunicación clara, tarifas competitivas de consolidación y calendarios de navegación confiables.</li>
              </ul>
              <p>
                En Caribex Logistics Group nos comprometemos a ganar su confianza
                con cada envío y a crecer junto a su negocio como su socio logístico
                dedicado.
              </p>
            </>
          )}
        </section>

        <section className="acerca-mission-vision">
          <div className="acerca-card acerca-card-mision">
            {isEn ? (
              <>
                <h2>Our mission</h2>
                <p>
                  To provide reliable, efficient and cost-effective cargo
                  transport and container consolidation services that connect
                  businesses throughout the Caribbean and beyond. We are
                  committed to simplifying international logistics for our
                  clients.
                </p>
              </>
            ) : (
              <>
                <h2>Nuestra misión</h2>
                <p>
                  Brindar servicios confiables, eficientes y rentables de
                  transporte de carga y consolidación de contenedores que
                  conecten a empresas en todo el Caribe y más allá. Nos
                  comprometemos a simplificar la logística internacional para
                  nuestros clientes.
                </p>
              </>
            )}
          </div>

          <div className="acerca-card acerca-card-vision">
            {isEn ? (
              <>
                <h2>Our vision</h2>
                <p>
                  To become the leading cargo transport company in the
                  Caribbean region, recognized for our exceptional service,
                  innovation and commitment to customer success. We strive to
                  make international transport accessible and affordable for
                  businesses of all sizes.
                </p>
              </>
            ) : (
              <>
                <h2>Nuestra visión</h2>
                <p>
                  Convertirnos en la empresa líder en transporte de carga en la
                  región del Caribe, reconocida por nuestro servicio
                  excepcional, innovación y compromiso con el éxito del cliente.
                  Nos esforzamos por hacer que el transporte internacional sea
                  accesible y asequible para empresas de todos los tamaños.
                </p>
              </>
            )}
          </div>
        </section>

        <h2 className="acerca-section-title">
          {isEn ? "Our core values" : "Nuestros valores fundamentales"}
        </h2>

        <div className="acerca-values-grid">
          <div className="acerca-value-item">
            <div className="acerca-value-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <div className="acerca-value-text">
              {isEn ? (
                <>
                  <h3>Reliability</h3>
                  <p>
                    We keep our promises. Your cargo is handled with care and
                    delivered on time, every time.
                  </p>
                </>
              ) : (
                <>
                  <h3>Fiabilidad</h3>
                  <p>
                    Cumplimos nuestras promesas. Su carga se maneja con cuidado
                    y se entrega a tiempo, siempre.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="acerca-value-item">
            <div className="acerca-value-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <div className="acerca-value-text">
              {isEn ? (
                <>
                  <h3>Global reach</h3>
                  <p>
                    With connections around the world, we ensure your shipments
                    reach any destination efficiently.
                  </p>
                </>
              ) : (
                <>
                  <h3>Alcance global</h3>
                  <p>
                    Con conexiones en todo el mundo, garantizamos que sus
                    envíos lleguen a cualquier destino de manera eficiente.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="acerca-value-item">
            <div className="acerca-value-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ea580c"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            </div>
            <div className="acerca-value-text">
              {isEn ? (
                <>
                  <h3>Excellence</h3>
                  <p>
                    We maintain the highest standards in every aspect of our
                    operations and customer service.
                  </p>
                </>
              ) : (
                <>
                  <h3>Excelencia</h3>
                  <p>
                    Mantenemos los más altos estándares en todos los aspectos
                    de nuestras operaciones y servicio al cliente.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="acerca-value-item">
            <div className="acerca-value-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#16a34a"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="acerca-value-text">
              {isEn ? (
                <>
                  <h3>Customer focus</h3>
                  <p>
                    Your success is our success. We work closely with you to
                    meet your specific shipping needs.
                  </p>
                </>
              ) : (
                <>
                  <h3>Enfoque en el cliente</h3>
                  <p>
                    Su éxito es nuestro éxito. Trabajamos estrechamente con
                    usted para satisfacer sus necesidades de envío específicas.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AcercaSection;
