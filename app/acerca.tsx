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
                Caribex Logistics Group is a leading transport and cargo
                consolidation company based in Roatán, Honduras. With years of
                experience in international logistics, we have built a
                reputation for reliability, efficiency and exceptional customer
                service.
              </p>
              <p>
                We specialize in full container load (FCL) and less than
                container load (LCL) services, offering flexible solutions for
                companies of all sizes. Whether you ship a single pallet or fill
                an entire container, we have the experience and resources to
                handle your cargo safely and efficiently.
              </p>
              <p>
                Our team of professionals with extensive logistics experience is
                dedicated to providing personalized service and innovative
                solutions. We leverage advanced technology and industry
                partnerships to ensure your shipments are tracked, managed and
                delivered with precision.
              </p>
              <p>
                At Caribex Logistics Group, we believe in building long-term
                relationships with our clients. We are not just a service
                provider: we are your trusted partner in international trade.
              </p>
            </>
          ) : (
            <>
              <h1>Acerca de nuestra empresa</h1>
              <p>
                Caribex Logistics Group es una empresa líder en transporte y
                consolidación de carga con sede en Roatán, Honduras. Con años de
                experiencia en logística internacional, nos hemos forjado una
                reputación de confiabilidad, eficiencia y un servicio al cliente
                excepcional.
              </p>
              <p>
                Nos especializamos en servicios de carga de contenedor completo
                (FCL) y carga fraccionada (LCL), ofreciendo soluciones flexibles
                para empresas de todos los tamaños. Ya sea que envíe un solo
                palé o llene un contenedor completo, contamos con la experiencia
                y los recursos para gestionar su carga de forma segura y
                eficiente.
              </p>
              <p>
                Nuestro equipo de profesionales con amplia experiencia en
                logística se dedica a brindar un servicio personalizado y
                soluciones innovadoras. Aprovechamos tecnología avanzada y
                colaboraciones con la industria para garantizar que sus envíos
                se rastreen, gestionen y entreguen con precisión.
              </p>
              <p>
                En Caribex Logistics Group, creemos en construir relaciones a
                largo plazo con nuestros clientes. No somos solo un proveedor de
                servicios: somos su socio de confianza en el comercio
                internacional.
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