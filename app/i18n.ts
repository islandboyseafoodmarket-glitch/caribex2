import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Recursos iniciales de ejemplo. Aquí centralizamos los textos ES / EN
// para que los componentes usen t("clave") en lugar de condicionales.
const resources = {
  es: {
    common: {
      nav: {
        home: "Inicio",
        about: "Acerca",
        tracking: "Seguimiento",
        calculator: "Calculadora",
        contact: "Contacto",
        fcl: "FCL",
        lcl: "LCL",
      },
    },
    fcl: {
      headerTitle: "Servicios de carga de contenedor completo (FCL)",
      headerSubtitle:
        "Soluciones de envío de contenedores completos eficientes, confiables y rentables para su carga internacional",
      headerCta: "Empieza hoy",
      whatIsTitle: "¿Qué es FCL?",
      whatIsP1:
        "El envío de carga completa (FCL) implica alquilar un contenedor completo para su envío. Esta es la opción más económica cuando tiene suficiente carga para llenar un contenedor de 20 o 40 pies.",
      whatIsP2:
        "Con FCL, usted tiene el uso exclusivo del contenedor, lo que significa que su carga no se mezcla con otros envíos. Esto le proporciona mayor seguridad, tiempos de tránsito más rápidos y mayor flexibilidad en el manejo de sus mercancías.",
      whatIsP3:
        "FCL es ideal para empresas con necesidades de envío regulares, pedidos grandes o carga que requiere un manejo dedicado.",
    },
    lcl: {
      headerBadge: "Servicios de carga fraccionada (LCL)",
      headerTitle: "Servicios de carga fraccionada (LCL)",
      headerSubtitle:
        "Soluciones de envío asequibles y flexibles para envíos más pequeños",
      headerCta: "Empieza hoy mismo",
    },
  },
  en: {
    common: {
      nav: {
        home: "Home",
        about: "About",
        tracking: "Tracking",
        calculator: "Calculator",
        contact: "Contact",
        fcl: "FCL",
        lcl: "LCL",
      },
    },
    fcl: {
      headerTitle: "Full Container Load (FCL) services",
      headerSubtitle:
        "Efficient, reliable and cost‑effective full container shipping solutions for your international cargo",
      headerCta: "Get started today",
      whatIsTitle: "What is FCL?",
      whatIsP1:
        "Full Container Load (FCL) means renting an entire container for your shipment. This is the most economical option when you have enough cargo to fill a 20‑ or 40‑foot container.",
      whatIsP2:
        "With FCL you have exclusive use of the container, so your cargo is not mixed with other shipments. This provides greater security, faster transit times and more flexibility in how your goods are handled.",
      whatIsP3:
        "FCL is ideal for companies with regular shipping needs, large orders or cargo that requires dedicated handling.",
    },
    lcl: {
      headerBadge: "Less than Container Load (LCL)",
      headerTitle: "Less than Container Load (LCL) services",
      headerSubtitle:
        "Affordable and flexible shipping solutions for smaller consignments",
      headerCta: "Start today",
    },
  },
} as const;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: "es",
    fallbackLng: "es",
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
