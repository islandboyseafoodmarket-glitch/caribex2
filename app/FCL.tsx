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
  Package,
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
    containerType: '',
    cargoDescription: '',
    weight: '',
    volume: '',
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
      formDataToSend.append('subject', `FCL Quotation Request - ${formData.name}`);
      formDataToSend.append('from_name', formData.name);
      formDataToSend.append('reply_to', formData.email);
      
      const message = `
FCL Quotation Request Details:

Name: ${formData.name}
Email: ${formData.email}
Phone: ${formData.phone}
Company: ${formData.company}

Origin: ${formData.origin}
Destination: ${formData.destination}
Container Type: ${formData.containerType}
Cargo Description: ${formData.cargoDescription}
Weight: ${formData.weight}
Volume: ${formData.volume}
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
          containerType: '',
          cargoDescription: '',
          weight: '',
          volume: '',
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
    content: {
      maxWidth: '896px',
      marginLeft: 'auto',
      marginRight: 'auto',
      display: 'block'
    },
    section: {
      marginBottom: '32px'
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: '700',
      color: '#0a1e3b',
      marginBottom: '16px'
    },
    featureList: {
      listStyle: 'none',
      padding: 0,
      margin: 0
    },
    featureItem: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '12px',
      fontSize: '1rem'
    },
    icon: {
      marginRight: '12px',
      color: '#0ea5e9'
    },
    formContainer: {
      backgroundColor: 'white',
      padding: '32px',
      borderRadius: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    },
    grid: {
      display: 'grid',
      // 2 columnas en desktop; al bajar del ancho minimo se convierte en 1
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: '24px'
    },
    formGroup: {
      marginBottom: '20px'
    },
    formGroupInline: {
      marginBottom: '0px'
    },
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '6px'
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '1rem',
      boxSizing: 'border-box'
    },
    textarea: {
      width: '100%',
      padding: '10px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '1rem',
      minHeight: '100px',
      boxSizing: 'border-box',
      resize: 'vertical'
    },
    button: {
      width: '100%',
      padding: '12px 24px',
      backgroundColor: '#0ea5e9',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    },
    buttonHover: {
      backgroundColor: '#0284c7'
    },
    successMessage: {
      padding: '12px',
      backgroundColor: '#10b981',
      color: 'white',
      borderRadius: '6px',
      marginBottom: '16px',
      textAlign: 'center'
    },
    errorMessage: {
      padding: '12px',
      backgroundColor: '#ef4444',
      color: 'white',
      borderRadius: '6px',
      marginBottom: '16px',
      textAlign: 'center'
    },
    backLink: {
      display: 'inline-flex',
      alignItems: 'center',
      color: '#0ea5e9',
      textDecoration: 'none',
      fontWeight: '500',
      marginBottom: '32px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Link href="/" style={styles.backLink}>
          ← {isEn ? 'Back to Home' : 'Volver al Inicio'}
        </Link>
        <h1 style={styles.h1}>
          {isEn ? 'Full Container Load (FCL)' : 'Contenedor Completo (FCL)'}
        </h1>
        <p style={styles.headerP}>
          {isEn 
            ? 'Optimize your logistics with exclusive container space for maximum efficiency and security.'
            : 'Optimiza tu logística con espacio exclusivo de contenedor para máxima eficiencia y seguridad.'
          }
        </p>
      </div>

      <div style={styles.content}>
        <div>
          <div style={styles.section}>
            <h2 style={styles.h2}>
              {isEn ? 'Why Choose FCL?' : '¿Por qué elegir FCL?'}
            </h2>
            <ul style={styles.featureList}>
              <li style={styles.featureItem}>
                <Package style={styles.icon} size={20} />
                {isEn ? 'Exclusive container use' : 'Uso exclusivo del contenedor'}
              </li>
              <li style={styles.featureItem}>
                <DollarSign style={styles.icon} size={20} />
                {isEn ? 'Cost-effective for large volumes' : 'Rentable para grandes volúmenes'}
              </li>
              <li style={styles.featureItem}>
                <Zap style={styles.icon} size={20} />
                {isEn ? 'Faster transit times' : 'Tiempos de tránsito más rápidos'}
              </li>
              <li style={styles.featureItem}>
                <CheckCircle style={styles.icon} size={20} />
                {isEn ? 'Reduced risk of damage' : 'Riesgo reducido de daños'}
              </li>
              <li style={styles.featureItem}>
                <Clock style={styles.icon} size={20} />
                {isEn ? 'Flexible scheduling' : 'Programación flexible'}
              </li>
              <li style={styles.featureItem}>
                <Globe style={styles.icon} size={20} />
                {isEn ? 'Global network coverage' : 'Cobertura de red global'}
              </li>
            </ul>
          </div>
        </div>

        <div style={styles.formContainer}>
          <h2 style={styles.h2}>
            {isEn ? 'Request FCL Quote' : 'Solicitar Cotización FCL'}
          </h2>
          
          {submitStatus === 'success' && (
            <div style={styles.successMessage}>
              {isEn ? 'Quote request sent successfully!' : '¡Solicitud de cotización enviada exitosamente!'}
            </div>
          )}
          
          {submitStatus === 'error' && (
            <div style={styles.errorMessage}>
              {isEn ? 'Error sending request. Please try again.' : 'Error al enviar. Inténtalo de nuevo.'}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={styles.grid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? 'Full Name *' : 'Nombre Completo *'}
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder={isEn ? "John Smith" : "Juan Pérez"}
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? 'Email *' : 'Correo *'}
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder={isEn ? "john@example.com" : "juan@ejemplo.com"}
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
            </div>

            <div style={styles.grid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? 'Phone *' : 'Teléfono *'}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder={isEn ? "+504 89467476" : "+504 89467476"}
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? 'Company' : 'Empresa'}
                </label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder={isEn ? "Your company name" : "Nombre de tu empresa"}
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
            </div>

            <div style={styles.grid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? 'Origin Port *' : 'Puerto de Origen *'}
                </label>
                <select
                  name="origin"
                  value={formData.origin}
                  onChange={handleChange}
                  required
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                >
                  <option value="">{isEn ? 'Select origin port' : 'Selecciona puerto de origen'}</option>
                  <option value="Miami">Miami</option>
                  <option value="Houston">Houston</option>
                  <option value="Los Angeles">Los Angeles</option>
                  <option value="New York">New York</option>
                  <option value="Savannah">Savannah</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? 'Destination Port *' : 'Puerto de Destino *'}
                </label>
                <select
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  required
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                >
                  <option value="">{isEn ? 'Select destination port' : 'Selecciona puerto de destino'}</option>
                  <option value="roatan">Roatán</option>
                  <option value="utila">Utila</option>
                  <option value="guanaja">Guanaja</option>
                  <option value="la-ceiba">La Ceiba</option>
                  <option value="tegucigalpa">Tegucigalpa</option>
                  <option value="san-pedro-sula">San Pedro Sula</option>
                  <option value="puerto-lempira">Puerto Lempira</option>
                </select>
              </div>
            </div>

            <div style={styles.grid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? 'Container Type *' : 'Tipo de Contenedor *'}
                </label>
                <select
                  name="containerType"
                  value={formData.containerType}
                  onChange={handleChange}
                  required
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                >
                  <option value="">{isEn ? 'Select container type' : 'Selecciona tipo de contenedor'}</option>
                  <option value="20ft">20ft Standard</option>
                  <option value="40ft">40ft Standard</option>
                  <option value="40ft-hc">40ft High Cube</option>
                  <option value="45ft-hc">45ft High Cube</option>
                  <option value="20ft-reefer">20ft Refrigerated</option>
                  <option value="40ft-reefer">40ft Refrigerated</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? 'Incoterms' : 'Incoterms'}
                </label>
                <select
                  name="incoterms"
                  value={formData.incoterms}
                  onChange={handleChange}
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                >
                  <option value="">{isEn ? 'Select incoterms' : 'Selecciona incoterms'}</option>
                  <option value="EXW">EXW - Ex Works</option>
                  <option value="FOB">FOB - Free On Board</option>
                  <option value="CFR">CFR - Cost and Freight</option>
                  <option value="CIF">CIF - Cost, Insurance and Freight</option>
                  <option value="DDP">DDP - Delivered Duty Paid</option>
                </select>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                {isEn ? 'Cargo Description *' : 'Descripción de la Carga *'}
              </label>
              <textarea
                name="cargoDescription"
                value={formData.cargoDescription}
                onChange={handleChange}
                required
                style={styles.textarea}
                placeholder={isEn ? 'Describe your cargo...' : 'Describe tu carga...'}
              />
            </div>

            <div style={styles.grid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? 'Weight (kg)' : 'Peso (kg)'}
                </label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  placeholder={isEn ? "1000" : "1000"}
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                  {isEn ? 'Volume (m³)' : 'Volumen (m³)'}
                </label>
                <input
                  type="number"
                  name="volume"
                  value={formData.volume}
                  onChange={handleChange}
                  placeholder={isEn ? "10" : "10"}
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                {isEn ? 'Additional Information' : 'Información Adicional'}
              </label>
              <textarea
                name="additionalInfo"
                value={formData.additionalInfo}
                onChange={handleChange}
                style={styles.textarea}
                placeholder={isEn ? 'Any special requirements...' : 'Requisitos especiales...'}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                {isEn ? 'Invoice/Document (Optional)' : 'Factura/Documento (Opcional)'}
              </label>
              <div style={{
                position: 'relative',
                display: 'inline-block',
                width: '100%'
              }}>
                <div style={{
                    ...styles.input,
                    padding: '12px 45px 12px 12px',
                    cursor: 'pointer',
                    backgroundColor: '#f8fafc',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease',
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
                  onClick={() => document.getElementById('fcl-file-input')?.click()}
                >
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    {isEn ? '📎 Click to upload invoice or document' : '📎 Haz clic para subir factura o documento'}
                  </span>
                  <input
                    id="fcl-file-input"
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
              disabled={isSubmitting}
              style={{
                ...styles.button,
                ...(isSubmitting ? { backgroundColor: '#6b7280', cursor: 'not-allowed' } : {}),
              }}
            >
              {isSubmitting 
                ? (isEn ? 'Sending...' : 'Enviando...')
                : (isEn ? 'Request Quote' : 'Solicitar Cotización')
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;
