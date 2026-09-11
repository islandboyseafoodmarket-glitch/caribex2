"use client";
import React, { useState, useRef } from 'react';
import { useRouter } from "next/navigation";

import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabaseClient";

/**
 * App Component
 * Registro con formulario estilizado y Modal de Acuerdo íntegro.
 * Se ha corregido el tamaño del checkbox para que sea proporcional.
 */
export default function App() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEn = i18n.language.startsWith("en");
  const [showModal, setShowModal] = useState(false);
  // Ya no usamos el modal ni la tarjeta de n\u00famero de cliente; ahora se env\u00eda por correo.
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    puerto: '',
    aceptaTerminos: false,
    tipoCuenta: 'Personal'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const { name, value } = target;
    const isCheckbox = (target as HTMLInputElement).type === 'checkbox';
    const checked = isCheckbox ? (target as HTMLInputElement).checked : undefined;

    setFormData(prev => ({
      ...prev,
      [name]: isCheckbox ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.aceptaTerminos) {
      alert(
        isEn
          ? "Please accept the Service Agreement."
          : "Por favor, acepta el Acuerdo de Servicio."
      );
      return;
    }

    // 0) Verificar que no exista un cliente con ese email
    const { data: existingClient, error: existingError } = await supabase
      .from("numero_cliente")
      .select("id")
      .eq("email", formData.email)
      .maybeSingle();

    if (existingError) {
      alert(
        (isEn ? "Error validating email: " : "Error validando el email: ") +
          existingError.message
      );
      return;
    }

    if (existingClient) {
      setDuplicateEmail(formData.email);
      setShowDuplicateModal(true);
      return;
    }

    // 1) Obtener el último numero_cliente para continuar la secuencia

    const { data: maxRow, error: maxError } = await supabase
      .from("numero_cliente")
      .select("numero_cliente")
      .order("numero_cliente", { ascending: false })
      .limit(1)
      .maybeSingle();

    let siguienteNumero = 300;
    if (!maxError && maxRow?.numero_cliente != null) {
      const ultimo = Number(maxRow.numero_cliente) || 0;
      siguienteNumero = ultimo >= 300 ? ultimo + 1 : 300;
    }

    // 2) Prefijo con la primera letra del puerto seleccionado

    const primeraLetraPuerto = (formData.puerto?.[0] || "").toUpperCase() || "X";

    // 3) Insertar registro con numero_cliente explícito

    const { error: insertError } = await supabase
      .from("numero_cliente")
      .insert({
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        puerto: formData.puerto,
        tipo_cuenta: formData.tipoCuenta,
        numero_cliente: siguienteNumero,
      });

    if (insertError) {
      alert(
        (isEn
          ? "Error while registering client: "
          : "Error al registrar cliente: ") + insertError.message
      );
      return;
    }

    const numeroDisplay = `${primeraLetraPuerto}-${siguienteNumero}`;

    // Enviar correo al cliente con su n\u00famero de cliente
    try {
      const resp = await fetch("/api/send-client-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: formData.email,
          name: formData.nombre,
          clientNumberDisplay: numeroDisplay,
        }),
      });

      if (!resp.ok) {
        console.error("Failed to send client number email", await resp.text());
      }
    } catch (err) {
      console.error("Error calling /api/send-client-number", err);
    }

    alert(
      isEn
        ? "Your client number has been sent to your email."
        : "Tu n\u00famero de cliente ha sido enviado a tu correo electr\u00f3nico.",
    );

    setFormData({
      nombre: "",
      email: "",
      telefono: "",
      puerto: "",
      aceptaTerminos: false,
      tipoCuenta: "Personal",
    });
  };

  const toggleModal = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowModal(!showModal);
  };

  const handleBack = () => {
    router.push("/");
  };

  return (
    <div className="container">
      <div className="registration-card">

        <header className="header">
          <h1 className="main-title">
            {isEn ? "Registration" : "Registro"}
          </h1>
        </header>

        <main className="content">
          <section className="section-intro">
            <h2>{isEn ? "Quick registration" : "Registro rápido"}</h2>
            <p>
              {isEn
                ? "Only 5 fields to get started"
                : "Solo 5 campos para empezar"}
            </p>
          </section>

          <form onSubmit={handleSubmit} className="registration-form grid-form">
            <div className="form-group full-width">
              <label>{isEn ? "FULL NAME *" : "NOMBRE COMPLETO *"}</label>
              <input
                type="text"
                name="nombre"
                placeholder={isEn ? "John Doe" : "John Doe"}
                value={formData.nombre}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>
                {isEn
                  ? "EMAIL ADDRESS *"
                  : "DIRECCIÓN DE CORREO ELECTRÓNICO *"}
              </label>
              <input
                type="email"
                name="email"
                placeholder={isEn ? "john@example.com" : "john@example.com"}
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>{isEn ? "PHONE NUMBER *" : "NÚMERO DE TELÉFONO *"}</label>
              <input
                type="tel"
                name="telefono"
                placeholder={isEn ? "(555) 123-4567" : "(555) 123-4567"}
                value={formData.telefono}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>
                {isEn
                  ? "PORT/SHIPPING LOCATION *"
                  : "PUERTO/UBICACIÓN DE ENVÍO *"}
              </label>
              <select name="puerto" value={formData.puerto} onChange={handleChange} required>
                <option value="">
                  {isEn ? "Select your port" : "Seleccione su puerto"}
                </option>
                <option value="roatan">Roatán</option>
                <option value="utila">Utila</option>
                <option value="guanaja">Guanaja</option>
                <option value="la-ceiba">La Ceiba</option>
                <option value="tegucigalpa">Tegucigalpa</option>
                <option value="san-pedro-sula">San Pedro Sula</option>
                <option value="puerto-lempira">Puerto Lempira</option>
              </select>
            </div>

            <div className="terms-container full-width">
              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  name="aceptaTerminos"
                  checked={formData.aceptaTerminos}
                  onChange={handleChange}
                />
              </div>
              <label htmlFor="terms" className="terms-label">
                <strong>
                  {isEn
                    ? "I accept the Parcel Service Agreement *"
                    : "Acepto el Acuerdo de Servicio de Paquetería *"}
                </strong>
                <p>
                  {isEn
                    ? "By registering, you accept our terms and conditions for the handling, storage and delivery of packages."
                    : "Al registrarse, usted acepta nuestros términos y condiciones para el manejo, almacenamiento y servicios de entrega de paquetes."}
                  <button onClick={toggleModal} className="link-btn">
                    {isEn ? "View full agreement" : "Ver el acuerdo completo"}
                  </button>
                </p>
              </label>
            </div>

            <div className="form-group">
              <label>{isEn ? "Account type *" : "Tipo de cuenta *"}</label>
              <select name="tipoCuenta" value={formData.tipoCuenta} onChange={handleChange}>
                <option value="Personal">{isEn ? "Personal" : "Personal"}</option>
                <option value="Negocio">{isEn ? "Business" : "Negocio"}</option>
              </select>
            </div>

            <div className="form-actions full-width">
              <button type="submit" className="submit-btn">
                {isEn
                  ? "Get my client number"
                  : "Obtener mi número de cliente"}
              </button>
              <button type="button" className="back-button" onClick={handleBack}>
                {isEn ? "← Back to home" : "← Volver al inicio"}
              </button>
            </div>
          </form>

          <section className="section-footer">
          </section>
        </main>
      </div>

      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <header className="modal-header">
              <h2>{isEn ? "Service Agreement" : "Acuerdo de Servicio"}</h2>
            </header>
            <section className="modal-body">
              <div
                style={{
                  maxHeight: "60vh",
                  overflowY: "auto",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                  whiteSpace: "pre-line",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  textAlign: "left",
                }}
              >
                {!isEn ? `Términos de Servicio

Caribex Logistics Group
Fecha de vigencia: 21 de febrero de 2026
Última actualización: 21 de febrero de 2026

1. Introducción y Aceptación de Términos
Bienvenido a Caribex Logistics Group ("Compañía", "nosotros", "nuestro" o "nuestra"). Estos Términos de Servicio ("Términos") rigen el uso de nuestro sitio web, servicios y todas las plataformas relacionadas. Al acceder a nuestro sitio web, crear una cuenta o utilizar nuestros servicios de transitario y logística, usted acepta quedar sujeto a estos Términos. Si no está de acuerdo con alguna parte de estos Términos, no podrá utilizar nuestros servicios.
Estos Términos se aplican a todos los clientes, incluyendo individuos, empresas y organizaciones que contratan nuestros servicios para transitario, almacenamiento u operaciones logísticas relacionadas en nuestras ubicaciones de servicio en Honduras.

2. Servicios Proporcionados
Caribex Logistics Group proporciona servicios integrales de transitario y logística, incluyendo Servicios de Contenedor Completo (FCL), Servicios de Carga Parcial (LCL), Almacenamiento y Depósito, Transitario y Servicios Adicionales como seguro de carga y manejo especializado. Todos los servicios están sujetos a disponibilidad y capacidad operativa actual. Nos reservamos el derecho de modificar la oferta de servicios con aviso razonable a los clientes.

3. Registro de Cuenta y Responsabilidad
Para utilizar ciertas características de nuestros servicios, es posible que se le requiera crear una cuenta. Al registrarse, usted acepta proporcionar información precisa, completa y actual. Usted es responsable de mantener la confidencialidad de sus credenciales de cuenta y de todas las actividades que ocurran bajo su cuenta. Usted acepta notificarnos inmediatamente cualquier acceso no autorizado a su cuenta o cualquier otra violación de seguridad. Su cuenta es personal e intransferible.

4. Precios y Términos de Pago
Todos los precios de nuestros servicios se proporcionan en Dólares Estadounidenses (USD) y están sujetos al tarifario vigente. Los clientes comerciales deben pagar por adelantado antes del procesamiento del envío. Las facturas no pagadas a la fecha de vencimiento incurrirán en una tarifa de pago tardío del 1.5% por mes (18% anual) o la tasa máxima permitida por la ley de Honduras, la que sea menor. Usted es responsable de pagar todos los impuestos aplicables, derechos de importación, tarifas aduaneras y otros cargos gubernamentales.

5. Seguro de Carga y Responsabilidad
El seguro de carga es opcional y disponible por una tarifa adicional. La responsabilidad de Caribex Logistics Group por pérdida, daño o retraso de la carga se limita al menor del valor real de la carga o el monto pagado por los servicios de envío. No somos responsables por pérdida o daño causado por actos de Dios, guerra, terrorismo, disturbios civiles, huelgas, acción gubernamental, desastres naturales u otras circunstancias fuera de nuestro control razonable. Cualquier reclamo por pérdida o daño debe presentarse por escrito dentro de los 30 días posteriores a la entrega.

6. Aduanas, Documentación y Cumplimiento
Usted es responsable de asegurar que su carga cumpla con todas las leyes y regulaciones aplicables. Debe proporcionar documentación precisa y completa para toda la carga. Los derechos aduaneros, impuestos y tarifas son su responsabilidad. No puede enviar artículos prohibidos por ley, incluyendo armas, explosivos, narcóticos, bienes falsificados o especies en peligro. Los materiales peligrosos deben estar clasificados, embalados, etiquetados y documentados correctamente según las regulaciones internacionales de envío.

7. Condiciones y Limitaciones del Servicio
Nuestros servicios están sujetos a disponibilidad y capacidad operativa actual. No garantizamos fechas específicas de salida o llegada, aunque haremos esfuerzos razonables para cumplir con los plazos estimados. Pueden ocurrir retrasos debido al clima, congestión portuaria, procedimientos aduaneros u otras circunstancias fuera de nuestro control. Operamos a través de siete puertos de Honduras: Roatán, La Ceiba, Trujillo, San Pedro Sula, Tegucigalpa, Guanaja y Utila. La carga almacenada en nuestras instalaciones está sujeta a tarifas de almacenamiento diarias después de los primeros 5 días de almacenamiento gratuito.

8. Derechos de Propiedad Intelectual
Todo el contenido en nuestro sitio web, incluyendo texto, gráficos, logotipos, imágenes y software, es propiedad de Caribex Logistics Group o sus licenciantes y está protegido por derechos de autor y otras leyes de propiedad intelectual. No puede reproducir, distribuir o transmitir ningún contenido sin nuestro permiso por escrito previo.

9. Conducta del Usuario y Actividades Prohibidas
Usted acepta no utilizar nuestros servicios o sitio web para ningún propósito ilegal o de cualquier manera que viole estos Términos. Las actividades prohibidas incluyen enviar carga que viole la ley aplicable, proporcionar información falsa, intentar acceso no autorizado, interferir con los servicios, cometer fraude o acosar a nuestro personal. La violación de estas disposiciones puede resultar en la suspensión o terminación inmediata de su cuenta y servicios, sin reembolso de ninguna tarifa prepaga.

10. Limitación de Responsabilidad
En la medida máxima permitida por la ley, Caribex Logistics Group no será responsable por ningún daño indirecto, incidental, especial, consecuente o punitivo. Nuestra responsabilidad total por cualquier reclamo no excederá el monto total que usted pagó por los servicios en cuestión durante los 12 meses anteriores al reclamo.

11. Indemnización
Usted acepta indemnizar, defender y mantener indemne a Caribex Logistics Group de cualquier reclamo, daños, pérdidas o gastos que surjan de su uso de nuestros servicios, su violación de estos Términos o cualquier carga enviada a través de nuestros servicios.

12. Resolución de Disputas y Ley Aplicable
Estos Términos regirán e interpretarán de acuerdo con las leyes de Honduras. Antes de iniciar procedimientos legales formales, usted acepta intentar resolver cualquier disputa informalmente contactándonos en admin@caribexlogistics.com. Si la resolución informal falla, cualquier disputa se resolverá mediante arbitraje vinculante de acuerdo con las reglas de la American Arbitration Association (AAA).

13. Terminación de Servicios
Nos reservamos el derecho de terminar o suspender su cuenta y servicios en cualquier momento, con o sin causa, previo aviso por escrito. Tras la terminación, usted sigue siendo responsable de todos los cargos y tarifas pendientes.

14. Modificaciones a los Términos
Nos reservamos el derecho de modificar estos Términos en cualquier momento. Los cambios serán efectivos al publicarse en nuestro sitio web. El uso continuado de nuestros servicios después de las modificaciones constituye aceptación de los Términos actualizados.

15. Información de Contacto
Para preguntas sobre estos Términos de Servicio o para reportar violaciones, contáctenos en admin@caribexlogistics.com o llame al +504 89467476. Horario comercial: Lunes - Viernes, 8:00 AM - 6:00 PM (Hora de Honduras).` : `Terms of Service

Caribex Logistics Group
Effective Date: February 21, 2026
Last Updated: February 21, 2026

1. Introduction and Acceptance of Terms
Welcome to Caribex Logistics Group ("Company," "we," "us," or "our"). These Terms of Service ("Terms") govern your use of our website, services, and all related platforms. By accessing our website, creating an account, or using our freight forwarding and logistics services, you agree to be bound by these Terms. If you do not agree with any part of these Terms, you may not use our services.
These Terms apply to all customers, including individuals, businesses, and organizations that engage our services for freight forwarding, warehousing, or related logistics operations across our service locations in Honduras.

2. Services Provided
Caribex Logistics Group provides comprehensive freight forwarding and logistics services, including Full Container Load (FCL) Services, Less than Container Load (LCL) Services, Warehousing and Storage, Freight Forwarding, and Additional Services such as cargo insurance and specialized handling. All services are subject to availability and current operational capacity. We reserve the right to modify service offerings with reasonable notice to customers.

3. Account Registration and Responsibility
To use certain features of our services, you may be required to create an account. When registering, you agree to provide accurate, complete, and current information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized access to your account or any other breach of security. Your account is personal and non-transferable.

4. Pricing and Payment Terms
All pricing for our services is provided in United States Dollars (USD) and is subject to the current rate schedule. Business customers are required to pay upfront before shipment processing. Invoices not paid by the due date will incur a late payment fee of 1.5% per month (18% annually) or the maximum rate permitted by Honduras law, whichever is lower. You are responsible for paying all applicable taxes, import duties, customs fees, and other governmental charges.

5. Cargo Insurance and Liability
Cargo insurance is optional and available for an additional fee. Caribex Logistics Group's liability for loss, damage, or delay to cargo is limited to the lesser of the actual value of the cargo or the amount paid for shipping services. We are not liable for loss or damage caused by acts of God, war, terrorism, civil unrest, strikes, government action, natural disasters, or other circumstances beyond our reasonable control. Any claims for loss or damage must be filed in writing within 30 days of delivery.

6. Customs, Documentation, and Compliance
You are responsible for ensuring that your cargo complies with all applicable laws and regulations. You must provide accurate and complete documentation for all cargo. Customs duties, taxes, and fees are your responsibility. You may not ship items that are prohibited by law, including weapons, explosives, narcotics, counterfeit goods, or endangered species. Hazardous materials must be properly classified, packaged, labeled, and documented according to international shipping regulations.

7. Service Conditions and Limitations
Our services are subject to availability and current operational capacity. We do not guarantee specific departure or arrival dates, though we will make reasonable efforts to meet estimated timelines. Delays may occur due to weather, port congestion, customs procedures, or other circumstances beyond our control. We operate through seven Honduras ports: Roatán, La Ceiba, Trujillo, San Pedro Sula, Tegucigalpa, Guanaja, and Utila. Cargo stored at our facilities is subject to daily storage fees after the first 5 days of free storage.

8. Intellectual Property Rights
All content on our website, including text, graphics, logos, images, and software, is the property of Caribex Logistics Group or our licensors and is protected by copyright and other intellectual property laws. You may not reproduce, distribute, or transmit any content without our prior written permission.

9. User Conduct and Prohibited Activities
You agree not to use our services or website for any unlawful purpose or in any way that violates these Terms. Prohibited activities include shipping cargo that violates applicable law, providing false information, attempting unauthorized access, interfering with services, engaging in fraud, or harassing our staff. Violation of these provisions may result in immediate suspension or termination of your account and services, without refund of any prepaid fees.

10. Limitation of Liability
To the maximum extent permitted by law, Caribex Logistics Group shall not be liable for any indirect, incidental, special, consequential, or punitive damages. Our total liability for any claim shall not exceed the total amount you paid for the services in question during the 12 months preceding the claim.

11. Indemnification
You agree to indemnify, defend, and hold harmless Caribex Logistics Group from any claims, damages, losses, or expenses arising from your use of our services, your violation of these Terms, or any cargo shipped through our services.

12. Dispute Resolution and Governing Law
These Terms shall be governed by and construed in accordance with the laws of Honduras. Before initiating formal legal proceedings, you agree to attempt to resolve any dispute informally by contacting us at admin@caribexlogistics.com. If informal resolution fails, any dispute shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association (AAA).

13. Termination of Services
We reserve the right to terminate or suspend your account and services at any time, with or without cause, upon written notice. Upon termination, you remain responsible for all outstanding charges and fees.

14. Modifications to Terms
We reserve the right to modify these Terms at any time. Changes will be effective upon posting to our website. Your continued use of our services after modifications constitutes acceptance of the updated Terms.

15. Contact Information
For questions about these Terms of Service or to report violations, please contact us at admin@caribexlogistics.com or call +504 89467476. Business hours are Monday - Friday, 8:00 AM - 6:00 PM (Honduras Time).`}
              </div>
            </section>
            <footer
              className="modal-footer"
              style={{
                padding: "12px 20px 16px",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className="primary-button"
                style={{
                  padding: "8px 20px",
                  borderRadius: "999px",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                onClick={toggleModal}
              >
                {isEn ? "Close" : "Cerrar"}
              </button>
            </footer>
          </div>
        </div>
      )}
      <style suppressHydrationWarning>{`
        :root {
          --primary-blue: #2563eb;
          --bg-light: #f3f6f9;
          --border-color: #e2e8f0;
          --text-dark: #1e293b;
          --text-muted: #64748b;
          --accent-yellow: #fffdf0;
          --accent-yellow-border: #fef3c7;
          --indigo-btn: #7c83fd;
        }

        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: var(--bg-light); color: var(--text-dark); }
        .container { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; padding: 24px 24px 32px; }
        .registration-card { background: white; width: 100%; max-width: 760px; border-radius: 12px; border: 2px solid #003366; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { padding: 40px 20px 20px; text-align: center; border-bottom: 1px solid #f1f5f9; }
        .main-title { margin: 0; font-size: 28px; font-weight: 800; }
        .sub-title { color: var(--text-muted); font-size: 16px; margin: 5px 0 0; }

        .content { padding: 24px 32px 8px; }

        .registration-form {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px 20px;
        }

        .registration-form .full-width {
          grid-column: 1 / -1;
        }

        .form-group { margin-bottom: 0; }
        .form-group label { display: block; font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 8px; letter-spacing: 0.05em; }
        
        input, select { width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; box-sizing: border-box; }
        .input-with-button { display: flex; gap: 10px; }
        .inline-btn { background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 0 20px; color: var(--text-muted); cursor: pointer; font-size: 13px; }

        .terms-container {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .checkbox-wrapper {
          margin-top: 4px;
        }

        .terms-label p { margin: 4px 0 0; font-size: 12px; color: #64748b; }

        .link-btn { background: none; border: none; color: var(--primary-blue); font-weight: bold; cursor: pointer; padding: 0; text-decoration: underline; font-size: 13px; display: inline-block; margin-top: 4px; }
        
        .form-actions { margin-top: 0; margin-bottom: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
        .submit-btn { width: 100%; background: var(--indigo-btn); color: white; border: none; padding: 12px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }

        .back-button {
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          color: var(--primary-blue);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .back-button:hover {
          background: #e0e7ff;
        }

        .footer-links { text-align: center; margin-top: 25px; font-size: 14px; color: var(--text-muted); }
        .link { color: var(--primary-blue); text-decoration: none; font-weight: 500; }

        /* MODAL STYLES */
        .modal-overlay {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          background: rgba(15, 23, 42, 0.65);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 20px;
        }

        .duplicate-modal {
          background: #ffffff;
          border-radius: 14px;
          padding: 30px;
          max-width: 420px;
          width: 100%;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18);
        }

        .duplicate-modal h3 {
          margin: 0;
          font-size: 1.4rem;
          color: #111827;
        }

        .duplicate-modal p {
          margin: 0;
          color: #475569;
          font-size: 0.95rem;
        }

        .modal-content {
          background: #ffffff;
          border-radius: 14px;
          box-shadow: 0 22px 45px rgba(15, 23, 42, 0.35);
          max-width: 960px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .modal-header {
          padding: 16px 24px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .modal-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .doc-icon {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: #eff6ff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 1rem;
        }

        .version {
          margin: 2px 0 0;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .close-x {
          background: transparent;
          border: none;
          font-size: 1.4rem;
          cursor: pointer;
          color: #9ca3af;
        }

        .modal-body {
          padding: 14px 0 16px;
          overflow-y: auto;
        }

        .download-bar {
          padding: 0 24px 8px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: flex-end;
        }

        .download-btn {
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          padding: 6px 14px;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .agreement-text {
          padding: 18px 24px 24px;
          font-size: 0.85rem;
          line-height: 1.6;
          color: #111827;
        }

        .center-text {
          text-align: center;
          margin-bottom: 16px;
        }

        /* Modal número de cliente: tarjeta como la imagen de referencia */
        .numero-modal-wrapper {
          background: #edf2f7;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 18px 40px rgba(15,23,42,0.35);
          max-width: 640px;
          width: 100%;
        }

        .numero-card-preview {
          background: transparent;
          padding: 12px;
        }

        .numero-card {
          background: #ffffff;
          border-radius: 24px;
          border: 3px solid #020617;
          padding: 40px 56px 36px;
        }

        .numero-card-title {
          margin: 0 0 28px;
          font-size: 26px;
          font-weight: 800;
          color: #020617;
        }

        .numero-card-subtitle {
          margin: 0 0 10px;
          font-size: 15px;
          color: #1f2937;
        }

        .numero-card-value {
          margin: 0 0 32px;
          font-size: 40px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #2563eb;
        }

        .numero-card-footnote {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
        }

        .numero-modal-actions {
          margin-top: 18px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .primary-btn,
        .secondary-btn {
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .primary-btn {
          background: #4f46e5;
          color: #ffffff;
          border-color: #4f46e5;
        }

        .primary-btn:hover {
          background: #4338ca;
          border-color: #4338ca;
        }

        .secondary-btn {
          background: #ffffff;
          color: #64748b;
          border-color: #e2e8f0;
        }

        .secondary-btn:hover {
          background: #f8fafc;
        }

        .questions-section { margin-top: 30px; padding: 15px; background: #f8fafc; border-radius: 6px; }
        .agreement-footer-line { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 13px; color: #475569; }
        .company-name-footer { margin-top: 5px; color: #94a3b8; }
        
        @media (min-width: 768px) {
          .registration-form {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .modal-content { width: 100%; height: 100%; border-radius: 0; }
          .agreement-text { padding: 20px; margin: 10px; }
          .numero-card { padding: 28px 24px 26px; }
          .numero-card-title { font-size: 22px; }
          .numero-card-value { font-size: 32px; }
        }
      `}</style>
    </div>
  );
}