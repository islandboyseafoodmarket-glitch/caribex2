import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  es: {
    translation: {
      nav: {
        inicio: "Inicio",
        acerca: "Acerca",
        fcl: "FCL",
        lcl: "LCL",
        seguimiento: "Seguimiento",
        calculadora: "Calculadora",
        contacto: "Contacto",
        registroClientes: "Registro clientes",
        login: "Login",
        es: "ES",
        en: "EN",
      },
      home: {
        badge: "Su carga, nuestro compromiso",
        titleLine1: "Transporte de carga",
        titleHighlight: "confiable en Honduras",
        subtitle:
          "Conecta tu negocio con 7 puertos estratégicos y servicios logísticos profesionales.",
        primaryCta: "Obtenga una cotización",
        secondaryCta: "Seguimiento del envío",
      },
      calc: {
        title: "Cotizador de Volumen",
        description: "Calcula el pie cúbico (ft³) de tu carga de forma rápida.",
        howItWorksTitle: "¿Cómo funciona?",
        howItWorksText:
          "Multiplicamos las dimensiones de tu bulto en pulgadas y lo dividimos entre 1728 para obtener el volumen real.",
        formula: "(Largo × Ancho × Alto) / 1728",
        serviceSelected: "Servicio Seleccionado",
        optionStandard: "Marítimo Estándar ($18.50/ft³)",
        optionFragile: "Carga Frágil ($25/ft³)",
        length: "Largo (in)",
        height: "Alto (in)",
        width: "Ancho (in)",
        totalLabel: "Total Inversión Estimada",
        totalFeet: "ft³ totales",
      },
      contact: {
        title: "Hablemos de tu carga",
        description:
          "Completa el formulario y un asesor se pondrá en contacto contigo.",
        phoneLabel: "Teléfono",
        emailLabel: "Correo",
        fullName: "Nombre Completo",
        yourEmail: "Tu Email",
        messageLabel: "¿Qué necesitas importar?",
        submit: "Enviar Mensaje",
        subject: "Nuevo mensaje de contacto desde el sitio web",
      },
      footer: {
        companyName: "Grupo Logístico Caribex",
        companySubtitle: "Servicios de Transitario de Mercancías",
        quickLinks: "Enlaces rápidos",
        aboutUs: "Sobre nosotros",
        services: "Servicios",
        tracking: "Seguimiento",
        contact: "Contacto",
        legal: "Legal",
        privacy: "Política de privacidad",
        terms: "Términos de servicio",
        servicesTitle: "Servicios",
        serviceFclLcl: "FCL / LCL",
        serviceForwarder: "Transitario",
        copyright:
          "© Grupo Logístico Caribex 2026. Todos los derechos reservados.",
        poweredBy: "Impulsado por Caribex Logistics Group",
      },
      common: {
        processing: "Procesando...",
        sent: "¡Enviado!",
        sendMessage: "Enviar Mensaje",
        errorSending: "Error al enviar. Inténtalo de nuevo.",
      },
    },
  },
  en: {
    translation: {
      nav: {
        inicio: "Home",
        acerca: "About",
        fcl: "FCL",
        lcl: "LCL",
        seguimiento: "Tracking",
        calculadora: "Calculator",
        contacto: "Contact",
        registroClientes: "Client signup",
        login: "Login",
        es: "ES",
        en: "EN",
      },
      home: {
        badge: "Your cargo, our commitment",
        titleLine1: "Reliable cargo transport",
        titleHighlight: "throughout Honduras",
        subtitle:
          "Connect your business with 7 strategic ports and professional logistics services.",
        primaryCta: "Get a quote",
        secondaryCta: "Track your shipment",
      },
      calc: {
        title: "Volume Calculator",
        description: "Quickly calculate the cubic feet (ft³) of your cargo.",
        howItWorksTitle: "How does it work?",
        howItWorksText:
          "We multiply your package dimensions in inches and divide by 1728 to get the real volume.",
        formula: "(Length × Width × Height) / 1728",
        serviceSelected: "Selected Service",
        optionStandard: "Standard Ocean ($18.50/ft³)",
        optionFragile: "Fragile Cargo ($25/ft³)",
        length: "Length (in)",
        height: "Height (in)",
        width: "Width (in)",
        totalLabel: "Estimated Total Investment",
        totalFeet: "ft³ total",
      },
      contact: {
        title: "Let’s talk about your cargo",
        description:
          "Fill out the form and an advisor will get in touch with you.",
        phoneLabel: "Phone",
        emailLabel: "Email",
        fullName: "Full Name",
        yourEmail: "Your Email",
        messageLabel: "What do you need to import?",
        submit: "Send Message",
        subject: "New contact message from the website",
      },
      footer: {
        companyName: "Caribex Logistics Group",
        companySubtitle: "Freight Forwarding Services",
        quickLinks: "Quick links",
        aboutUs: "About us",
        services: "Services",
        tracking: "Tracking",
        contact: "Contact",
        legal: "Legal",
        privacy: "Privacy policy",
        terms: "Terms of service",
        servicesTitle: "Services",
        serviceFclLcl: "FCL / LCL",
        serviceForwarder: "Forwarder",
        copyright:
          "© Caribex Logistics Group 2026. All rights reserved.",
        poweredBy: "Powered by Caribex Logistics Group",
      },
      common: {
        processing: "Processing...",
        sent: "Sent!",
        sendMessage: "Send Message",
        errorSending: "Error sending. Please try again.",
      },
    },
  },
};

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: "es",
      lng: "es",
      supportedLngs: ["es", "en"],
      interpolation: {
        escapeValue: false,
      },
    });
}

export default i18n;
