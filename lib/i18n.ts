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
        registroClientes: "Client Signup",
        login: "Login",
        es: "ES",
        en: "EN",
      },
      home: {
        badge: "Your Cargo, Our Commitment",
        titleLine1: "Reliable Cargo Transport",
        titleHighlight: "Throughout Honduras",
        subtitle:
          "Connect Your Business With 7 Strategic Ports And Professional Logistics Services.",
        primaryCta: "Get A Quote",
        secondaryCta: "Track Your Shipment",
      },
      calc: {
        title: "Volume Calculator",
        description: "Quickly Calculate The Cubic Feet (ft³) Of Your Cargo.",
        howItWorksTitle: "How Does It Work?",
        howItWorksText:
          "We Multiply Your Package Dimensions In Inches And Divide By 1728 To Get The Real Volume.",
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
        title: "Let’s Talk About Your Cargo",
        description:
          "Fill Out The Form And An Advisor Will Get In Touch With You.",
        phoneLabel: "Phone",
        emailLabel: "Email",
        fullName: "Full Name",
        yourEmail: "Your Email",
        messageLabel: "What Do You Need To Import?",
        submit: "Send Message",
        subject: "New Contact Message From The Website",
      },
      footer: {
        companyName: "Caribex Logistics Group",
        companySubtitle: "Freight Forwarding Services",
        quickLinks: "Quick Links",
        aboutUs: "About Us",
        services: "Services",
        tracking: "Tracking",
        contact: "Contact",
        legal: "Legal",
        privacy: "Privacy Policy",
        terms: "Terms Of Service",
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
        errorSending: "Error Sending. Please Try Again.",
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
