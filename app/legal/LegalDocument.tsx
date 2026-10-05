import Link from "next/link";

type LegalDocumentProps = {
  kind: "privacy" | "terms";
};

const privacySections = [
  {
    en: "1. Information We Collect",
    es: "1. Información que recopilamos",
    bodyEn: "We may collect information you provide when you create an account, request a quote, ship cargo, contact us, use the customer portal, or communicate with our staff. This may include your name, customer account number, email address, phone number, billing details, shipment tracking information, delivery details, notes, and documents or photographs that you choose to upload. We may also receive limited technical information such as browser type, device information, approximate location, and log data needed to operate and protect the service.",
    bodyEs: "Podemos recopilar la información que usted proporciona cuando crea una cuenta, solicita una cotización, envía carga, nos contacta, utiliza el portal del cliente o se comunica con nuestro personal. Esto puede incluir su nombre, número de cuenta, correo electrónico, teléfono, datos de facturación, información de seguimiento, datos de entrega, notas y documentos o fotografías que usted decida cargar. También podemos recibir información técnica limitada, como el tipo de navegador, información del dispositivo, ubicación aproximada y datos de registro necesarios para operar y proteger el servicio.",
  },
  {
    en: "2. How We Use Information",
    es: "2. Cómo utilizamos la información",
    bodyEn: "Caribex uses information to provide freight forwarding, warehousing, delivery, pickup, billing, customer-support, and tracking services; create and maintain customer accounts; calculate charges and send invoices; communicate shipment updates; investigate damage or service problems; improve the website and applications; prevent fraud and unauthorized access; and comply with legal, customs, tax, and accounting obligations.",
    bodyEs: "Caribex utiliza la información para prestar servicios de transporte, almacenamiento, entrega, recogida, facturación, atención al cliente y seguimiento; crear y mantener cuentas; calcular cargos y enviar facturas; comunicar actualizaciones del envío; investigar daños o problemas del servicio; mejorar el sitio web y las aplicaciones; prevenir fraude y accesos no autorizados; y cumplir obligaciones legales, aduaneras, tributarias y contables.",
  },
  {
    en: "3. Shipment and Billing Information",
    es: "3. Información de envíos y facturación",
    bodyEn: "Shipment information is used by Caribex and its authorized operations personnel to identify, receive, measure, consolidate, transport, unload, and release cargo. Billing information may be used to calculate freight, handling, storage, customs-related, and other authorized charges. Internal notes and problem photographs are restricted to authorized staff and administrators and are not displayed as customer-facing notes unless disclosure is required to resolve a claim or comply with law.",
    bodyEs: "La información del envío es utilizada por Caribex y el personal autorizado para identificar, recibir, medir, consolidar, transportar, descargar y entregar la carga. La información de facturación puede utilizarse para calcular flete, manejo, almacenamiento, cargos relacionados con aduanas y otros cargos autorizados. Las notas internas y fotografías de problemas están restringidas al personal y administradores autorizados y no se muestran como notas públicas del cliente, salvo cuando sea necesario para resolver un reclamo o cumplir la ley.",
  },
  {
    en: "4. Sharing Information",
    es: "4. Compartir información",
    bodyEn: "We may share information with service providers that help us operate email, hosting, authentication, payment, storage, analytics, communications, and logistics systems. We may also share information with carriers, port or warehouse partners, customs or government authorities, professional advisers, or a successor to the business when needed to provide services, protect people and property, investigate abuse, or comply with a lawful request. We do not sell customer personal information.",
    bodyEs: "Podemos compartir información con proveedores que nos ayudan a operar servicios de correo electrónico, alojamiento, autenticación, pagos, almacenamiento, análisis, comunicaciones y logística. También podemos compartir información con transportistas, socios portuarios o de almacén, autoridades aduaneras o gubernamentales, asesores profesionales o un sucesor del negocio cuando sea necesario para prestar servicios, proteger a las personas y los bienes, investigar abusos o cumplir una solicitud legal. No vendemos la información personal de nuestros clientes.",
  },
  {
    en: "5. Security and Retention",
    es: "5. Seguridad y conservación",
    bodyEn: "We use reasonable administrative, technical, and organizational safeguards designed to protect information from unauthorized access, alteration, disclosure, or destruction. No internet transmission or storage system can be guaranteed to be completely secure. We retain information for as long as reasonably necessary to provide services, maintain business and tax records, resolve disputes, enforce agreements, prevent abuse, and meet legal obligations.",
    bodyEs: "Utilizamos medidas administrativas, técnicas y organizativas razonables para proteger la información contra acceso, alteración, divulgación o destrucción no autorizados. Ninguna transmisión por internet ni sistema de almacenamiento puede garantizar seguridad absoluta. Conservamos la información durante el tiempo razonablemente necesario para prestar servicios, mantener registros comerciales y tributarios, resolver disputas, hacer cumplir acuerdos, prevenir abusos y cumplir obligaciones legales.",
  },
  {
    en: "6. Cookies and Similar Technologies",
    es: "6. Cookies y tecnologías similares",
    bodyEn: "The website may use cookies, local storage, session technologies, and similar tools to remember preferences, maintain sessions, support security, understand site performance, and improve the user experience. You may be able to control cookies through your browser settings, but disabling them may affect login, portal, or other functionality.",
    bodyEs: "El sitio web puede utilizar cookies, almacenamiento local, tecnologías de sesión y herramientas similares para recordar preferencias, mantener sesiones, apoyar la seguridad, entender el rendimiento del sitio y mejorar la experiencia. Usted puede controlar las cookies mediante la configuración de su navegador, pero desactivarlas puede afectar el inicio de sesión, el portal u otras funciones.",
  },
  {
    en: "7. Your Choices and Requests",
    es: "7. Sus opciones y solicitudes",
    bodyEn: "You may request access to, correction of, or deletion of personal information that we hold, subject to records that we must retain for legal, security, billing, or operational reasons. You may also ask us to update contact preferences or explain how information is being used. To make a request, contact us using the information below and include enough detail for us to verify and locate the relevant account or shipment.",
    bodyEs: "Usted puede solicitar acceso, corrección o eliminación de la información personal que conservamos, sujeto a los registros que debamos conservar por razones legales, de seguridad, facturación u operación. También puede solicitar actualizar sus preferencias de contacto o pedir una explicación sobre el uso de la información. Para hacer una solicitud, contáctenos usando la información indicada abajo e incluya suficientes detalles para verificar y localizar la cuenta o envío correspondiente.",
  },
  {
    en: "8. Children",
    es: "8. Menores de edad",
    bodyEn: "Our services are intended for customers who can enter into a legally binding agreement. We do not knowingly collect personal information from children through the website. If you believe a child has provided information to us, please contact us so that we can review and remove it when appropriate.",
    bodyEs: "Nuestros servicios están dirigidos a clientes que pueden celebrar un acuerdo legalmente vinculante. No recopilamos deliberadamente información personal de menores a través del sitio web. Si cree que un menor nos ha proporcionado información, contáctenos para que podamos revisarla y eliminarla cuando corresponda.",
  },
  {
    en: "9. International and Third-Party Services",
    es: "9. Servicios internacionales y de terceros",
    bodyEn: "Because logistics and technology providers may operate in different countries, information may be processed outside Honduras. We expect service providers to use information only for authorized purposes and to apply appropriate safeguards. Third-party websites and services linked from Caribex have their own privacy practices, and their policies apply when you use those services.",
    bodyEs: "Debido a que los proveedores de logística y tecnología pueden operar en distintos países, la información puede procesarse fuera de Honduras. Esperamos que los proveedores utilicen la información únicamente para fines autorizados y apliquen medidas de protección adecuadas. Los sitios y servicios de terceros enlazados desde Caribex tienen sus propias prácticas de privacidad, y sus políticas aplican cuando usted utiliza dichos servicios.",
  },
  {
    en: "10. Changes and Contact",
    es: "10. Cambios y contacto",
    bodyEn: "We may update this Privacy Policy when our services, technology, or legal obligations change. The updated version will be posted on this page with a revised date. Questions or privacy requests may be sent to info@caribexlogisticsgroup.com or +504 89467476. Caribex Logistics Group operates from Roatán, Honduras.",
    bodyEs: "Podemos actualizar esta Política de Privacidad cuando cambien nuestros servicios, tecnología u obligaciones legales. La versión actualizada se publicará en esta página con una fecha revisada. Las preguntas o solicitudes de privacidad pueden enviarse a info@caribexlogisticsgroup.com o al +504 89467476. Caribex Logistics Group opera desde Roatán, Honduras.",
  },
];

const termsSections = [
  {
    en: "1. Acceptance and Scope",
    es: "1. Aceptación y alcance",
    bodyEn: "These Terms of Service govern your use of the Caribex website, customer portal, mobile and workflow applications, freight forwarding, warehousing, delivery, pickup, and related services. By accessing the website, creating an account, requesting a quote, tendering cargo, or using a service, you agree to these Terms. If you do not agree, do not use the service.",
    bodyEs: "Estos Términos de Servicio rigen el uso del sitio web, portal del cliente, aplicaciones móviles y operativas de Caribex, así como los servicios de transporte, almacenamiento, entrega, recogida y servicios relacionados. Al acceder al sitio, crear una cuenta, solicitar una cotización, entregar carga o utilizar un servicio, usted acepta estos Términos. Si no está de acuerdo, no utilice el servicio.",
  },
  {
    en: "2. Services and Availability",
    es: "2. Servicios y disponibilidad",
    bodyEn: "Caribex provides logistics services including FCL and LCL freight, receiving, warehousing, consolidation, transportation coordination, unloading, pickup, and related support. Services, routes, schedules, ports, storage capacity, and transit times are subject to availability and operational conditions. Estimated dates are not guaranteed departure or delivery deadlines unless Caribex confirms a separate written commitment.",
    bodyEs: "Caribex presta servicios logísticos que incluyen carga FCL y LCL, recepción, almacenamiento, consolidación, coordinación de transporte, descarga, recogida y apoyo relacionado. Los servicios, rutas, horarios, puertos, capacidad de almacenamiento y tiempos de tránsito están sujetos a disponibilidad y condiciones operativas. Las fechas estimadas no son fechas garantizadas de salida o entrega, salvo que Caribex confirme por escrito un compromiso distinto.",
  },
  {
    en: "3. Customer Information and Account Security",
    es: "3. Información del cliente y seguridad de la cuenta",
    bodyEn: "You must provide accurate, complete, and current customer, consignee, address, contact, cargo, and customs information. Names and account details must match the information registered with Caribex. You are responsible for protecting your login credentials and for activity performed through your account. Notify Caribex promptly if you believe an account or shipment record has been accessed or changed without authorization.",
    bodyEs: "Usted debe proporcionar información exacta, completa y actualizada del cliente, destinatario, dirección, contacto, carga y aduanas. Los nombres y datos de cuenta deben coincidir con la información registrada en Caribex. Usted es responsable de proteger sus credenciales y de las actividades realizadas desde su cuenta. Notifique a Caribex de inmediato si cree que una cuenta o registro de envío fue accedido o modificado sin autorización.",
  },
  {
    en: "4. Cargo Preparation and Prohibited Items",
    es: "4. Preparación de carga y artículos prohibidos",
    bodyEn: "Customers are responsible for accurate descriptions, packaging, labels, dimensions, weight, declared value, and required documentation. Do not tender illegal, dangerous, hazardous, explosive, flammable, counterfeit, stolen, or otherwise prohibited goods. Caribex may refuse, hold, inspect, report, or dispose of cargo when required by law, safety procedures, carrier rules, customs requirements, or these Terms.",
    bodyEs: "Los clientes son responsables de las descripciones, embalaje, etiquetas, dimensiones, peso, valor declarado y documentación requerida. No entregue bienes ilegales, peligrosos, explosivos, inflamables, falsificados, robados o prohibidos. Caribex puede rechazar, retener, inspeccionar, reportar o disponer de la carga cuando lo exijan la ley, los procedimientos de seguridad, las reglas del transportista, las aduanas o estos Términos.",
  },
  {
    en: "5. Rates, Billing, and Payment",
    es: "5. Tarifas, facturación y pago",
    bodyEn: "Rates and invoices are based on the shipment information available to Caribex, including type, measurements, weight, handling, storage, consolidation, and other authorized charges. Billing may be recalculated if information changes or measurements differ from the declared information. Charges are generally stated in United States Dollars. Customers are responsible for applicable taxes, duties, customs charges, storage fees, and other amounts shown on the invoice. Unpaid balances may delay release or pickup and may result in collection or late charges permitted by law.",
    bodyEs: "Las tarifas y facturas se basan en la información disponible del envío, incluyendo tipo, medidas, peso, manejo, almacenamiento, consolidación y otros cargos autorizados. La facturación puede recalcularse si cambia la información o si las medidas difieren de lo declarado. Los cargos generalmente se expresan en dólares estadounidenses. El cliente es responsable de impuestos, derechos, cargos aduaneros, almacenamiento y demás importes indicados en la factura. Los saldos pendientes pueden retrasar la entrega o recogida y generar cargos de cobro o mora permitidos por la ley.",
  },
  {
    en: "6. Storage, Delays, and Release",
    es: "6. Almacenamiento, retrasos y entrega",
    bodyEn: "Cargo may be subject to storage charges after the applicable free-storage period. Delays may result from weather, port congestion, customs, carrier capacity, incomplete documents, incorrect customer information, inspections, strikes, government action, or other events outside Caribex's reasonable control. Cargo will be released only to an authorized customer or representative after required identification, account verification, and payment conditions are satisfied.",
    bodyEs: "La carga puede estar sujeta a cargos de almacenamiento después del período gratuito aplicable. Los retrasos pueden resultar del clima, congestión portuaria, aduanas, capacidad del transportista, documentos incompletos, información incorrecta, inspecciones, huelgas, acciones gubernamentales u otros eventos fuera del control razonable de Caribex. La carga solo se entregará a un cliente o representante autorizado después de cumplir los requisitos de identificación, verificación y pago.",
  },
  {
    en: "7. Claims, Insurance, and Liability",
    es: "7. Reclamos, seguro y responsabilidad",
    bodyEn: "Optional cargo insurance may be available for eligible shipments and must be requested and paid for according to the applicable terms. Customers should inspect cargo promptly and report loss, damage, shortage, or misdelivery in writing with supporting evidence. To the maximum extent permitted by law, Caribex is not responsible for indirect or consequential losses, delays caused by events outside its reasonable control, or damage caused by inadequate packaging, inaccurate information, prohibited goods, or the customer's acts or omissions. Any limitation does not exclude liability that cannot legally be excluded.",
    bodyEs: "Puede existir seguro opcional para ciertos envíos, el cual debe solicitarse y pagarse conforme a sus condiciones aplicables. El cliente debe inspeccionar la carga oportunamente y reportar por escrito cualquier pérdida, daño, faltante o entrega incorrecta con evidencia de respaldo. En la máxima medida permitida por la ley, Caribex no responde por pérdidas indirectas o consecuentes, retrasos causados por hechos fuera de su control razonable, ni daños causados por embalaje inadecuado, información incorrecta, bienes prohibidos o actos u omisiones del cliente. Ninguna limitación excluye responsabilidad que legalmente no pueda excluirse.",
  },
  {
    en: "8. Website and Application Use",
    es: "8. Uso del sitio y las aplicaciones",
    bodyEn: "You may not misuse the website, portal, or applications; bypass security; access another person's account; submit false or malicious data; interfere with scanning, tracking, billing, or logistics records; reverse engineer the service; or use the service for an unlawful purpose. Caribex may suspend access or correct records when reasonably necessary to protect customers, cargo, systems, and staff.",
    bodyEs: "Usted no puede hacer uso indebido del sitio, portal o aplicaciones; evadir la seguridad; acceder a la cuenta de otra persona; enviar datos falsos o maliciosos; interferir con registros de escaneo, seguimiento, facturación o logística; realizar ingeniería inversa del servicio; ni utilizarlo para fines ilegales. Caribex puede suspender el acceso o corregir registros cuando sea razonablemente necesario para proteger a clientes, carga, sistemas y personal.",
  },
  {
    en: "9. Intellectual Property",
    es: "9. Propiedad intelectual",
    bodyEn: "The Caribex name, logos, website content, software, workflows, graphics, and other materials belong to Caribex Logistics Group or its licensors. Except for the limited right to use the service for its intended purpose, no content may be copied, modified, distributed, sold, or used without prior written permission.",
    bodyEs: "El nombre Caribex, sus logotipos, contenido del sitio, software, flujos de trabajo, gráficos y demás materiales pertenecen a Caribex Logistics Group o sus licenciantes. Salvo el derecho limitado de utilizar el servicio para su finalidad prevista, ningún contenido puede copiarse, modificarse, distribuirse, venderse o utilizarse sin autorización previa por escrito.",
  },
  {
    en: "10. Suspension, Changes, and Contact",
    es: "10. Suspensión, cambios y contacto",
    bodyEn: "Caribex may update services or these Terms by posting a revised version. Continued use after the effective date means you accept the update. We may suspend or terminate an account or service for nonpayment, unsafe or prohibited cargo, misuse, fraud, legal requirements, or material breach. Questions about these Terms may be sent to info@caribexlogisticsgroup.com or +504 89467476. Caribex Logistics Group operates from Roatán, Honduras.",
    bodyEs: "Caribex puede actualizar sus servicios o estos Términos mediante la publicación de una versión revisada. El uso continuado después de la fecha de vigencia significa que usted acepta la actualización. Podemos suspender o terminar una cuenta o servicio por falta de pago, carga insegura o prohibida, uso indebido, fraude, requisitos legales o incumplimiento sustancial. Las preguntas sobre estos Términos pueden enviarse a info@caribexlogisticsgroup.com o al +504 89467476. Caribex Logistics Group opera desde Roatán, Honduras.",
  },
];

export default function LegalDocument({ kind }: LegalDocumentProps) {
  const isPrivacy = kind === "privacy";
  const sections = isPrivacy ? privacySections : termsSections;
  const titleEn = isPrivacy ? "Privacy Policy" : "Terms of Service";
  const titleEs = isPrivacy ? "Política de Privacidad" : "Términos de Servicio";

  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link href="/" className="legal-back">← Back to Caribex</Link>
        <header className="legal-header">
          <p className="legal-eyebrow">CARIBEX LOGISTICS GROUP</p>
          <h1>{titleEs}</h1>
          <p className="legal-english-title">{titleEn}</p>
          <p className="legal-meta">Effective date / Fecha de vigencia: October 5, 2026</p>
          <p className="legal-note">This page is provided for customer review and should be reviewed by qualified legal counsel before being treated as a final legal notice.</p>
        </header>
        <div className="legal-content">
          {sections.map((section) => (
            <section className="legal-section" key={section.en}>
              <h2>{section.es}</h2>
              <p className="legal-language-label">English — {section.en}</p>
              <p>{section.bodyEs}</p>
              <p>{section.bodyEn}</p>
            </section>
          ))}
        </div>
        <footer className="legal-footer">
          <p>Caribex Logistics Group · Roatán, Honduras</p>
          <p><a href="mailto:info@caribexlogisticsgroup.com">info@caribexlogisticsgroup.com</a> · +504 89467476</p>
          <div className="legal-footer-links">
            <Link href="/privacidad">Privacy Policy / Privacidad</Link>
            <Link href="/terminos">Terms of Service / Términos</Link>
          </div>
        </footer>
      </div>
      <style>{`
        .legal-page { min-height: 100vh; background: #f4f8fc; color: #18344c; padding: 32px 18px 56px; }
        .legal-shell { max-width: 980px; margin: 0 auto; }
        .legal-back { color: #17689b; font-weight: 800; text-decoration: none; }
        .legal-header { background: linear-gradient(135deg, #123b62, #1b78ab); color: #fff; border-radius: 22px; padding: 34px clamp(22px, 5vw, 58px); margin: 24px 0; box-shadow: 0 18px 42px rgba(15, 54, 86, .18); }
        .legal-eyebrow { letter-spacing: .16em; font-size: .75rem; font-weight: 900; opacity: .78; }
        .legal-header h1 { margin: 10px 0 2px; font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1.05; }
        .legal-english-title { margin: 0; font-size: 1.1rem; font-weight: 800; opacity: .9; }
        .legal-meta { margin-top: 20px; font-size: .84rem; opacity: .84; }
        .legal-note { max-width: 760px; margin: 18px 0 0; padding: 12px 14px; border: 1px solid rgba(255,255,255,.28); border-radius: 12px; font-size: .85rem; line-height: 1.5; }
        .legal-content { background: #fff; border: 1px solid #dbe8f1; border-radius: 22px; padding: 8px clamp(20px, 5vw, 60px); box-shadow: 0 12px 34px rgba(31, 71, 101, .07); }
        .legal-section { padding: 26px 0; border-bottom: 1px solid #e6eef4; }
        .legal-section:last-child { border-bottom: 0; }
        .legal-section h2 { margin: 0 0 8px; color: #124e7c; font-size: 1.25rem; }
        .legal-language-label { margin: 0 0 6px; color: #6d8292; font-size: .78rem; font-weight: 800; }
        .legal-section p:not(.legal-language-label) { margin: 8px 0 0; line-height: 1.7; color: #385369; }
        .legal-footer { text-align: center; color: #60798b; font-size: .88rem; line-height: 1.65; padding-top: 28px; }
        .legal-footer a { color: #17689b; }
        .legal-footer-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-top: 14px; font-weight: 800; }
        @media (max-width: 640px) { .legal-page { padding: 22px 12px 40px; } .legal-header, .legal-content { border-radius: 16px; } .legal-header { padding: 28px 22px; } }
      `}</style>
    </main>
  );
}
