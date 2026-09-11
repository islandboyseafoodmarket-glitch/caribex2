"use client";

import React, { useState } from 'react';
import Link from "next/link";
import { useTranslation } from "react-i18next";

import {
  DollarSign,
  Zap,
  Clock,
  Globe,
  CheckCircle,
  Box,
} from 'lucide-react';

const App = () => {
  const { i18n } = useTranslation();
  const isEn = i18n.language.startsWith("en");

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    origin: '',
    destination: '',
    cargoDescription: '',
    volume: '',
    weight: '',
    incoterms: '',
    additionalInfo: ''
  });

  const [attachment, setAttachment] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('access_key', 'a9902180-bd09-42e8-a283-4b4033c7ef5d');
      formDataToSend.append('subject', `LCL Quotation Request - ${formData.name}`);
      formDataToSend.append('from_name', formData.name);
      formDataToSend.append('reply_to', formData.email);
      
      const message = `
LCL Quotation Request Details:

Name: ${formData.name}
Email: ${formData.email}
Phone: ${formData.phone}
Company: ${formData.company}

Origin: ${formData.origin}
Destination: ${formData.destination}
Cargo Description: ${formData.cargoDescription}
Volume: ${formData.volume}
Weight: ${formData.weight}
Incoterms: ${formData.incoterms}

Additional Information:
${formData.additionalInfo}
      `.trim();
      
      formDataToSend.append('message', message);
      
      if (attachment) {
        formDataToSend.append('attachment', attachment);
      }

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formDataToSend,
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          origin: '',
          destination: '',
          cargoDescription: '',
          volume: '',
          weight: '',
          incoterms: '',
          additionalInfo: ''
        });
        setAttachment(null);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Estilos CSS como objetos de JavaScript
  const styles: { [key: string]: React.CSSProperties } = {

    container: {
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: 'sans-serif',
      color: '#0f172a',
      padding: '64px 16px'
    },
    header: {
      maxWidth: '896px',
      marginLeft: 'auto',
      marginRight: 'auto',
      textAlign: 'center',

      marginBottom: '48px'
    },
    h1: {
      fontSize: '2.5rem',
      fontWeight: '800',
      color: '#0a1e3b',
      marginBottom: '16px'
    },
    headerP: {
      fontSize: '1.25rem',
      color: '#475569',
      marginBottom: '32px',
      fontWeight: '500'
    },
    button: {
      backgroundColor: '#009688',
      color: 'white',
      fontWeight: 'bold',
      padding: '12px 32px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      transition: 'background-color 0.3s'
    },
    main: {
      maxWidth: '896px',
      marginLeft: 'auto',
      marginRight: 'auto'
    },
    card: {
      backgroundColor: 'white',
      borderRadius: '16px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      border: '1px solid #f1f5f9',
      padding: '32px',
      marginBottom: '64px'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '24px'
    },
    benefitCard: {
      backgroundColor: 'white',
      padding: '32px',
      borderRadius: '12px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      border: '1px solid #f1f5f9',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '20px'
    },
    processItem: {
      display: 'flex',
      alignItems: 'flex-start',
      position: 'relative',
      marginBottom: '48px'
    },
    numberCircle: {
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      backgroundColor: '#009688',
      color: 'white',
      borderRadius: '50%',
      fontWeight: 'bold',
      fontSize: '1.125rem',
      marginRight: '24px',
      flexShrink: 0
    },
    pricingBox: {
      backgroundColor: '#f0f9f8',
      borderRadius: '16px',
      border: '1px solid #b2dfdb',
      padding: '32px',
      position: 'relative',
      marginBottom: '80px'
    }
  };

  const benefits = isEn
    ? [
        {
          icon: <DollarSign size={32} color="#009688" />,
          title: "Pay only for the space you use",
          description:
            "No need to rent a full container: pay only for the space your cargo occupies.",
        },
        {
          icon: <Zap size={32} color="#009688" />,
          title: "Flexible shipping",
          description:
            "Ship smaller quantities without the cost burden of full-container rates.",
        },
        {
          icon: <Clock size={32} color="#009688" />,
          title: "Regular schedules",
          description:
            "Consolidated shipments depart on fixed schedules for predictable delivery.",
        },
        {
          icon: <Globe size={32} color="#009688" />,
          title: "Global access",
          description:
            "Access to consolidation services connecting major ports worldwide.",
        },
      ]
    : [
        {
          icon: <DollarSign size={32} color="#009688" />,
          title: "Pague solo por el espacio utilizado",
          description:
            "No es necesario alquilar un contenedor completo: pague solo por el espacio que ocupa su carga",
        },
        {
          icon: <Zap size={32} color="#009688" />,
          title: "Envío flexible",
          description:
            "Envíe cantidades más pequeñas sin la carga de costos de las tarifas de contenedor completo",
        },
        {
          icon: <Clock size={32} color="#009688" />,
          title: "Horarios regulares",
          description:
            "Los envíos consolidados parten según horarios fijos para una entrega predecible",
        },
        {
          icon: <Globe size={32} color="#009688" />,
          title: "Acceso mundial",
          description:
            "Acceso a servicios de consolidación que conectan los principales puertos a nivel mundial",
        },
      ];

  const selectionCriteria = isEn
    ? [
        {
          title: "Small to medium shipments",
          description:
            "Perfect for businesses that do not have enough cargo to fill a full container.",
        },
        {
          title: "Cost savings",
          description:
            "Share container space and costs with other shippers.",
        },
        {
          title: "Flexibility",
          description:
            "No minimum shipment requirements: send what you need, when you need it.",
        },
        {
          title: "Professional handling",
          description:
            "Your cargo is consolidated and handled carefully by experienced professionals.",
        },
      ]
    : [
        {
          title: "Envíos pequeños a medianos",
          description:
            "Perfecto para empresas que no tienen suficiente carga para llenar un contenedor.",
        },
        {
          title: "Ahorro de costes",
          description:
            "Comparta el espacio del contenedor y los costes con otros transportistas.",
        },
        {
          title: "Flexibilidad",
          description:
            "No hay requisitos mínimos de envío: envíe lo que necesita, cuando lo necesita.",
        },
        {
          title: "Manipulación profesional",
          description:
            "Su carga se consolida y manipula cuidadosamente por profesionales experimentados.",
        },
      ];

  const processSteps = isEn
    ? [
        {
          number: 1,
          title: "Booking",
          description:
            "Provide shipment details, including weight, dimensions and destination.",
        },
        {
          number: 2,
          title: "Consolidation",
          description:
            "Your cargo is consolidated with other shipments in our warehouse.",
        },
        {
          number: 3,
          title: "Documentation",
          description:
            "All customs and shipping documents are prepared and processed.",
        },
        {
          number: 4,
          title: "Departure",
          description:
            "Your consolidated shipment departs on the next scheduled voyage.",
        },
        {
          number: 5,
          title: "Delivery",
          description:
            "The cargo is deconsolidated and delivered to its final destination.",
        },
      ]
    : [
        {
          number: 1,
          title: "Reserva",
          description:
            "Proporcione los detalles del envío, incluyendo el peso, las dimensiones y el destino",
        },
        {
          number: 2,
          title: "Consolidación",
          description:
            "Su carga se consolida con otros envíos en nuestro almacén",
        },
        {
          number: 3,
          title: "Documentación",
          description:
            "Todos los documentos de aduanas y envío se preparan y procesan",
        },
        {
          number: 4,
          title: "Salida",
          description:
            "Su envío consolidado sale en el próximo viaje programado",
        },
        {
          number: 5,
          title: "Entrega",
          description:
            "La carga se desconsolida y se entrega a su destino",
        },
      ];

  const faqs = isEn
    ? [
        {
          q: "How much space do I need to book?",
          a: "You can book as little as 1 cubic meter. We will charge you only for the space your cargo occupies in the container.",
        },
        {
          q: "What is the minimum weight for LCL?",
          a: "There is no strict minimum weight, but we recommend at least 100–200 kg for an economical shipment.",
        },
        {
          q: "How long does LCL shipping take?",
          a: "Transit time depends on origin and destination, but usually ranges from 2 to 6 weeks including consolidation time.",
        },
        {
          q: "Can I track my LCL shipment?",
          a: "Yes! We provide tracking information from pickup to delivery, and you can access our tracking portal at any time.",
        },
        {
          q: "What types of cargo can be shipped via LCL?",
          a: "Most general cargo can be shipped via LCL. Hazardous materials and restricted items require special handling and documentation.",
        },
      ]
    : [
        {
          q: "¿Cuánto espacio necesito reservar?",
          a: "Puede reservar tan solo 1 metro cúbico. Le cobraremos solo por el espacio que ocupe su carga en el contenedor.",
        },
        {
          q: "¿Cuál es el peso mínimo para LCL?",
          a: "No hay un peso mínimo estricto. Sin embargo, recomendamos un mínimo de 100-200 kg para un envío económico.",
        },
        {
          q: "¿Cuánto tiempo tarda el envío LCL?",
          a: "El tiempo de tránsito depende del origen y el destino, pero normalmente varía entre 2 y 6 semanas, incluido el tiempo de consolidación.",
        },
        {
          q: "¿Puedo rastrear mi envío LCL?",
          a: "¡Sí! Ofrecemos información de seguimiento desde la recogida hasta la entrega, y puedes acceder a nuestro portal de seguimiento en cualquier momento.",
        },
        {
          q: "¿Qué tipos de carga se pueden enviar mediante LCL?",
          a: "La mayor parte de la carga general puede enviarse mediante LCL. Los materiales peligrosos y los artículos restringidos requieren un manejo y documentación especiales.",
        },
      ];

  return (
    <div className="page-section" style={{ ...styles.container, paddingTop: "120px" }}>
      <header style={styles.header}>
        <h1 style={styles.h1}>
          {isEn ? "Less than Container Load (LCL) services" : "Servicios de carga fraccionada (LCL)"}
        </h1>
        <p style={styles.headerP}>
          {isEn
            ? "Affordable and flexible shipping solutions for smaller loads."
            : "Soluciones de envío asequibles y flexibles para envíos más pequeños"}
        </p>
        <Link href="/registro-cliente" style={styles.button}>
          {isEn ? "Get started today" : "Empieza hoy mismo"}
        </Link>
      </header>

      <main style={styles.main}>
        {/* Info Section */}
        <div style={styles.card}>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#0a1e3b',
              marginBottom: '24px',
            }}
          >
            {isEn ? "What is LCL?" : "¿Qué es LCL?"}
          </h2>
          <div style={{ color: '#475569', lineHeight: '1.6', fontSize: '1.125rem' }}>
            <p style={{ marginBottom: '24px' }}>
              {isEn
                ? "Less than Container Load (LCL) shipping is a cost‑effective solution for businesses that do not have enough cargo to fill a full container."
                : "El envío de carga fraccionada (LCL) es una solución rentable para las empresas que no tienen suficiente carga para llenar un contenedor completo."}
            </p>
            <p style={{ marginBottom: '24px' }}>
              {isEn
                ? "With LCL, you only pay for the space your cargo occupies, making it an economical option for smaller shipments."
                : "Con LCL, solo paga por el espacio que ocupa su carga, lo que la convierte en una opción económica para envíos pequeños."}
            </p>
            <p>
              {isEn
                ? "LCL is ideal for small businesses, startups or anyone looking to ship goods internationally."
                : "LCL es ideal para pequeñas empresas, empresas emergentes o cualquier persona que busque enviar mercancías a nivel internacional."}
            </p>
          </div>
        </div>

        {/* Benefits Grid */}
        <section style={{ marginBottom: '80px' }}>
          <h2
            style={{
              fontSize: '1.875rem',
              fontWeight: '800',
              color: '#0a1e3b',
              textAlign: 'center',
              marginBottom: '40px',
            }}
          >
            {isEn
              ? "Why choose our LCL services?"
              : "¿Por qué elegir nuestros servicios LCL?"}
          </h2>

          <div style={styles.grid}>
            {benefits.map((b, i) => (
              <div key={i} style={styles.benefitCard}>
                <div style={{ flexShrink: 0 }}>{b.icon}</div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0a1e3b', marginBottom: '8px' }}>{b.title}</h3>
                  <p style={{ color: '#475569' }}>{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Selection Criteria */}
        <section style={{ marginBottom: '80px' }}>
          <h2
            style={{
              fontSize: '1.875rem',
              fontWeight: '800',
              color: '#0a1e3b',
              textAlign: 'center',
              marginBottom: '40px',
            }}
          >
            {isEn ? "When to choose LCL" : "Cuándo elegir LCL"}
          </h2>

          <div style={styles.grid}>
            {selectionCriteria.map((item, i) => (
              <div key={i} style={{ ...styles.benefitCard, border: '1px solid #e0f2f1', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0a1e3b', marginBottom: '12px' }}>{item.title}</h3>
                <p style={{ color: '#475569' }}>{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Process */}
        <section style={{ marginBottom: '80px' }}>
          <h2
            style={{
              fontSize: '1.875rem',
              fontWeight: '800',
              color: '#0a1e3b',
              textAlign: 'center',
              marginBottom: '48px',
            }}
          >
            {isEn ? "Our LCL process" : "Nuestro proceso LCL"}
          </h2>

          <div style={{ paddingLeft: '8px' }}>
            {processSteps.map((step, i) => (
              <div key={i} style={styles.processItem}>
                <div style={styles.numberCircle}>{step.number}</div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0a1e3b', marginBottom: '4px' }}>{step.title}</h3>
                  <p style={{ color: '#475569' }}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section style={styles.pricingBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Box size={24} color="#1e293b" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0a1e3b' }}>
              {isEn ? "LCL pricing" : "Precios LCL"}
            </h2>
          </div>
          <p style={{ color: '#334155', marginBottom: '24px', fontWeight: '500' }}>
            {isEn
              ? "LCL rates are calculated based on the greater of weight or volume:"
              : "Las tarifas LCL se calculan en función del mayor peso o volumen:"}
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0' }}>
            {(isEn
              ? [
                  "Weight: Charged per kilogram.",
                  "Volume: Charged per cubic meter.",
                  "Whichever is greater will determine the final charge.",
                ]
              : [
                  "Peso: Se cobra por kilogramo",
                  "Volumen: Se cobra por metro cúbico",
                  "El que sea mayor determinará la carga final.",
                ]).map((text, i) => (

              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  color: '#334155',
                }}
              >
                <CheckCircle size={20} color="#4caf50" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FORMULARIO DE COTIZACIÓN LCL */}
        <section id="lcl-quote-form" style={{ ...styles.card, marginBottom: '80px' }}>
          <h2
            style={{
              fontSize: '1.875rem',
              fontWeight: '800',
              color: '#0a1e3b',
              marginBottom: '24px',
            }}
          >
            {isEn ? "LCL quote request" : "Solicitud de cotización LCL"}
          </h2>
          <p style={{ color: '#475569', marginBottom: '24px' }}>
            {isEn
              ? "Fill out the form below and our team will send you a quote based on the specific details of your LCL shipment."
              : "Completa el siguiente formulario y nuestro equipo te enviará una cotización basada en los detalles específicos de tu carga fraccionada."}
          </p>

          <form
            method="POST"
            action="https://api.web3forms.com/submit"
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
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
                  ? "New LCL quote request from website"
                  : "Nueva cotización LCL desde el sitio web"
              }
            />

            <input type="hidden" name="service_type" value="LCL" />

            <div style={styles.grid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? "Full name *" : "Nombre completo *"}
                </label>

                <input
                  type="text"
                  name="full_name"
                  required
                  placeholder={isEn ? "John Smith" : "Juan Pérez"}

                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? "Email *" : "Correo electrónico *"}
                </label>

                <input
                  type="email"
                  name="email"
                  required
                  placeholder={isEn ? "john@example.com" : "juan@ejemplo.com"}

                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
            </div>

            <div style={styles.grid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? "Phone *" : "Teléfono *"}
                </label>

                <input
                  type="text"
                  name="phone"
                  required
                  placeholder={isEn ? "+504 89467476" : "+504 89467476"}

                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? "Company" : "Compañía"}
                </label>

                <input
                  type="text"
                  name="company"
                  placeholder={isEn ? "Your company name" : "Nombre de tu empresa"}

                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
            </div>

            <div style={styles.grid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? "Origin port *" : "Puerto de origen *"}
                </label>

                <input
                  type="text"
                  name="origin_port"
                  required
                  placeholder={isEn ? "Origin port" : "Puerto de origen"}

                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? "Destination port *" : "Puerto de destino *"}
                </label>

                <input
                  type="text"
                  name="destination_port"
                  required
                  placeholder={isEn ? "Destination port" : "Puerto de destino"}

                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
            </div>

            <div style={styles.grid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? "Approximate total weight (kg) *" : "Peso total aproximado (kg) *"}
                </label>

                <input
                  type="number"
                  name="weight_kg"
                  required
                  placeholder={isEn ? "1000" : "1000"}

                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? "Cargo type" : "Tipo de carga"}
                </label>

                <input
                  type="text"
                  name="cargo_type"
                  placeholder={
                    isEn
                      ? "General cargo, refrigerated, etc."
                      : "Mercancía general, refrigerada, etc."
                  }

                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                {isEn ? "Additional notes" : "Notas adicionales"}
              </label>

              <textarea
                name="additional_notes"
                placeholder={
                  isEn
                    ? "Any special requirements or additional information..."
                    : "Cualquier requerimiento especial o información adicional..."
                }

                style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 120, resize: 'vertical' }}
              ></textarea>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>
                {isEn ? "Invoice/Document (Optional)" : "Factura/Documento (Opcional)"}
              </label>
              <div style={{
                position: 'relative',
                display: 'inline-block',
                width: '100%'
              }}>
                <div style={{
                  padding: '12px 45px 12px 12px',
                  borderRadius: 8,
                  border: '2px dashed #cbd5e1',
                  width: '100%',
                  cursor: 'pointer',
                  backgroundColor: '#f8fafc',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onClick={() => document.getElementById('lcl-file-input')?.click()}
                >
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    {isEn ? '📎 Click to upload invoice or document' : '📎 Haz clic para subir factura o documento'}
                  </span>
                  <input
                    id="lcl-file-input"
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer'
                    }}
                  />
                </div>
                <div style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#64748b',
                  fontSize: '20px'
                }}>
                  📎
                </div>
              </div>
              {attachment && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
                  <span style={{ fontSize: '0.875rem', color: '#047857', fontWeight: '500' }}>
                    {isEn ? 'File selected:' : 'Archivo seleccionado:'} {attachment.name}
                  </span>
                </div>
              )}
              {!attachment && (
                <p style={{ 
                  fontSize: '0.75rem', 
                  color: '#64748b', 
                  marginTop: '4px',
                  fontStyle: 'italic'
                }}>
                  {isEn ? 'Accepted formats: PDF, JPG, PNG (Max 5MB)' : 'Formatos aceptados: PDF, JPG, PNG (Máx 5MB)'}
                </p>
              )}
            </div>

            <button
              type="submit"
              style={{
                marginTop: '8px',
                padding: '14px 20px',
                borderRadius: 999,
                border: 'none',
                backgroundColor: '#009688',
                color: '#fff',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              {isEn ? "Request LCL quote" : "Solicitar cotización LCL"}
            </button>
          </form>
        </section>

        {/* FAQs */}
        <section style={{ marginBottom: '80px' }}>
          <h2
            style={{
              fontSize: '1.875rem',
              fontWeight: '800',
              color: '#0a1e3b',
              textAlign: 'center',
              marginBottom: '40px',
            }}
          >
            {isEn ? "Frequently asked questions" : "Preguntas frecuentes"}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                style={{ ...styles.benefitCard, flexDirection: 'column', gap: '12px' }}
              >
                <h3
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 'bold',
                    color: '#0a1e3b',
                  }}
                >
                  {faq.q}
                </h3>
                <p style={{ color: '#475569', lineHeight: '1.6' }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
};

export default App;