"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  Box,
  Package as PackageIcon,
  PackageOpen,
  ClipboardList,
  Truck,
  HandCoins,
  FileText,
  Receipt,
  Search,
  Plus,
  Barcode,
  Camera,
  Globe2,
  ArrowRight,
} from "lucide-react";

import StageReceived from "./StageReceived";
import StageCheckIn from "./StageCheck-in";
import InTransitStage from "./In-Transit";
import UnloadedStage from "./Unloaded";
import PickupStage from "./Pickup";
import InvoicesStage from "./InvoicesStage";
import InvoicePreview from "../components/InvoicePreview";

import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import EscanerQRCaribex, { CaribexPayload } from "./escanerQR";
import ConsolidacionPlayground from "./seleccion-etapas/consolidacion";

import { supabase } from "../lib/supabaseClient";

const EXTRA_CHARGE_OPTIONS = [
  "Storage fees (daily)",
  "Handling fees",
  "Documentation fees",
  "Insurance premium (2% of insurable value)",
  "Forklift charge ($100)",
  "Miscellaneous fee ($10)",
  "Consolidation fee ($2.5)",
  "Honduran imposed duty",
];

const getExtraChargeLabel = (option: string, isEs: boolean): string => {
  if (!isEs) return option;

  switch (option) {
    case "Storage fees (daily)":
      return "Almacenaje (diario)";
    case "Handling fees":
      return "Manejo de carga";
    case "Documentation fees":
      return "Gastos de documentación";
    case "Insurance premium (2% of insurable value)":
      return "Seguro (2% del valor asegurable)";
    case "Forklift charge ($100)":
      return "Uso de montacargas ($100)";
    case "Miscellaneous fee ($10)":
      return "Gastos varios ($10)";
    case "Consolidation fee ($2.5)":
      return "Cargo por consolidación ($2.5)";
    case "Honduran imposed duty":
      return "Impuesto hondureño";
    default:
      return option;
  }
};

type PackageCategoryId = "BOX" | "PACKAGE";

type PackageCategory = {
  id: PackageCategoryId;
  icon: JSX.Element;
  title: string;
  subtitle: string;
};

type Package = {
  id: string;
  tracking: string;
  remitente?: string | null;
  destinatario?: string | null;
  carrier?: string | null;
  type: PackageCategoryId;
  weight: number;
  dims: string;
  obs: string;
  registro?: string | null;
  descargado?: string | null;
  entregadoPor?: string | null;
  estado?: string | null;
  horaFecha?: string | null;
  fechaDescargado?: string | null;
  fechaEntregado?: string | null;
  barcode?: string;
  codigosTrackingId?: string | null;
  consolidationCount?: number;
  numeroClienteId?: string | null;
  numeroCliente?: number | null;
  clienteNombre?: string | null;
  clienteEmail?: string | null;
  notas_imagenes?: string[] | null;
  consolidatedChildrenTrackings?: string[] | null;
  consolidatedIntoBoxTracking?: string | null;
  billing_subtotal?: number | null;
  billing_tax?: number | null;
  billing_total?: number | null;
  approval_status?: string | null;
  invoice_status?: string | null;
};

type StageId =
  | "RECIBIDO_FLORIDA"
  | "REGISTRO"
  | "EN_TRANSITO"
  | "DESCARGADO_ROATAN"
  | "PASTILLA"
  | "FACTURAS";

type Stage = {
  id: StageId;
  label: string;
  badge?: number;
  icon: JSX.Element;
};

const CATEGORIES: PackageCategory[] = [
  {
    id: "BOX",
    icon: <Box size={18} />,
    title: "Caja",
    subtitle: "Cobrado por pie cúbico",
  },
  {
    id: "PACKAGE",
    icon: <PackageIcon size={18} />,
    title: "Paquete",
    subtitle: "Mínimo $15.20",
  },
];

const DEFAULT_CHILD_CHECKIN = {
  clientId: "",
  height: "",
  width: "",
  length: "",
  weight: "",
  hasProblem: false,
  problemNotes: "",
  extraCharges: [] as string[],
};

const CHILD_FIELD_LABELS: Record<
  "height" | "width" | "length" | "weight",
  { es: string; en: string }
> = {
  height: { es: "Alto (in)", en: "Height (in)" },
  width: { es: "Ancho (in)", en: "Width (in)" },
  length: { es: "Largo (in)", en: "Length (in)" },
  weight: { es: "Peso real (lb)", en: "Real weight (lb)" },
};

const getCategoryLabel = (id: PackageCategoryId, isEs: boolean): string => {
  if (isEs) {
    switch (id) {
      case "BOX":
        return "Caja";
      case "PACKAGE":
        return "Paquete";
      default:
        return id;
    }
  } else {
    switch (id) {
      case "BOX":
        return "Box";
      case "PACKAGE":
        return "Package";
      default:
        return id;
    }
  }
};

const getStageLabel = (id: StageId, isEs: boolean): string => {
  if (isEs) {
    switch (id) {
      case "RECIBIDO_FLORIDA":
        return "Recibido (Florida)";
      case "REGISTRO":
        return "Registro";
      case "EN_TRANSITO":
        return "En tránsito";
      case "DESCARGADO_ROATAN":
        return "Descargado (Roatán)";
      case "PASTILLA":
        return "Pastilla";
      case "FACTURAS":
        return "Facturas";
    }
  } else {
    switch (id) {
      case "RECIBIDO_FLORIDA":
        return "Received (Florida)";
      case "REGISTRO":
        return "Check In";
      case "EN_TRANSITO":
        return "In-Transit";
      case "DESCARGADO_ROATAN":
        return "Unloaded (Roatán)";
      case "PASTILLA":
        return "Pickup";
      case "FACTURAS":
        return "Invoices";
    }
  }
  return id;
};

const STAGES: Stage[] = [
  {
    id: "RECIBIDO_FLORIDA",
    label: "Recibido (Florida)",
    badge: 0,
    icon: <Box size={18} />,
  },
  {
    id: "REGISTRO",
    label: "Registro",
    badge: 0,
    icon: <ClipboardList size={18} />,
  },
  {
    id: "EN_TRANSITO",
    label: "En tránsito",
    badge: 0,
    icon: <Truck size={18} />,
  },
  {
    id: "DESCARGADO_ROATAN",
    label: "Descargado (Roatán)",
    badge: 0,
    icon: <PackageOpen size={18} />,
  },
  {
    id: "PASTILLA",
    label: "Pastilla",
    badge: 0,
    icon: <HandCoins size={18} />,
  },
  {
    id: "FACTURAS",
    label: "Facturas",
    badge: 0,
    icon: <Receipt size={18} />,
  },
];

const normalizeStatusText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isTransitStatus = (status?: string | null) => {
  if (!status) return false;
  const normalized = normalizeStatusText(status);
  return normalized.includes("transito") || normalized.includes("transit");
};

const isReceivedStatus = (status?: string | null) => {
  if (!status) return false;
  const normalized = normalizeStatusText(status);
  return normalized.includes("recibido");
};

export default function GestionAlmacen() {
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);

  const [activeStage, setActiveStage] = useState<StageId>("RECIBIDO_FLORIDA");

  const [language, setLanguage] = useState<"es" | "en">("en");
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [isNextModalOpen, setIsNextModalOpen] = useState(false);
  const [isEditingCheckIn, setIsEditingCheckIn] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isTransitModalOpen, setIsTransitModalOpen] = useState(false);
  const [viewPackage, setViewPackage] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewCheckInDetails, setViewCheckInDetails] = useState<
    | {
        height: number | null;
        width: number | null;
        length: number | null;
        weight: number | null;
        hasProblem: boolean;
        problemNotes: string | null;
        extraCharges: string | null;
        isConsolidationBox: boolean;
      }
    | null
  >(null);

  // Modal de confirmación para eliminar factura
  const [pendingDeleteInvoice, setPendingDeleteInvoice] = useState<Package | null>(
    null,
  );

  // Campos para el formulario de Check In (siguiente etapa)
  const [checkInClientId, setCheckInClientId] = useState("");
  const [checkInClientSearch, setCheckInClientSearch] = useState("");
  const [checkInHeight, setCheckInHeight] = useState("");
  const [checkInWidth, setCheckInWidth] = useState("");
  const [checkInLength, setCheckInLength] = useState("");
  const [checkInRealWeight, setCheckInRealWeight] = useState("");
  const [checkInHasProblem, setCheckInHasProblem] = useState(false);
  const [checkInProblemNotes, setCheckInProblemNotes] = useState("");
  const [checkInExtraCharges, setCheckInExtraCharges] = useState("");
  const [selectedExtraCharges, setSelectedExtraCharges] = useState<string[]>([]);
  const [checkInConsolidation, setCheckInConsolidation] = useState(false);
  const [checkInImageUrls, setCheckInImageUrls] = useState<string[]>([]);
  const [checkInImageStatus, setCheckInImageStatus] = useState<string | null>(
    null,
  );
  const [isCheckInImageUploading, setIsCheckInImageUploading] = useState(false);
  const checkInImageInputRef = useRef<HTMLInputElement | null>(null);
  // Datos de consolidación provenientes del componente ConsolidacionPlayground
  const [consolidationChildren, setConsolidationChildren] = useState<Package[]>(
    [],
  );
  const [consolidationChildState, setConsolidationChildState] = useState<
    Record<string, any>
  >({});
  // Consolidación basada en tracking (clave estable para la UI)
  const [consolidatedTrackings, setConsolidatedTrackings] = useState<string[]>([]);
  // Lista explícita de paquetes hijos mostrados en el modal de Check In
  const [checkInChildPackages, setCheckInChildPackages] = useState<Package[]>([]);
  // Guardamos el tracking seleccionado como string porque los <option> de <select>
  // manejan sus values como cadenas.
  const [selectedChildToAddTracking, setSelectedChildToAddTracking] = useState<string>("");
  type ChildImageState = {
    urls: string[];
    status: string | null;
    uploading: boolean;
  };

  const [childCheckInData, setChildCheckInData] = useState<
    Record<
      string,
      {
        clientId: string;
        height: string;
        width: string;
        length: string;
        weight: string;
        hasProblem: boolean;
        problemNotes: string;
        extraCharges: string[];
      }
    >
  >({});
  const [childImageState, setChildImageState] = useState<
    Record<string, ChildImageState>
  >({});
  const childImageRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Modal para ver una foto de problema en grande
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Factura virtual
  const [invoicePackage, setInvoicePackage] = useState<Package | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceExtraCharges, setInvoiceExtraCharges] = useState<string[]>([]);
  const [invoiceIsConsolidationBox, setInvoiceIsConsolidationBox] = useState(false);
  const [isSendingInvoiceEmail, setIsSendingInvoiceEmail] = useState(false);
  const [isConfirmSendInvoiceOpen, setIsConfirmSendInvoiceOpen] = useState(false);

  // Modal genérico para mensajes (reemplazo de alert)
  const [messageModal, setMessageModal] = useState<
    | {
        title: string;
        message: string;
      }
    | null
  >(null);

  useEffect(() => {
    if (!checkInConsolidation) {
      setConsolidatedTrackings([]);
      setChildCheckInData({});
      setCheckInChildPackages([]);
    }
  }, [checkInConsolidation]);

  const [clients, setClients] = useState<
    { id: string; nombre: string; numero_cliente: number }[]
  >([]);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [pickupScannerActive, setPickupScannerActive] = useState(false);
  const pickupScannerRef = useRef<Html5Qrcode | null>(null);
  const [qrPedido, setQrPedido] = useState<any | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrIdentifier, setQrIdentifier] = useState("");
  const [isPickupQrMode, setIsPickupQrMode] = useState(false);
  const [pendingQrTracking, setPendingQrTracking] = useState<string>("");

  const handleViewPackage = async (pkg: any) => {
    setViewPackage(pkg);
    setIsViewModalOpen(true);
    setViewCheckInDetails(null);

    try {
      const { data, error } = await supabase
        .from("paquetes_checkin")
        .select(
          "alto, ancho, largo, peso, problema, problema_notas, cargos_adicionales, consolidacion",
        )
        .eq("paquete_id", pkg.id)
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setViewCheckInDetails({
          height: (data as any).alto ?? null,
          width: (data as any).ancho ?? null,
          length: (data as any).largo ?? null,
          weight: (data as any).peso ?? null,
          hasProblem: Boolean((data as any).problema),
          problemNotes: (data as any).problema_notas ?? null,
          extraCharges: (data as any).cargos_adicionales ?? null,
          isConsolidationBox: Boolean((data as any).consolidacion),
        });
      }
    } catch {
      // Si falla la carga de datos de Check-In, simplemente no mostramos esa sección.
    }
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setViewPackage(null);
    setViewCheckInDetails(null);
    setIsImagePreviewOpen(false);
    setImagePreviewUrl(null);
  };

  const handleOpenInvoiceModal = async (pkg: Package) => {
    setInvoicePackage(pkg);
    setIsInvoiceModalOpen(true);

    try {
      const { data, error } = await supabase
        .from("paquetes_checkin")
        .select("cargos_adicionales, consolidacion")
        .eq("paquete_id", pkg.id)
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setInvoiceExtraCharges([]);
        setInvoiceIsConsolidationBox(false);
        return;
      }

      const extrasRaw = (data as any).cargos_adicionales as string | null;
      const extras = extrasRaw
        ? extrasRaw
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];
      setInvoiceExtraCharges(extras);
      setInvoiceIsConsolidationBox(Boolean((data as any).consolidacion));
    } catch {
      setInvoiceExtraCharges([]);
      setInvoiceIsConsolidationBox(false);
    }

    // Asegurar que tenemos el correo del cliente más reciente.
    try {
      const clientId = pkg.numeroClienteId;
      if (clientId) {
        const { data: clientRow, error: clientError } = await supabase
          .from("numero_cliente")
          .select("email")
          .eq("id", clientId)
          .maybeSingle();

        if (!clientError && clientRow && (clientRow as any).email) {
          const email = String((clientRow as any).email).trim();
          if (email) {
            setInvoicePackage((prev) =>
              prev && prev.id === pkg.id ? { ...prev, clienteEmail: email } : prev,
            );
          }
        }
      }
    } catch {
      // Si falla, simplemente seguimos; el envío validará que exista email.
    }
  };

  const handleCloseInvoiceModal = () => {
    setInvoicePackage(null);
    setInvoiceExtraCharges([]);
    setInvoiceIsConsolidationBox(false);
    setIsInvoiceModalOpen(false);
    setIsConfirmSendInvoiceOpen(false);
  };

  const handleSendInvoiceEmail = async () => {
    if (!invoicePackage) return;
    const approval = (invoicePackage.approval_status || "").toUpperCase();
    if (approval !== "APPROVED") {
      alert(
        isEs
          ? "Esta factura no está aprobada. Primero debe ser aprobada en el panel de facturas antes de poder enviarla por correo."
          : "This invoice is not approved. Please approve it in the invoices panel before emailing.",
      );
      return;
    }

    const rawClientEmail = (invoicePackage.clienteEmail || "").trim();
    if (!rawClientEmail) {
      setMessageModal({
        title: isEs ? "Aviso" : "Notice",
        message: isEs
          ? "Este cliente no tiene correo registrado. No se puede enviar la factura."
          : "This client has no email on file. Invoice cannot be sent.",
      });
      return;
    }

    const clientEmail = rawClientEmail;

    const clientName = invoicePackage.clienteNombre || "";
    const clientNumber = invoicePackage.numeroCliente ?? null;
    const tracking = invoicePackage.tracking;
    const typeLabel = getCategoryLabel(invoicePackage.type, false);
    const contents = invoicePackage.dims;

    const subtotal =
      typeof invoicePackage.billing_subtotal === "number" &&
      !Number.isNaN(invoicePackage.billing_subtotal)
        ? invoicePackage.billing_subtotal
        : 0;
    const tax =
      typeof invoicePackage.billing_tax === "number" &&
      !Number.isNaN(invoicePackage.billing_tax)
        ? invoicePackage.billing_tax
        : subtotal * 0.15;
    const total =
      typeof invoicePackage.billing_total === "number" &&
      !Number.isNaN(invoicePackage.billing_total)
        ? invoicePackage.billing_total
        : subtotal + tax;

    const subject = `Invoice for ${clientName || tracking}`;

    try {
      setIsSendingInvoiceEmail(true);
      const res = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: clientEmail,
          subject,
          clientName,
          clientNumber,
          tracking,
          typeLabel,
          contents,
          subtotal,
          tax,
          total,
          extraCharges: invoiceExtraCharges,
          isConsolidationBox: invoiceIsConsolidationBox,
          consolidatedPackagesCount: invoicePackage.consolidationCount ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as any).error || "Error sending email";
        setMessageModal({
          title: isEs ? "Error" : "Error",
          message: isEs
            ? `No se pudo enviar la factura por correo: ${msg}`
            : `Could not send invoice by email: ${msg}`,
        });
        return;
      }

      setMessageModal({
        title: isEs ? "Éxito" : "Success",
        message: isEs
          ? "Factura enviada por correo correctamente"
          : "Invoice emailed successfully",
      });

      // Cerrar modales relacionados para que la confirmación se vea clara
      setIsConfirmSendInvoiceOpen(false);
      setIsInvoiceModalOpen(false);
    } catch (e) {
      setMessageModal({
        title: isEs ? "Error" : "Error",
        message: isEs
          ? "Ocurrió un error inesperado al enviar la factura por correo"
          : "Unexpected error while sending invoice by email",
      });
    } finally {
      setIsSendingInvoiceEmail(false);
    }
  };

  // Escáner para la etapa de Descargado (Roatán)
  const [isUnloadModalOpen, setIsUnloadModalOpen] = useState(false);
  const [isUnloadScannerOpen, setIsUnloadScannerOpen] = useState(false);
  const [isUnloadQrMode, setIsUnloadQrMode] = useState(false);
  const unloadScannerRef = useRef<Html5Qrcode | null>(null);

  const handleUnloadPackage = async (rawTracking: string) => {
    const trackingValue = rawTracking.trim().toUpperCase();
    if (!trackingValue) return;

    const { data, error } = await supabase
      .from("paquetes_registro")
      .select(
        "id, tracking, estado, notas, tipo_paquete, billing_subtotal, billing_tax, billing_total, approval_status, invoice_status",
      )
      .eq("tracking", trackingValue);

    if (error) {
      setMessageModal({
        title: isEs ? "Error" : "Error",
        message:
          error.message ||
          (isEs
            ? "Error buscando el paquete escaneado"
            : "Error searching scanned package"),
      });
      return;
    }

    if (!data || data.length === 0) {
      setMessageModal({
        title: isEs ? "Aviso" : "Notice",
        message: isEs
          ? "No se encontró ningún paquete con ese tracking"
          : "No package found with that tracking",
      });
      return;
    }

    if (data.length > 1) {
      setMessageModal({
        title: isEs ? "Aviso" : "Notice",
        message: isEs
          ? "Hay más de un paquete con este tracking en el sistema. Revisa y corrige los duplicados antes de marcarlo como descargado."
          : "There is more than one package with this tracking in the system. Please review and fix the duplicates before marking it as unloaded.",
      });
      return;
    }

    const row = data[0] as any;

    if (!isTransitStatus(row.estado)) {
      setMessageModal({
        title: isEs ? "Aviso" : "Notice",
        message: isEs
          ? "Este envío no está en tránsito"
          : "This shipment is not in transit",
      });
      return;
    }

    const now = new Date();
    const isoNow = now.toISOString();
    const timeStr = isoNow.substring(11, 19);

    // Determinar si el envío tiene notas de problema para la aprobación automática
    const hasNotes = row.notas && String(row.notas).trim().length > 0;
    const approvalStatus = hasNotes ? "PENDING" : "APPROVED";

    // Determinar / calcular subtotal de facturación según tipo de paquete.
    // Si ya existe un subtotal válido, se respeta; en caso contrario, se calcula
    // automáticamente usando la nueva fórmula SOLO para este paquete recién descargado:
    //
    // 1) BASE
    //    - BOX: ((largo * ancho * alto) / 1728) * 18.50
    //    - PACKAGE: 18.50 fijo
    // 2) EXTRAS (si están marcados en cargos_adicionales en paquetes_checkin)
    //    - Consolidation fee ($2.5)  -> + 2.50
    //    - Forklift charge ($100)   -> + 100
    //    - Miscellaneous fee ($10)  -> + 10
    // 3) Manejo de carga (Handling fees)
    //    - 15% de la BASE (no del subtotal con extras): base * 0.15
    // 4) Subtotal
    //    - subtotal = base + extras + manejo
    // 5) Impuesto general 15%
    //    - billing_tax   = subtotal * 0.15
    //    - billing_total = subtotal + billing_tax
    let safeSubtotal: number | null = null;
    const existingSubtotal = row.billing_subtotal as number | null | undefined;

    if (typeof existingSubtotal === "number" && !Number.isNaN(existingSubtotal)) {
      safeSubtotal = existingSubtotal;
    } else {
      const rawType = (row as any).tipo_paquete as string | null | undefined;
      const normalizedType = rawType ? String(rawType).toUpperCase() : null;

      const isPackage = normalizedType
        ? normalizedType.includes("PACKAGE") || normalizedType.includes("PAQUETE")
        : false;
      const isBox = normalizedType
        ? normalizedType.includes("BOX") || normalizedType.includes("CAJA")
        : false;

      // Helper local para calcular extras y manejo de carga a partir de cargos_adicionales
      const computeExtrasAndHandling = (extrasRaw: string | null | undefined, baseAmount: number) => {
        if (!baseAmount || Number.isNaN(baseAmount) || baseAmount <= 0) {
          return { extrasAmount: 0, handlingCharge: 0 };
        }

        const extras = extrasRaw
          ? extrasRaw
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : [];

        let extrasAmount = 0;
        let handlingCharge = 0;

        if (extras.includes("Consolidation fee ($2.5)")) {
          extrasAmount += 2.5;
        }
        if (extras.includes("Forklift charge ($100)")) {
          extrasAmount += 100;
        }
        if (extras.includes("Miscellaneous fee ($10)")) {
          extrasAmount += 10;
        }
        // Manejo de carga: 15% de la BASE si está marcado "Handling fees"
        if (extras.includes("Handling fees")) {
          handlingCharge = baseAmount * 0.15;
        }

        return { extrasAmount, handlingCharge };
      };

      if (isPackage) {
        try {
          const { data: checkData } = await supabase
            .from("paquetes_checkin")
            .select("cargos_adicionales")
            .eq("paquete_id", row.id)
            .order("creado_en", { ascending: false })
            .limit(1)
            .maybeSingle();

          const baseAmount = 18.5;
          const extrasRaw = checkData
            ? ((checkData as any).cargos_adicionales as string | null)
            : null;

          const { extrasAmount, handlingCharge } = computeExtrasAndHandling(
            extrasRaw,
            baseAmount,
          );

          const subtotal = baseAmount + extrasAmount + handlingCharge;
          safeSubtotal = subtotal;
        } catch {
          // Si falla el cálculo automático, se deja safeSubtotal en null.
        }
      } else if (isBox) {
        try {
          const { data: checkData } = await supabase
            .from("paquetes_checkin")
            .select("alto, ancho, largo, cargos_adicionales")
            .eq("paquete_id", row.id)
            .order("creado_en", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (checkData) {
            const h = Number((checkData as any).alto ?? 0) || 0;
            const w = Number((checkData as any).ancho ?? 0) || 0;
            const l = Number((checkData as any).largo ?? 0) || 0;

            const volumeFt3 = (l * w * h) / 1728;
            if (volumeFt3 > 0) {
              const baseAmount = volumeFt3 * 18.5;
              const extrasRaw = (checkData as any).cargos_adicionales as
                | string
                | null
                | undefined;

              const { extrasAmount, handlingCharge } = computeExtrasAndHandling(
                extrasRaw,
                baseAmount,
              );

              const subtotal = baseAmount + extrasAmount + handlingCharge;
              safeSubtotal = subtotal;
            }
          }
        } catch {
          // Si falla el cálculo automático, se deja safeSubtotal en null.
        }
      }
    }

    const computedTax = safeSubtotal != null ? safeSubtotal * 0.15 : null;
    const computedTotal =
      safeSubtotal != null && computedTax != null
        ? safeSubtotal + computedTax
        : null;

    const { error: updateError } = await supabase
      .from("paquetes_registro")
      .update({
        estado: "Descargado (Roatan)",
        descargado: currentUserName,
        fecha_descargado: isoNow,
        hora_descargado: timeStr,
        approval_status: approvalStatus,
        invoice_status: row.invoice_status || "PENDING",
        billing_subtotal: safeSubtotal,
        billing_tax: computedTax,
        billing_total: computedTotal,
      })
      .eq("tracking", trackingValue);

    if (updateError) {
      alert(
        updateError.message ||
          (isEs
            ? "No se pudo marcar el paquete como descargado"
            : "Could not mark package as unloaded"),
      );
      return;
    }

    setPackages((prev) =>
      prev.map((p) =>
        p.tracking === trackingValue
          ? {
              ...p,
              estado: "Descargado (Roatan)",
            }
          : p,
      ),
    );

    // 1) Eliminar la relación de este paquete con cualquier contenedor
    try {
      const { data: rels, error: relError } = await supabase
        .from("contenedor_paquetes")
        .select("id, contenedor_id")
        .eq("paquete_id", row.id);

      if (!relError && rels && rels.length > 0) {
        // Borrar únicamente las filas de relación; el contenedor se
        // eliminará manualmente desde la UI cuando esté vacío.
        await supabase
          .from("contenedor_paquetes")
          .delete()
          .in(
            "id",
            (rels as any[]).map((r) => r.id as string | number),
          );
      }
    } catch (e) {
      console.error("Error limpiando contenedor_paquetes / contenedores al descargar", e);
    }

    setIsUnloadModalOpen(false);
  };

  const stopUnloadScanner = () => {
    setIsUnloadScannerOpen(false);
    if (unloadScannerRef.current) {
      try {
        const instance: any = unloadScannerRef.current;
        instance.stop?.().catch(() => {});
        instance.clear?.().catch(() => {});
      } catch {
        // ignorar errores al cerrar el escáner de descarga
      }
      unloadScannerRef.current = null;
    }
  };

  // Escaneo de QR Caribex en la etapa de descarga: usa el mismo flujo de
  // handleUnloadPackage pero tomando el tracking desde el QR validado.
  const handleCaribexUnloadResult = (payload: CaribexPayload) => {
    const trackingFromQr = (payload.tracking || "").toString().trim();
    if (!trackingFromQr) {
      alert(
        isEs
          ? "El QR de Caribex no contiene un tracking válido para descarga"
          : "Caribex QR does not contain a valid tracking for unload",
      );
      return;
    }

    handleUnloadPackage(trackingFromQr);
    setIsUnloadScannerOpen(false);
    setIsUnloadModalOpen(false);
    setIsUnloadQrMode(false);
  };

  // Generación masiva de facturas: recalcula IVA y total para todos los
  // envíos descargados que ya tengan billing_subtotal pero aún no tengan
  // billing_total. No modifica el subtotal ni los estados básicos.
  const handleBulkGenerateInvoices = async () => {
    const confirmText = isEs
      ? "¿Recalcular subtotal, IVA y total para todos los envíos descargados?"
      : "Recalculate subtotal, tax and total for all unloaded shipments?";

    if (!window.confirm(confirmText)) return;

    const { data, error } = await supabase
      .from("paquetes_registro")
      .select(
        "id, tracking, estado, tipo_paquete, billing_subtotal, billing_total, billing_tax, approval_status, invoice_status",
      )
      .or("estado.ilike.%descargado%,estado.ilike.%entregado%");

    if (error) {
      alert(
        error.message ||
          (isEs
            ? "No se pudieron cargar los envíos descargados para facturación"
            : "Could not load unloaded shipments for invoicing"),
      );
      return;
    }

    if (!data || data.length === 0) {
      alert(
        isEs
          ? "No hay envíos descargados ni entregados para recalcular factura"
          : "There are no unloaded or delivered shipments to recalculate invoices",
      );
      return;
    }

    const updates: {
      id: string;
      billing_subtotal: number | null;
      billing_tax: number | null;
      billing_total: number | null;
      invoice_status?: string;
    }[] = [];

    for (const row of data as any[]) {
      let safeSubtotal: number | null = null;
      const existingSubtotal = row.billing_subtotal as number | null | undefined;

      if (
        typeof existingSubtotal === "number" &&
        !Number.isNaN(existingSubtotal)
      ) {
        // Respetar subtotales ya guardados para no cambiar facturas previas.
        safeSubtotal = existingSubtotal;
      } else {
        const rawType = (row as any).tipo_paquete as string | null | undefined;
        const normalizedType = rawType ? String(rawType).toUpperCase() : null;

        const isPackage = normalizedType
          ? normalizedType.includes("PACKAGE") || normalizedType.includes("PAQUETE")
          : false;
        const isBox = normalizedType
          ? normalizedType.includes("BOX") || normalizedType.includes("CAJA")
          : false;

        // Helper local para calcular extras y manejo de carga a partir de cargos_adicionales
        const computeExtrasAndHandling = (
          extrasRaw: string | null | undefined,
          baseAmount: number,
        ) => {
          if (!baseAmount || Number.isNaN(baseAmount) || baseAmount <= 0) {
            return { extrasAmount: 0, handlingCharge: 0 };
          }

          const extras = extrasRaw
            ? extrasRaw
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
            : [];

          let extrasAmount = 0;
          let handlingCharge = 0;

          if (extras.includes("Consolidation fee ($2.5)")) {
            extrasAmount += 2.5;
          }
          if (extras.includes("Forklift charge ($100)")) {
            extrasAmount += 100;
          }
          if (extras.includes("Miscellaneous fee ($10)")) {
            extrasAmount += 10;
          }
          if (extras.includes("Handling fees")) {
            handlingCharge = baseAmount * 0.15;
          }

          return { extrasAmount, handlingCharge };
        };

        if (isPackage) {
          try {
            const { data: checkData } = await supabase
              .from("paquetes_checkin")
              .select("cargos_adicionales")
              .eq("paquete_id", row.id)
              .order("creado_en", { ascending: false })
              .limit(1)
              .maybeSingle();

            const baseAmount = 18.5;
            const extrasRaw = checkData
              ? ((checkData as any).cargos_adicionales as string | null)
              : null;

            const { extrasAmount, handlingCharge } = computeExtrasAndHandling(
              extrasRaw,
              baseAmount,
            );

            const subtotal = baseAmount + extrasAmount + handlingCharge;
            safeSubtotal = subtotal;
          } catch {
            // Si falla el cálculo automático, se deja safeSubtotal en null.
          }
        } else if (isBox) {
          try {
            const { data: checkData } = await supabase
              .from("paquetes_checkin")
              .select("alto, ancho, largo, cargos_adicionales")
              .eq("paquete_id", row.id)
              .order("creado_en", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (checkData) {
              const h = Number((checkData as any).alto ?? 0) || 0;
              const w = Number((checkData as any).ancho ?? 0) || 0;
              const l = Number((checkData as any).largo ?? 0) || 0;

              const volumeFt3 = (l * w * h) / 1728;
              if (volumeFt3 > 0) {
                const baseAmount = volumeFt3 * 18.5;
                const extrasRaw = (checkData as any).cargos_adicionales as
                  | string
                  | null
                  | undefined;

                const { extrasAmount, handlingCharge } = computeExtrasAndHandling(
                  extrasRaw,
                  baseAmount,
                );

                const subtotal = baseAmount + extrasAmount + handlingCharge;
                safeSubtotal = subtotal;
              }
            }
          } catch {
            // Si falla el cálculo automático, se deja safeSubtotal en null.
          }
        }
      }

      if (safeSubtotal == null) continue;

      const tax = safeSubtotal * 0.15;
      const total = safeSubtotal + tax;

      updates.push({
        id: String(row.id),
        billing_subtotal: safeSubtotal,
        billing_tax: tax,
        billing_total: total,
        invoice_status: row.invoice_status || "PENDING",
      });
    }

    if (!updates.length) {
      alert(
        isEs
          ? "No se encontró ningún envío con subtotal para calcular"
          : "No shipments with subtotal were found to calculate",
      );
      return;
    }

    // Actualizar cada envío directamente en paquetes_registro para asegurar que
    // subtotal, impuesto y total queden guardados.
    for (const rec of updates) {
      const { error: updError } = await supabase
        .from("paquetes_registro")
        .update({
          billing_subtotal: rec.billing_subtotal,
          billing_tax: rec.billing_tax,
          billing_total: rec.billing_total,
          invoice_status: rec.invoice_status ?? "PENDING",
        })
        .eq("id", rec.id);

      if (updError) {
        alert(
          updError.message ||
            (isEs
              ? "No se pudieron actualizar algunas facturas en lote"
              : "Some invoices could not be updated in bulk"),
        );
        return;
      }
    }

    // Refrescar lista local para reflejar los cambios
    await cargarPaquetes();

    alert(
      isEs
        ? "Facturas recalculadas correctamente para los envíos descargados"
        : "Invoices recalculated successfully for unloaded shipments",
    );
  };

  // Cambiar estado de aprobación de una factura individual
  const handleChangeInvoiceApproval = async (
    pkg: Package,
    status: "APPROVED" | "REJECTED",
  ) => {
    const { error } = await supabase
      .from("paquetes_registro")
      .update({ approval_status: status })
      .eq("id", pkg.id);

    if (error) {
      alert(
        error.message ||
          (isEs
            ? "No se pudo actualizar la aprobación de la factura"
            : "Could not update invoice approval status"),
      );
      return;
    }

    // Refrescar en memoria
    setPackages((prev) =>
      prev.map((p) =>
        p.id === pkg.id
          ? {
              ...p,
              // guardamos sólo el estado de aprobación; los totales ya están en la BD
              // y se recargarán desde cargarPaquetes cuando sea necesario
              // (aquí basta con reflejar el cambio de aprobación).
              // @ts-ignore
              approval_status: status,
            }
          : p,
      ),
    );
  };

  // Cambiar estado de factura (pagada, enviada, etc.)
  const handleChangeInvoiceStatus = async (
    pkg: Package,
    status: "PENDING" | "SENT" | "PAID" | "OVERDUE",
  ) => {
    const { error } = await supabase
      .from("paquetes_registro")
      .update({ invoice_status: status })
      .eq("id", pkg.id);

    if (error) {
      alert(
        error.message ||
          (isEs
            ? "No se pudo actualizar el estado de la factura"
            : "Could not update invoice status"),
      );
      return;
    }

    setPackages((prev) =>
      prev.map((p) =>
        p.id === pkg.id
          ? {
              ...p,
              // @ts-ignore
              invoice_status: status,
            }
          : p,
      ),
    );
  };

  const handleDeleteInvoice = (pkg: Package) => {
    setPendingDeleteInvoice(pkg);
  };

  const confirmDeleteInvoice = async () => {
    if (!pendingDeleteInvoice) return;

    const target = pendingDeleteInvoice;

    const { error } = await supabase
      .from("paquetes_registro")
      .update({
        billing_subtotal: null,
        billing_tax: null,
        billing_total: null,
        invoice_status: null,
      })
      .eq("id", target.id);

    if (error) {
      setMessageModal({
        title: isEs ? "Error" : "Error",
        message:
          error.message ||
          (isEs
            ? "No se pudo eliminar la factura"
            : "Could not delete invoice"),
      });
      return;
    }

    setPackages((prev) =>
      prev.map((p) =>
        p.id === target.id
          ? {
              ...p,
              billing_subtotal: null,
              billing_tax: null,
              billing_total: null,
              // @ts-ignore
              invoice_status: null,
            }
          : p,
      ),
    );

    setPendingDeleteInvoice(null);
  };

  const packagesByStage = useMemo(() => {
    const grouped: Record<StageId, Package[]> = {
      RECIBIDO_FLORIDA: [],
      REGISTRO: [],
      EN_TRANSITO: [],
      DESCARGADO_ROATAN: [],
      PASTILLA: [],
      FACTURAS: [],
    };

    for (const p of packages) {
      const raw = (p.estado || "").toLowerCase().trim();

      // "Recibido": estados iniciales
      if (!raw || raw === "recibido" || raw.startsWith("recibido")) {
        grouped.RECIBIDO_FLORIDA.push(p);
        continue;
      }

      // "Check In" / "Check-In" / variantes
      if (raw === "check in" || raw === "check-in" || raw === "checkin") {
        grouped.REGISTRO.push(p);
        continue;
      }

      // "En transito" / "En tránsito" / "In-Transit" (usamos helper)
      if (isTransitStatus(p.estado || null)) {
        grouped.EN_TRANSITO.push(p);
        continue;
      }

      // "Descargado" (cualquier variante con esa palabra)
      if (raw.includes("descargado")) {
        grouped.DESCARGADO_ROATAN.push(p);
        continue;
      }

      // "Entregado" debe aparecer en Pastilla/Pickup
      if (raw.includes("entregado")) {
        grouped.PASTILLA.push(p);
        continue;
      }

      // "Pastilla" explícito
      if (raw.includes("pastilla")) {
        grouped.PASTILLA.push(p);
        continue;
      }

      // "Facturas" / "Factura"
      if (raw.includes("factura")) {
        grouped.FACTURAS.push(p);
        continue;
      }

      // Si el estado es desconocido, no lo forzamos a ninguna etapa; quedará oculto
    }

    return grouped;
  }, [packages]);

  const visiblePackages = useMemo(
    () => packagesByStage[activeStage] || [],
    [packagesByStage, activeStage],
  );

  const stageCounts = useMemo(() => {
    return {
      RECIBIDO_FLORIDA: packagesByStage.RECIBIDO_FLORIDA.length,
      REGISTRO: packagesByStage.REGISTRO.length,
      EN_TRANSITO: packagesByStage.EN_TRANSITO.length,
      DESCARGADO_ROATAN: packagesByStage.DESCARGADO_ROATAN.length,
      PASTILLA: packagesByStage.PASTILLA.length,
      FACTURAS: packagesByStage.FACTURAS.length,
    } as Record<StageId, number>;
  }, [packagesByStage]);

  const hasPackages = useMemo(() => visiblePackages.length > 0, [visiblePackages]);

  const consolidatedPackages = useMemo(
    () => packages.filter((p) => consolidatedTrackings.includes(p.tracking)),
    [packages, consolidatedTrackings],
  );

  const availablePackagesForConsolidation = useMemo(
    () =>
      visiblePackages.filter((p) => {
        // Disponibles para consolidar dentro de esta caja:
        // - Solo envíos tipo PACKAGE que están en la etapa visible (por ej. Recibido Florida)
        // - Que todavía no se hayan agregado como hijos en esta caja
        if (p.type !== "PACKAGE") return false;
        return !consolidatedTrackings.includes(p.tracking);
      }),
    [visiblePackages, consolidatedTrackings],
  );

  const currentStage = useMemo(
    () => STAGES.find((s) => s.id === activeStage) ?? STAGES[0],
    [activeStage],
  );

  const isEs = language === "es";

  const renderCheckInModal = () => {
    if (!isNextModalOpen || !selectedPackage) return null;

    return (
      <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
        <div className="ga-modal">
          <div className="ga-modal-header">
            <h4>{isEs ? "Check In del envío" : "Shipment Check In"}</h4>
            <button
              type="button"
              className="ga-icon-button ga-icon-button-light"
              onClick={handleCloseNextModal}
            >
              <i className="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>

          <div className="ga-modal-body" style={{ gap: "1rem" }}>
            {/* Resumen del envío seleccionado */}
            <div>
              <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 500 }}>
                {isEs ? "Envío seleccionado" : "Selected shipment"}
              </p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>
                {selectedPackage.tracking} · {selectedPackage.carrier || "-"}
              </p>
            </div>

            {/* Cliente */}
            <div className="ga-field-group">
              <label>{isEs ? "Cliente" : "Client"}</label>
              <select
                className="ga-input"
                value={checkInClientId}
                onChange={(e) => setCheckInClientId(e.target.value)}
              >
                <option value="">
                  {isEs ? "Seleccione un cliente" : "Select a client"}
                </option>
                {filteredClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero_cliente} - {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Dimensiones y peso reales: solo para BOX */}
            {selectedPackage.type === "BOX" && (
              <>
                <div className="ga-form-grid">
                  <div className="ga-field-group">
                    <label>{isEs ? "Alto (in)" : "Height (in)"}</label>
                    <input
                      type="number"
                      className="ga-input"
                      value={checkInHeight}
                      onChange={(e) => setCheckInHeight(e.target.value)}
                    />
                  </div>
                  <div className="ga-field-group">
                    <label>{isEs ? "Ancho (in)" : "Width (in)"}</label>
                    <input
                      type="number"
                      className="ga-input"
                      value={checkInWidth}
                      onChange={(e) => setCheckInWidth(e.target.value)}
                    />
                  </div>
                </div>

                <div className="ga-form-grid">
                  <div className="ga-field-group">
                    <label>{isEs ? "Largo (in)" : "Length (in)"}</label>
                    <input
                      type="number"
                      className="ga-input"
                      value={checkInLength}
                      onChange={(e) => setCheckInLength(e.target.value)}
                    />
                  </div>
                  <div className="ga-field-group">
                    <label>{isEs ? "Peso (lb)" : "Weight (lb)"}</label>
                    <input
                      type="number"
                      className="ga-input"
                      value={checkInRealWeight}
                      onChange={(e) => setCheckInRealWeight(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Problemas / notas */}
            <div className="ga-field-group">
              <label className="ga-checkbox-row">
                <input
                  type="checkbox"
                  checked={checkInHasProblem}
                  onChange={(e) => setCheckInHasProblem(e.target.checked)}
                />
                <span>
                  {isEs
                    ? "El paquete tiene un problema/daño"
                    : "Package has an issue/damage"}
                </span>
              </label>
            </div>

            {checkInHasProblem && (
              <div className="ga-field-group">
                <label>{isEs ? "Descripción del problema" : "Problem description"}</label>
                <textarea
                  className="ga-input"
                  rows={3}
                  value={checkInProblemNotes}
                  onChange={(e) => setCheckInProblemNotes(e.target.value)}
                />

                <div
                  style={{
                    marginTop: "0.5rem",
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="ga-secondary-button"
                    onClick={openCheckInImagePicker}
                  >
                    {isEs ? "Tomar foto del problema" : "Capture issue photo"}
                  </button>

                  {isCheckInImageUploading && (
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      {isEs ? "Subiendo imagen..." : "Uploading image..."}
                    </span>
                  )}
                </div>

                {checkInImageStatus && (
                  <p style={{ marginTop: "0.25rem", fontSize: "0.8rem", color: "#b91c1c" }}>
                    {checkInImageStatus}
                  </p>
                )}

                {checkInImageUrls.length > 0 && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      display: "flex",
                      gap: "0.25rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {checkInImageUrls.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt={isEs ? "Foto de daño" : "Damage photo"}
                        style={{
                          width: 60,
                          height: 60,
                          objectFit: "cover",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    ))}
                  </div>
                )}

                <input
                  ref={checkInImageInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleCheckInImageInputChange}
                />
              </div>
            )}

            <div className="ga-field-group">
              <label>{isEs ? "Cargos adicionales" : "Extra charges"}</label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  columnGap: "1rem",
                  rowGap: "0.25rem",
                }}
              >
                {EXTRA_CHARGE_OPTIONS.map((option) => {
                  const checked = selectedExtraCharges.includes(option);
                  return (
                    <label key={option} className="ga-checkbox-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const nextSelected = e.target.checked
                            ? [...selectedExtraCharges, option]
                            : selectedExtraCharges.filter((o) => o !== option);
                          setSelectedExtraCharges(nextSelected);
                          setCheckInExtraCharges(nextSelected.join(", "));
                        }}
                      />
                      <span>{getExtraChargeLabel(option, isEs)}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {selectedPackage.type === "BOX" && (
              <>
                <div className="ga-field-group">
                  <label className="ga-checkbox-row">
                    <input
                      type="checkbox"
                      checked={checkInConsolidation}
                      onChange={(e) => setCheckInConsolidation(e.target.checked)}
                    />
                    <span>
                      {isEs
                        ? "Este envío es una caja de consolidación"
                        : "This shipment is a consolidation box"}
                    </span>
                  </label>
                </div>

                {checkInConsolidation && (
                  <div
                    className="ga-field-group"
                    style={{ marginTop: "0.75rem" }}
                  >
                    <ConsolidacionPlayground
                      boxTracking={selectedPackage.tracking}
                      onChangeConsolidation={(children, childState) => {
                        setConsolidationChildren(children as any);
                        setConsolidationChildState(childState);
                      }}
                    />
                  </div>
                )}
              </>
            )}

          </div>

          <div
            className="ga-modal-actions"
            style={{ justifyContent: "flex-end", gap: "0.5rem" }}
          >
            <button
              type="button"
              className="ga-secondary-button"
              onClick={handleCloseNextModal}
            >
              {isEs ? "Cancelar" : "Cancel"}
            </button>
            <button
              type="button"
              className="ga-primary-button"
              onClick={handleConfirmNext}
            >
              {isEs ? "Guardar Check In" : "Save Check In"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const filteredClients = useMemo(() => {
    const term = checkInClientSearch.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) =>
      (c.nombre || "").toLowerCase().startsWith(term),
    );
  }, [clients, checkInClientSearch]);

  // Cargar lista de clientes para el desplegable de Check In
  useEffect(() => {
    const cargarClientes = async () => {
      const { data, error } = await supabase
        .from("numero_cliente")
        .select("id, nombre, numero_cliente")
        .order("numero_cliente", { ascending: false });

      if (!error && data) {
        setClients(data as any);
      }
    };

    cargarClientes();
  }, []);

  // Cargar usuario autenticado y su nombre desde la tabla "personal"
  // TEMPORAL: Deshabilitado para permitir acceso directo sin autenticación
  useEffect(() => {
    const cargarUsuario = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        // TEMPORAL: Permitir acceso sin autenticación
        setCurrentUserName("Desarrollador");
        return;
      }

      const user = data.user;

      const { data: personalRow, error: personalError } = await supabase
        .from("personal")
        .select("nombre")
        .eq("id", user.id)
        .single();

      if (personalError || !personalRow) {
        setCurrentUserName("Desarrollador");
        return;
      }

      setCurrentUserName(personalRow.nombre ?? null);
    };

    cargarUsuario();
  }, []);

  const cargarPaquetes = useCallback(async () => {
    const { data, error } = await supabase
      .from("paquetes_registro")
      .select(
        "id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, notas_imagenes, registro, descargado, entregado_por, estado, hora_fecha, fecha_descargado, fecha_entregado, numero_cliente_id, billing_subtotal, billing_tax, billing_total, approval_status, invoice_status",
      )
      .order("creado_en", { ascending: false });

    if (!error && data) {
      // Obtener conteo y relaciones de consolidación (caja -> hijos y paquete hijo -> caja)
      const { data: consData, error: consError } = await supabase
        .from("paquetes_checkin")
        .select("parent_box_id, paquete_id, numero_cliente_id, consolidacion")
        .eq("consolidacion", true)
        .not("parent_box_id", "is", null);

      const consolidationCounts: Record<string, number> = {};
      const childClientByPackageId: Record<string, string> = {};
      const childrenIdsByParentId: Record<string, string[]> = {};
      const parentBoxIdByChildId: Record<string, string> = {};
      if (!consError && consData) {
        for (const row of consData as any[]) {
          const parentKey = row.parent_box_id ? String(row.parent_box_id) : "";
          const childId = row.paquete_id ? String(row.paquete_id) : "";

          if (parentKey) {
            consolidationCounts[parentKey] = (consolidationCounts[parentKey] || 0) + 1;
          }

          if (parentKey && childId) {
            if (!childrenIdsByParentId[parentKey]) {
              childrenIdsByParentId[parentKey] = [];
            }
            childrenIdsByParentId[parentKey].push(childId);

            if (!parentBoxIdByChildId[childId]) {
              parentBoxIdByChildId[childId] = parentKey;
            }
          }

          if (childId && row.numero_cliente_id && !childClientByPackageId[childId]) {
            childClientByPackageId[childId] = String(row.numero_cliente_id);
          }
        }
      }

      // Mapas de cliente: id -> numero_cliente, nombre y email
      const clientNumberById: Record<string, number> = {};
      const clientNameById: Record<string, string> = {};
      const clientEmailById: Record<string, string> = {};
      const { data: clientes, error: clientesError } = await supabase
        .from("numero_cliente")
        .select("id, numero_cliente, nombre, email");

      if (!clientesError && clientes) {
        for (const c of clientes as any[]) {
          const key = c.id ? String(c.id) : null;
          if (!key) continue;

          if (typeof c.numero_cliente === "number") {
            clientNumberById[key] = c.numero_cliente;
          }
          if (typeof c.nombre === "string" && c.nombre.trim().length > 0) {
            clientNameById[key] = c.nombre.trim();
          }
          if (typeof c.email === "string" && c.email.trim().length > 0) {
            clientEmailById[key] = c.email.trim();
          }
        }
      }

      // Mapa id -> tracking para poder mostrar trackings consolidados
      const trackingById: Record<string, string> = {};
      for (const row of data as any[]) {
        if (row.id && row.tracking) {
          trackingById[String(row.id)] = String(row.tracking);
        }
      }

      const mapped: Package[] = data.map((row: any) => {
        // Cliente efectivo: el que viene de paquetes_registro o, si falta,
        // el heredado desde paquetes_checkin (por ejemplo, hijos consolidados).
        const rawClientId: string | null = row.numero_cliente_id || null;
        const inheritedClientId:
          | string
          | null = childClientByPackageId[row.id as string] || null;
        const effectiveClientId = rawClientId || inheritedClientId;

        const rowId = String(row.id);
        const consolidatedChildIds = childrenIdsByParentId[rowId] || [];
        const consolidatedChildrenTrackings = consolidatedChildIds
          .map((cid) => trackingById[cid])
          .filter((t) => !!t);

        const parentBoxId = parentBoxIdByChildId[rowId];
        const consolidatedIntoBoxTracking = parentBoxId
          ? trackingById[parentBoxId] || null
          : null;

        const effectiveEmail =
          effectiveClientId && clientEmailById[effectiveClientId]
            ? clientEmailById[effectiveClientId]
            : null;

        return {
          // Usamos el ID UUID tal como viene de la BD
          id: rowId,
          tracking: row.tracking,
          carrier: row.nombre_paqueteria || null,
          type: row.tipo_paquete as PackageCategoryId,
          weight: 0,
          dims: row.contenido || "-",
          obs: row.notas || "",
          registro: row.registro || null,
          descargado: row.descargado || null,
          entregadoPor: row.entregado_por || null,
          estado: row.estado || null,
          horaFecha: row.hora_fecha || null,
          fechaDescargado: row.fecha_descargado || null,
          fechaEntregado: row.fecha_entregado || null,
          numeroClienteId: effectiveClientId,
          numeroCliente:
            effectiveClientId && clientNumberById[effectiveClientId]
              ? clientNumberById[effectiveClientId]
              : null,
          clienteNombre:
            effectiveClientId && clientNameById[effectiveClientId]
              ? clientNameById[effectiveClientId]
              : null,
          clienteEmail: effectiveEmail,
          consolidatedChildrenTrackings,
          consolidatedIntoBoxTracking,
          billing_subtotal: row.billing_subtotal ?? null,
          billing_tax: row.billing_tax ?? null,
          billing_total: row.billing_total ?? null,
          approval_status: row.approval_status ?? null,
          invoice_status: row.invoice_status ?? null,
        };
      });

      setPackages(mapped);
    }
  }, []);

  useEffect(() => {
    cargarPaquetes();
  }, [cargarPaquetes]);

  useEffect(() => {
    const subscription = supabase
      .channel("gestion-almacen-paquetes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "paquetes_registro" },
        (payload) => {
          if (payload.eventType === "DELETE" && payload.old?.id) {
            setPackages((prev) => prev.filter((pkg) => pkg.id !== payload.old.id));
            return;
          }
          cargarPaquetes();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [cargarPaquetes]);

  useEffect(() => {
    const interval = setInterval(() => {
      cargarPaquetes();
    }, 6000);

    return () => clearInterval(interval);
  }, [cargarPaquetes]);

  // Escáner para descarga en Roatán (buscar paquetes en tránsito y marcarlos como descargados)
  useEffect(() => {
    if (!isUnloadScannerOpen || isUnloadQrMode) {
      if (unloadScannerRef.current) {
        try {
          const instance: any = unloadScannerRef.current;
          instance.stop?.().catch(() => {});
          instance.clear?.().catch(() => {});
        } catch {
          // ignorar errores al cerrar el escáner
        }
        unloadScannerRef.current = null;
      }
      return;
    }

    const elementId = "ga-unload-scanner-container";

    const html5QrCode: any = new Html5Qrcode(elementId);
    unloadScannerRef.current = html5QrCode;

    const unloadConfig: any = {
      fps: 10,
      // Igual que arriba: escanear todo el frame, soportando varios formatos 1D
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
    };

    html5QrCode
      .start(
        { facingMode: "environment" },
        unloadConfig,
        async (decodedText: string) => {
          const text = decodedText.trim();
          if (!text) return;

          setIsUnloadScannerOpen(false);

          const trackingValue = text.toUpperCase();

          const { data, error } = await supabase
            .from("paquetes_registro")
            .select("id, tracking, estado")
            .eq("tracking", trackingValue);

          if (error) {
            alert(
              error.message ||
                (isEs
                  ? "Error buscando el paquete escaneado"
                  : "Error searching scanned package"),
            );
            return;
          }

          if (!data || data.length === 0) {
            alert(
              isEs
                ? "No se encontró ningún paquete con ese tracking"
                : "No package found with that tracking",
            );
            return;
          }

          if (data.length > 1) {
            alert(
              isEs
                ? "Hay más de un paquete con este tracking en el sistema. Revisa y corrige los duplicados antes de marcarlo como descargado."
                : "There is more than one package with this tracking in the system. Please review and fix the duplicates before marking it as unloaded.",
            );
            return;
          }

          const row = data[0] as any;

          if (!isTransitStatus(row.estado)) {
            alert(
              isEs
                ? "Este envío no está en tránsito"
                : "This shipment is not in transit",
            );
            return;
          }

          const now = new Date();
          const isoNow = now.toISOString();
          const timeStr = isoNow.substring(11, 19);

          const { error: updateError } = await supabase
            .from("paquetes_registro")
            .update({
              estado: "Descargado (Roatan)",
              descargado: currentUserName,
              fecha_descargado: isoNow,
              hora_descargado: timeStr,
            })
            .eq("tracking", row.tracking);

          if (updateError) {
            alert(
              updateError.message ||
                (isEs
                  ? "No se pudo marcar el paquete como descargado"
                  : "Could not mark package as unloaded"),
            );
            return;
          }

          setPackages((prev) =>
            prev.map((p) =>
              p.tracking === row.tracking
                ? {
                    ...p,
                    estado: "Descargado (Roatan)",
                  }
                : p,
            ),
          );

          setIsUnloadModalOpen(false);
        },
        () => {
          // errores de escaneo individuales: se ignoran
        },
      )
      .catch((err: unknown) => {
        console.error("Error iniciando el escáner de descarga", err);
        alert(
          isEs
            ? "No se pudo acceder a la cámara para descarga. Revisa los permisos del navegador."
            : "Could not access the camera for unload scan. Check browser permissions.",
        );
        setIsUnloadScannerOpen(false);
      });

    return () => {
      if (unloadScannerRef.current) {
        const instance: any = unloadScannerRef.current;
        instance
          .stop?.()
          .then(() => instance.clear?.().catch(() => {}))
          .catch(() => {})
          .finally(() => {
            unloadScannerRef.current = null;
          });
      }
    };
  }, [isUnloadScannerOpen, isUnloadQrMode, isEs]);

  const handleOpenNextModal = (pkg: Package) => {
    setSelectedPackage(pkg);
    setIsEditingCheckIn(false);
    // Limpiar campos del formulario de Check In cada vez
    setCheckInClientId("");
    setCheckInClientSearch("");
    setCheckInHeight("");
    setCheckInWidth("");
    setCheckInLength("");
    setCheckInRealWeight("");
    setCheckInHasProblem(false);
    setCheckInProblemNotes("");
    setCheckInExtraCharges("");
    setSelectedExtraCharges([]);
    setCheckInConsolidation(false);
    setConsolidatedTrackings([]);
    setCheckInImageUrls([]);
    setCheckInImageStatus(null);
    setIsCheckInImageUploading(false);
    if (checkInImageInputRef.current) {
      checkInImageInputRef.current.value = "";
    }
    setIsNextModalOpen(true);
  };

  const handleOpenEditCheckIn = async (pkg: any) => {
    // pkg viene tipado como StageCheckInPackage; buscamos el Package completo
    const full = packages.find((p) => p.id === (pkg.id as any));
    const basePackage = full || (pkg as Package);
    setSelectedPackage(basePackage);
    setIsEditingCheckIn(true);

    // Cargar el último registro de paquetes_checkin para este paquete
    try {
      const { data, error } = await supabase
        .from("paquetes_checkin")
        .select(
          "alto, ancho, largo, peso, problema, problema_notas, cargos_adicionales, consolidacion",
        )
        .eq("paquete_id", basePackage.id)
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setCheckInHeight((data as any).alto != null ? String((data as any).alto) : "");
        setCheckInWidth((data as any).ancho != null ? String((data as any).ancho) : "");
        setCheckInLength((data as any).largo != null ? String((data as any).largo) : "");
        setCheckInRealWeight(
          (data as any).peso != null ? String((data as any).peso) : "",
        );
        const hasProblem = Boolean((data as any).problema);
        setCheckInHasProblem(hasProblem);
        setCheckInProblemNotes((data as any).problema_notas || "");
        const extra = (data as any).cargos_adicionales || "";
        setCheckInExtraCharges(extra);
        if (extra && typeof extra === "string") {
          const parsed = extra
            .split(",")
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);
          setSelectedExtraCharges(parsed);
        } else {
          setSelectedExtraCharges([]);
        }
        setCheckInConsolidation(Boolean((data as any).consolidacion));
      } else {
        // Si no hay registro previo, dejamos campos vacíos pero seguimos en modo edición
        setCheckInHeight("");
        setCheckInWidth("");
        setCheckInLength("");
        setCheckInRealWeight("");
        setCheckInHasProblem(false);
        setCheckInProblemNotes("");
        setCheckInExtraCharges("");
        setSelectedExtraCharges([]);
        setCheckInConsolidation(false);
      }
    } catch {
      // Si algo falla, dejamos los campos como están
    }

    setIsNextModalOpen(true);
  };

  const handleOpenTransitModal = (pkg: Package) => {
    setSelectedPackage(pkg);
    setIsTransitModalOpen(true);
  };

  const addPackageToConsolidation = (tracking: string) => {
    if (!tracking) return;
    setConsolidatedTrackings((prev) =>
      prev.includes(tracking) ? prev : [...prev, tracking],
    );
    setChildCheckInData((prev) => ({
      ...prev,
      [tracking]: prev[tracking] ? prev[tracking] : { ...DEFAULT_CHILD_CHECKIN },
    }));
    setCheckInChildPackages((prev) => {
      if (prev.some((p) => p.tracking === tracking)) return prev;
      const pkg = packages.find((p) => p.tracking === tracking);
      return pkg ? [...prev, pkg] : prev;
    });
  };

  const removePackageFromConsolidation = (tracking: string) => {
    setConsolidatedTrackings((prev) => prev.filter((t) => t !== tracking));
    setCheckInChildPackages((prev) => prev.filter((p) => p.tracking !== tracking));
    setChildCheckInData((prev) => {
      const next = { ...prev };
      delete next[tracking];
      return next;
    });
    setChildImageState((prev) => {
      const next = { ...prev };
      delete next[tracking];
      return next;
    });
    delete childImageRefs.current[tracking];
  };

  const handleCloseNextModal = () => {
    setIsNextModalOpen(false);
    setSelectedPackage(null);
    setCheckInImageUrls([]);
    setCheckInImageStatus(null);
    setIsCheckInImageUploading(false);
    setConsolidatedTrackings([]);
    setChildCheckInData({});
    setChildImageState({});
    setCheckInChildPackages([]);
    if (checkInImageInputRef.current) {
      checkInImageInputRef.current.value = "";
    }
  };

  const handleCloseTransitModal = () => {
    setIsTransitModalOpen(false);
    setSelectedPackage(null);
  };

  const handleCheckInImageInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    if (!selectedPackage) {
      setCheckInImageStatus(
        isEs
          ? "Elige un paquete antes de tomar fotos"
          : "Select a package before taking photos",
      );
      return;
    }

    setIsCheckInImageUploading(true);
    setCheckInImageStatus(
      isEs ? "Subiendo imagen..." : "Uploading image...",
    );

    let capturedError: string | null = null;
    const basePath = `notas-imagenes/${selectedPackage.tracking || selectedPackage.id}`;

    for (const file of files) {
      const extension =
        file.name.split(".").pop()?.toLowerCase() ||
        file.type.split("/").pop() ||
        "jpg";
      const filePath = `${basePath}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error } = await supabase
        .storage
        .from("notas-imagenes")
        .upload(filePath, file, { upsert: true });

      if (error) {
        capturedError =
          error.message ||
          (isEs
            ? "No se pudo subir la foto"
            : "Could not upload the photo");
        break;
      }

      const { data } = supabase
        .storage
        .from("notas-imagenes")
        .getPublicUrl(filePath);

      if (data?.publicUrl) {
        setCheckInImageUrls((prev) => [...prev, data.publicUrl]);
      }
    }

    setIsCheckInImageUploading(false);
    setCheckInImageStatus(capturedError);
    if (!capturedError) {
      setCheckInImageStatus(null);
    }

    if (event.target) {
      event.target.value = "";
    }
  };

  const openCheckInImagePicker = () => {
    checkInImageInputRef.current?.click();
  };

  const updateChildCheckInField = (
    tracking: string,
    field:
      | "height"
      | "width"
      | "length"
      | "weight"
      | "hasProblem"
      | "problemNotes"
      | "clientId",
    value: string | boolean,
  ) => {
    setChildCheckInData((prev) => {
      const current = prev[tracking] ?? { ...DEFAULT_CHILD_CHECKIN };
      const next = {
        ...current,
        [field]: value,
      } as (typeof DEFAULT_CHILD_CHECKIN) & {
        [key: string]: any;
      };
      return { ...prev, [tracking]: next };
    });
  };

  const handleChildImageChange = async (
    tracking: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setChildImageState((prev) => ({
      ...prev,
      [tracking]: {
        ...(prev[tracking] || { urls: [], status: null, uploading: false }),
        uploading: true,
        status: null,
      },
    }));

    const basePath = `notas-imagenes/${selectedPackage?.tracking || "consolidated-box"}/${tracking}`;
    let newUrls: string[] = [];
    let errorOccurred: string | null = null;

    for (const file of files) {
      const extension =
        file.name.split(".").pop()?.toLowerCase() ||
        file.type.split("/").pop() ||
        "jpg";
      const filePath = `${basePath}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error } = await supabase
        .storage
        .from("notas-imagenes")
        .upload(filePath, file, { upsert: true });

      if (error) {
        errorOccurred =
          error.message ||
          (isEs
            ? "No se pudo subir la foto del paquete"
            : "Could not upload the package photo");
        break;
      }

      const { data } = supabase.storage.from("notas-imagenes").getPublicUrl(filePath);
      if (data?.publicUrl) {
        newUrls.push(data.publicUrl);
      }
    }

    setChildImageState((prev) => ({
      ...prev,
      [tracking]: {
        urls: [...(prev[tracking]?.urls || []), ...newUrls],
        status: errorOccurred,
        uploading: false,
      },
    }));

    if (event.target) {
      event.target.value = "";
    }
  };

  const openChildImagePicker = (tracking: string) => {
    const ref = childImageRefs.current[tracking];
    ref?.click();
  };

  const fetchPedidoById = async (id: string | null) => {
    if (!id) {
      setQrError("Ingresa un ID de pedido");
      return;
    }
    setQrLoading(true);
    setQrError(null);
    try {
      const resp = await fetch(`/api/pedidos/${id}`);
      if (!resp.ok) {
        const json = await resp.json();
        throw new Error(json.error || "No se pudo cargar el pedido");
      }
      const json = await resp.json();
      setQrPedido(json.pedido);
      setQrIdentifier(id);
      return json.pedido;
    } catch (err: any) {
      setQrError(err.message || "Error consultando pedido");
      setQrPedido(null);
    } finally {
      setQrLoading(false);
    }
  };

  const extractPedidoIdFromText = (text: string) => {
    const regex = /pedidos\/([a-f0-9-]+)/i;
    const match = text.match(regex);
    if (match) return match[1];
    return null;
  };

  const stopPickupScanner = () => {
    setPickupScannerActive(false);
    if (pickupScannerRef.current) {
      try {
        const instance: any = pickupScannerRef.current;
        instance.stop?.().catch(() => {});
        instance.clear?.().catch(() => {});
      } catch {
        // ignorar errores al cerrar el escáner de retiro
      }
      pickupScannerRef.current = null;
    }
  };

  const actualizarEstadoDesdeQr = useCallback(
    async (pedidoId: string | number, estado: "Descargado" | "Entregado") => {
      const idStr = String(pedidoId);
      const resp = await fetch(`/api/pedidos/${idStr}/estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, usuario: currentUserName || "admin" }),
      });

      if (!resp.ok) {
        const json = await resp.json();
        setQrError(json.error || "No se pudo actualizar el estado");
        return;
      }
      const pedidoActualizado = await fetchPedidoById(idStr);
      const now = new Date();
      const nowIso = now.toISOString();
      const timeStr = nowIso.substring(11, 19);

      // Si tenemos tracking desde el pedido QR, lo usamos para actualizar la fila
      // correspondiente en paquetes_registro. Esto funciona tanto para código de
      // barras como para QR Caribex, ya que ambos se basan en el tracking.
      const trackingClave = (pedidoActualizado?.tracking || qrPedido?.tracking || "")
        .toString()
        .toUpperCase();

      if (!trackingClave) {
        // Sin tracking no podemos sincronizar el estado en paquetes_registro.
        // En ese caso nos quedamos solo con la actualización del API.
        cargarPaquetes();
        return;
      }

      const { error } = await supabase
        .from("paquetes_registro")
        .update({
          estado: estado === "Entregado" ? "Entregado" : "Descargado",
          entregado_por: currentUserName,
          fecha_entregado: estado === "Entregado" ? nowIso : null,
          hora_entregado: estado === "Entregado" ? timeStr : null,
        })
        .eq("tracking", trackingClave);

      if (error) {
        console.error("Error actualizando paquetes_registro desde QR", error);
        setQrError(
          error.message ||
            (isEs
              ? "No se pudo actualizar el estado en la tabla de almacén"
              : "Could not update status in warehouse table"),
        );
        return;
      }

      cargarPaquetes();
    },
    [currentUserName, fetchPedidoById, cargarPaquetes, qrPedido, isEs],
  );

  const handlePickupDecoded = useCallback(
    async (decodedText: string) => {
      const text = decodedText.trim();
      if (!text) return;

      console.log("[Pickup] Decoded value", { decodedText, text });

      // Siempre tratamos el valor decodificado como TRACKING.
      // Esto aplica tanto para el código de barras como para el QR Caribex,
      // ya que en ambos flujos terminamos guardando el tracking en
      // pendingQrTracking.
      const { data, error } = await supabase
        .from("paquetes_registro")
        .select("id, estado, tracking")
        .ilike("tracking", `%${text}%`)
        .maybeSingle();

      console.log("[Pickup] Supabase select result", { data, error });

      if (error || !data?.id) {
        setQrError(isEs ? "Pedido no encontrado" : "Shipment not found");
        setQrPedido(null);
        return;
      }

      const rawEstado = (data.estado || "").toLowerCase();
      if (
        rawEstado !== "descargado" &&
        rawEstado !== "descargado (roatan)" &&
        !rawEstado.includes("descargado")
      ) {
        setQrError(
          isEs
            ? "El pedido no está en estado Descargado"
            : "Shipment is not in Descargado status",
        );
        setQrPedido(null);
        return;
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const timeStr = nowIso.substring(11, 19);

      const { error: updError } = await supabase
        .from("paquetes_registro")
        .update({
          estado: "Entregado",
          entregado_por: currentUserName,
          fecha_entregado: nowIso,
          hora_entregado: timeStr,
        })
        .eq("id", data.id);

      if (updError) {
        console.error("[Pickup] Error actualizando paquetes_registro", updError);
        setQrError(
          updError.message ||
            (isEs
              ? "No se pudo actualizar el estado en la tabla de almacén"
              : "Could not update status in warehouse table"),
        );
        return;
      }

      console.log("[Pickup] Update OK, recargando paquetes", {
        id: data.id,
        tracking: data.tracking,
      });

      cargarPaquetes();
      stopPickupScanner();
      setIsQrModalOpen(false);
      setPendingQrTracking("");
      setQrError(null);
      setQrPedido(null);
    },
    [cargarPaquetes, currentUserName, isEs, stopPickupScanner],
  );

  const handleCaribexQrResult = useCallback(
    async (payload: CaribexPayload) => {
      // Prioridad: usar id si viene; si no, usar tracking
      let pedidoId: string | null = payload.id ?? null;

      if (!pedidoId && payload.tracking) {
        const { data, error } = await supabase
          .from("paquetes_registro")
          .select("id, estado")
          .eq("tracking", payload.tracking.toUpperCase())
          .maybeSingle();

        if (error || !data?.id) {
          setQrError(isEs ? "Pedido no encontrado" : "Shipment not found");
          setQrPedido(null);
          return;
        }

        if (
          data.estado?.toLowerCase() !== "descargado" &&
          data.estado?.toLowerCase() !== "descargado (roatan)"
        ) {
          setQrError(
            isEs
              ? "El pedido no está en estado Descargado"
              : "Shipment is not in Descargado status",
          );
          setQrPedido(null);
          return;
        }

        pedidoId = String(data.id);
      }

      if (!pedidoId) {
        setQrError(
          isEs ? "QR sin ID de pedido válido" : "QR without valid shipment id",
        );
        setQrPedido(null);
        return;
      }

      const pedido = await fetchPedidoById(pedidoId);
      if (
        pedido &&
        pedido.estado &&
        pedido.estado.toLowerCase().includes("descargado")
      ) {
        // Guardamos el pedido encontrado; el escáner QR propio ya se detuvo
        // dentro de EscanerQRCaribex. Dejamos el modal abierto para que el
        // usuario confirme y usamos el tracking del pedido/QR para luego
        // reutilizar la misma lógica de handlePickupDecoded.
        setQrPedido(pedido);
        const trackingFromPedido = (pedido.tracking || payload.tracking || "").toString();
        setPendingQrTracking(trackingFromPedido.trim());
      }
    },
    [fetchPedidoById, actualizarEstadoDesdeQr, isEs],
  );

  useEffect(() => {
    if (!pickupScannerActive) {
      if (pickupScannerRef.current) {
        try {
          const instance: any = pickupScannerRef.current;
          instance.stop?.().catch(() => {});
          instance.clear?.().catch(() => {});
        } catch {
          // ignorar errores
        }
        pickupScannerRef.current = null;
      }
      return;
    }

    const elementId = "ga-pickup-scanner-container";
    const html5QrCode: any = new Html5Qrcode(elementId);
    pickupScannerRef.current = html5QrCode;

    const config: any = {
      fps: 10,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
    };

    html5QrCode
      .start(
        { facingMode: "environment" },
        config,
        (decodedText: string) => {
          handlePickupDecoded(decodedText);
        },
        () => {},
      )
      .catch((err: unknown) => {
        console.error("Error pickup scanner", err);
        setQrError("No se pudo acceder a la cámara");
        setPickupScannerActive(false);
      });

    return () => {
      if (pickupScannerRef.current) {
        const instance: any = pickupScannerRef.current;
        instance
          .stop?.()
          .then(() => instance.clear?.().catch(() => {}))
          .catch(() => {})
          .finally(() => {
            pickupScannerRef.current = null;
          });
      }
    };
  }, [pickupScannerActive, handlePickupDecoded, isEs]);

  const handleConfirmNext = async () => {
    if (!selectedPackage) return;

    if (!checkInClientId) {
      setMessageModal({
        title: isEs ? "Aviso" : "Notice",
        message: isEs ? "Seleccione un cliente" : "Select a client",
      });
      return;
    }

    // Validaciones de consolidación para paquetes hijos
    if (checkInConsolidation) {
      const missingDimensions = [
        { label: isEs ? "alto" : "height", value: checkInHeight },
        { label: isEs ? "ancho" : "width", value: checkInWidth },
        { label: isEs ? "largo" : "length", value: checkInLength },
        { label: isEs ? "peso real" : "real weight", value: checkInRealWeight },
      ].filter(({ value }) => !value.trim());

      if (missingDimensions.length > 0) {
        const labels = missingDimensions.map((field) => field.label).join(", ");
        setMessageModal({
          title: isEs ? "Aviso" : "Notice",
          message: isEs
            ? `Completa los campos de ${labels} antes de consolidar.`
            : `Fill the following fields before consolidating: ${labels}.`,
        });
        return;
      }

      for (const pkg of consolidatedPackages) {
        const data = childCheckInData[pkg.tracking];
        if (!data) {
          setMessageModal({
            title: isEs ? "Aviso" : "Notice",
            message: isEs
              ? `Completa los datos de check-in para el paquete ${pkg.tracking}.`
              : `Complete the check-in data for package ${pkg.tracking}.`,
          });
          return;
        }

        const missing = [
          { label: CHILD_FIELD_LABELS.height[isEs ? "es" : "en"], value: data.height },
          { label: CHILD_FIELD_LABELS.width[isEs ? "es" : "en"], value: data.width },
          { label: CHILD_FIELD_LABELS.length[isEs ? "es" : "en"], value: data.length },
          { label: CHILD_FIELD_LABELS.weight[isEs ? "es" : "en"], value: data.weight },
        ].filter(({ value }) => !value.trim());

        if (missing.length > 0) {
          const labels = missing.map((field) => field.label).join(", ");
          setMessageModal({
            title: isEs ? "Aviso" : "Notice",
            message: isEs
              ? `Completa los campos ${labels} para el paquete ${pkg.tracking}.`
              : `Fill ${labels} for package ${pkg.tracking}.`,
          });
          return;
        }

        if (data.hasProblem && !data.problemNotes.trim()) {
          setMessageModal({
            title: isEs ? "Aviso" : "Notice",
            message: isEs
              ? `Describe el problema del paquete ${pkg.tracking}.`
              : `Describe the problem for package ${pkg.tracking}.`,
          });
          return;
        }

        const childImgs = childImageState[pkg.tracking];
        if (data.hasProblem && (!childImgs || !childImgs.urls || childImgs.urls.length === 0)) {
          setMessageModal({
            title: isEs ? "Aviso" : "Notice",
            message: isEs
              ? `Agrega al menos una foto del daño para el paquete ${pkg.tracking}.`
              : `Add at least one damage photo for package ${pkg.tracking}.`,
          });
          return;
        }
      }
    }

    if (checkInHasProblem && !checkInProblemNotes.trim()) {
      setMessageModal({
        title: isEs ? "Aviso" : "Notice",
        message: isEs
          ? "Describe el problema cuando marcas que hay un daño."
          : "Describe the problem if you mark the package as damaged.",
      });
      return;
    }

    if (checkInHasProblem && checkInImageUrls.length === 0) {
      setMessageModal({
        title: isEs ? "Aviso" : "Notice",
        message: isEs
          ? "Agrega al menos una foto del daño antes de continuar."
          : "Add at least one damage photo before continuing.",
      });
      return;
    }

    // Asegurar que tenemos un ID de paquete válido (UUID); si no, buscarlo por tracking
    let mainPackageId: string | null = selectedPackage.id;
    if (!mainPackageId && selectedPackage.tracking) {
      const { data: pkgRow } = await supabase
        .from("paquetes_registro")
        .select("id")
        .eq("tracking", selectedPackage.tracking)
        .maybeSingle();
      if (pkgRow?.id) {
        mainPackageId = pkgRow.id as string;
      }
    }

    if (!mainPackageId) {
      setMessageModal({
        title: isEs ? "Error" : "Error",
        message: isEs
          ? "No se encontró el ID interno para el envío seleccionado al guardar el Check In."
          : "Internal ID for the selected shipment was not found when saving Check-In.",
      });
      return;
    }

    // Guardar registro de Check In relacionado al paquete y al cliente
    const { error: insertCheckInError } = await supabase
      .from("paquetes_checkin")
      .insert({
        paquete_id: mainPackageId,
        // cliente principal seleccionado en el modal de Check In
        numero_cliente_id: checkInClientId || null,
        alto: checkInHeight ? Number(checkInHeight) : null,
        ancho: checkInWidth ? Number(checkInWidth) : null,
        largo: checkInLength ? Number(checkInLength) : null,
        peso: checkInRealWeight ? Number(checkInRealWeight) : null,
        problema: checkInHasProblem,
        problema_notas: checkInProblemNotes || null,
        cargos_adicionales: checkInExtraCharges || null,
        consolidacion: checkInConsolidation,
      });

    if (insertCheckInError) {
      setMessageModal({
        title: isEs ? "Error" : "Error",
        message:
          insertCheckInError.message ||
          (isEs
            ? "No se pudo guardar la información de Check In"
            : "Could not save Check In information"),
      });
      return;
    }

    const updatePayload: any = {
      estado: "Check In",
      // guardar también el cliente seleccionado en paquetes_registro
      numero_cliente_id: checkInClientId || null,
      notas: checkInProblemNotes || null,
    };

    if (checkInImageUrls.length > 0) {
      updatePayload.notas_imagenes = checkInImageUrls;
    } else {
      updatePayload.notas_imagenes = null;
    }

    const { error } = await supabase
      .from("paquetes_registro")
      .update(updatePayload)
      .eq("tracking", selectedPackage.tracking);

    if (error) {
      setMessageModal({
        title: isEs ? "Error" : "Error",
        message:
          error.message ||
          (isEs
            ? "No se pudo actualizar el estado del envío"
            : "Could not update shipment status"),
      });
      return;
    }

    if (checkInConsolidation) {
      // Preferimos los hijos enviados desde el componente ConsolidacionPlayground
      // (modo inline con datos cargados desde la BD). Si por alguna razón no hay,
      // usamos el mecanismo anterior basado en consolidatedPackages.
      if (consolidationChildren.length > 0) {
        for (const child of consolidationChildren) {
          const childStateForId =
            consolidationChildState && consolidationChildState[child.id]
              ? (consolidationChildState[child.id] as any)
              : null;
          let childId: string | null = child.id;

          // Si no tenemos id en memoria, lo buscamos por tracking
          if (!childId && child.tracking) {
            const { data: childRow } = await supabase
              .from("paquetes_registro")
              .select("id")
              .eq("tracking", child.tracking)
              .maybeSingle();
            if (childRow?.id) {
              childId = childRow.id as string;
            }
          }

          if (!childId) {
            alert(
              isEs
                ? `No se encontró el ID interno para el paquete ${child.tracking}.`
                : `Internal ID not found for package ${child.tracking}.`,
            );
            return;
          }

          const { error: childError } = await supabase
            .from("paquetes_checkin")
            .insert({
              paquete_id: childId,
              parent_box_id: mainPackageId,
              // los hijos heredan siempre el mismo cliente que la caja principal
              numero_cliente_id: checkInClientId || null,
              alto: childStateForId?.height
                ? Number(childStateForId.height)
                : null,
              ancho: childStateForId?.width
                ? Number(childStateForId.width)
                : null,
              largo: childStateForId?.length
                ? Number(childStateForId.length)
                : null,
              peso: childStateForId?.weight
                ? Number(childStateForId.weight)
                : null,
              problema: !!childStateForId?.hasProblem,
              problema_notas:
                childStateForId?.hasProblem && childStateForId?.problemNotes
                  ? childStateForId.problemNotes
                  : null,
              cargos_adicionales: null,
              consolidacion: true,
            });

          if (childError) {
            alert(
              childError.message ||
                (isEs
                  ? "No se pudo guardar el Check In del paquete consolidado"
                  : "Could not save the consolidated package check-in"),
            );
            return;
          }

          // Preparar payload de actualización para el paquete hijo en paquetes_registro
          const childUpdatePayload: any = {
            estado: "Check In",
            // los hijos heredan el mismo cliente que la caja principal
            numero_cliente_id: checkInClientId || null,
            // Copiamos también la nota de problema para que se vea en la columna NOTE
            notas:
              childStateForId?.hasProblem && childStateForId?.problemNotes
                ? childStateForId.problemNotes
                : null,
          };

          // Si el hijo tiene imágenes de problema cargadas en la consolidación,
          // las copiamos al campo notas_imagenes del registro principal.
          if (
            childStateForId?.imageUrls &&
            Array.isArray(childStateForId.imageUrls) &&
            childStateForId.imageUrls.length > 0
          ) {
            childUpdatePayload.notas_imagenes = childStateForId.imageUrls;
          }

          const { error: secondUpdateError } = await supabase
            .from("paquetes_registro")
            .update(childUpdatePayload)
            .eq("tracking", child.tracking);

          if (secondUpdateError) {
            alert(
              secondUpdateError.message ||
                (isEs
                  ? "No se pudo actualizar el estado de un paquete consolidado"
                  : "Could not update the state of a consolidated package"),
            );
            return;
          }

          // Reflejar inmediatamente las imágenes de problema en el estado local
          // para que el modal de "Ver" del paquete hijo las pueda mostrar.
          if (
            childStateForId?.imageUrls &&
            Array.isArray(childStateForId.imageUrls) &&
            childStateForId.imageUrls.length > 0
          ) {
            setPackages((prev) =>
              prev.map((p) =>
                p.tracking === child.tracking
                  ? {
                      ...p,
                      notas_imagenes: childStateForId.imageUrls,
                    }
                  : p,
              ),
            );
          }
        }
      } else if (consolidatedPackages.length > 0) {
        // Respaldo: comportamiento anterior basado en consolidatedPackages
        for (const pkg of consolidatedPackages) {
          const data = childCheckInData[pkg.tracking];

          // Si por alguna razón no tenemos ID interno, no intentamos insertar
          if (!pkg.id) {
            alert(
              isEs
                ? `No se encontró el ID interno para el paquete ${pkg.tracking}.`
                : `Internal ID not found for package ${pkg.tracking}.`,
            );
            return;
          }

          const { error: childError } = await supabase
            .from("paquetes_checkin")
            .insert({
              paquete_id: pkg.id,
              // relacionar hijo con la caja principal para poder contar consolidación
              parent_box_id: mainPackageId,
              // los hijos heredan el mismo cliente que la caja principal
              numero_cliente_id:
                checkInClientId || (pkg as any)?.numeroClienteId || null,
              alto: Number((data as any)?.height) || null,
              ancho: Number((data as any)?.width) || null,
              largo: Number((data as any)?.length) || null,
              peso: Number((data as any)?.weight) || null,
              problema: (data as any)?.hasProblem || false,
              problema_notas:
                (data as any)?.hasProblem && (data as any)?.problemNotes
                  ? (data as any)?.problemNotes
                  : null,
              cargos_adicionales: null,
              consolidacion: true,
            });

          if (childError) {
            alert(
              childError.message ||
                (isEs
                  ? "No se pudo guardar el Check In del paquete consolidado"
                  : "Could not save the consolidated package check-in"),
            );
            return;
          }

          const { error: secondUpdateError } = await supabase
            .from("paquetes_registro")
            .update({
              estado: "Check In",
              // los hijos heredan el mismo cliente que la caja principal
              numero_cliente_id:
                checkInClientId || (pkg as any)?.numeroClienteId || null,
            })
            .eq("tracking", pkg.tracking);

          if (secondUpdateError) {
            alert(
              secondUpdateError.message ||
                (isEs
                  ? "No se pudo actualizar el estado de un paquete consolidado"
                  : "Could not update the state of a consolidated package"),
            );
            return;
          }
        }
      }
    }

    setPackages((prev) =>
      prev.map((p) =>
        p.id === selectedPackage.id
          ? {
              ...p,
              estado: "Check In",
            }
          : p,
      ),
    );

    if (checkInConsolidation) {
      const childTrackings =
        consolidationChildren.length > 0
          ? consolidationChildren.map((c) => c.tracking)
          : consolidatedTrackings;

      if (childTrackings.length > 0) {
        setPackages((prev) =>
          prev.map((p) =>
            childTrackings.includes(p.tracking)
              ? {
                  ...p,
                  estado: "Check In",
                }
              : p,
          ),
        );
      }
    }

    handleCloseNextModal();
  };

const handleConfirmTransit = async () => {
  if (!selectedPackage) return;

  const { error } = await supabase
    .from("paquetes_registro")
    .update({ estado: "En transito" })
    .eq("tracking", selectedPackage.tracking);

  if (error) {
    alert(
      error.message ||
        (isEs
          ? "No se pudo mover el envío a En tránsito"
          : "Could not move shipment to In-Transit"),
    );
    return;
  }

  setPackages((prev) =>
    prev.map((p) =>
      p.id === selectedPackage.id
        ? {
            ...p,
            estado: "En transito",
          }
        : p,
    ),
  );

  handleCloseTransitModal();
};

const handlePackageCreated = (pkg: Package) => {
  setPackages((prev) => [pkg, ...prev]);
};
  const handleBulkTransitFromCheckIn = async () => {
    const checkInPackages = packagesByStage.REGISTRO;
    if (!checkInPackages.length) {
      alert(
        isEs
          ? "No hay envíos en Check In para mover a En tránsito."
          : "There are no Check In shipments to move to In-Transit.",
      );
      return;
    }

    const confirmText = isEs
      ? `¿Crear un contenedor y mover ${checkInPackages.length} envío(s) de Check In a En tránsito?`
      : `Create a container and move ${checkInPackages.length} shipment(s) from Check In to In-Transit?`;

    if (!window.confirm(confirmText)) return;

    const ids = checkInPackages.map((p) => p.id);

    // 1) Crear un contenedor nuevo con un código autogenerado
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    const codigoContenedor = `CONT-${datePart}-${randomPart}`;

    const { data: contData, error: contError } = await supabase
      .from("contenedores")
      .insert({ codigo: codigoContenedor })
      .select("id, codigo")
      .single();

    if (contError || !contData) {
      alert(
        (contError && contError.message) ||
          (isEs
            ? "No se pudo crear el contenedor para En tránsito"
            : "Could not create container for In-Transit"),
      );
      return;
    }

    const contenedorId = (contData as any).id as string;

    // 2) Relacionar cada paquete con el contenedor
    const relaciones = checkInPackages.map((p) => ({
      contenedor_id: contenedorId,
      paquete_id: p.id,
    }));

    const { error: relError } = await supabase
      .from("contenedor_paquetes")
      .insert(relaciones as any[]);

    if (relError) {
      alert(
        relError.message ||
          (isEs
            ? "No se pudieron asociar los envíos al contenedor"
            : "Could not associate shipments to container"),
      );
      return;
    }

    // 3) Actualizar el estado de los paquetes a En transito
    const { error } = await supabase
      .from("paquetes_registro")
      .update({
        estado: "En transito",
        fecha_transito: now.toISOString(),
      })
      .in("id", ids as any);

    if (error) {
      alert(
        error.message ||
          (isEs
            ? "No se pudieron mover los envíos a En tránsito"
            : "Could not move shipments to In-Transit"),
      );
      return;
    }

    // 4) Reflejar cambio en el estado local
    setPackages((prev) =>
      prev.map((p) =>
        ids.includes(p.id)
          ? {
              ...p,
              estado: "En transito",
            }
          : p,
      ),
    );

    // Más adelante podemos usar codigoContenedor para mostrarlo en la etapa En-Transito
  };

  return (
    <div className="ga-page-wrapper">
      <header className="ga-nav">
        <div className="ga-nav-inner">
          <div className="ga-nav-brand">
            <div className="ga-nav-logo">
              <Image
                src="/imagenes/logo-trimmed.png"
                alt="Caribex Logistics Group"
                width={40}
                height={40}
              />
            </div>
            <div className="ga-nav-text">
              <span className="ga-nav-title-main">Caribex</span>
              <span className="ga-nav-title-sub">
                {isEs ? "Grupo logístico" : "Logistics group"}
              </span>
            </div>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <button
              type="button"
              className="ga-lang-button"
              onClick={() => setLanguage((prev) => (prev === "es" ? "en" : "es"))}
            >
              <Globe2 size={16} />
              <span>{language.toUpperCase()}</span>
            </button>
            <button
              type="button"
              className="ga-lang-button"
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
            >
              <span>{isEs ? "Cerrar sesión" : "Log out"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="ga-main">
        <div className="ga-main-header">
          <div>
            <h1 className="ga-page-title">
              {isEs ? "Gestión de almacén" : "Warehouse management"}
            </h1>
            <p className="ga-page-subtitle">
              {isEs
                ? "Rastrear y gestionar los envíos en todas las etapas"
                : "Track and manage shipments across all stages"}
            </p>
          </div>
        </div>

        <div className="ga-stages-row">
          {STAGES.map((stage) => (
            <button
              key={stage.id}
              type="button"
              className={
                "ga-stage-chip" +
                (activeStage === stage.id ? " ga-stage-chip-active" : "")
              }
              onClick={() => setActiveStage(stage.id)}
            >
              <span className="ga-stage-icon">{stage.icon}</span>

              <span className="ga-stage-label">{getStageLabel(stage.id, isEs)}</span>
              {stage.id !== "FACTURAS" && stageCounts[stage.id] !== undefined && (
                <span className="ga-stage-badge">{stageCounts[stage.id]}</span>
              )}
            </button>
          ))}
        </div>

        <section className="ga-state-card">
          {activeStage === "RECIBIDO_FLORIDA" ? (
            <StageReceived
              isEs={isEs}
              // StageReceived usa un tipo StageReceivedPackage con id numérico;
              // nuestra fuente es Package, así que forzamos el tipo aquí para
              // no romper la lógica existente.
              packages={visiblePackages as any}
              onOpenNext={handleOpenNextModal as any}
              onPackageCreated={handlePackageCreated as any}
              currentUserName={currentUserName}
              onView={handleViewPackage}
            />
          ) : activeStage === "REGISTRO" ? (
            <StageCheckIn
              isEs={isEs}
              // Mismo caso: casteamos los paquetes a StageCheckInPackage.
              packages={visiblePackages as any}
              onBulkTransit={handleBulkTransitFromCheckIn}
              onView={handleViewPackage}
              onEditCheckIn={handleOpenEditCheckIn as any}
            />
          ) : activeStage === "EN_TRANSITO" ? (
            <InTransitStage
              isEs={isEs}
              packages={visiblePackages as any}
              onView={handleViewPackage}
              onEdit={(p) => {
                // edición central se implementará después
                console.log("Edit EN_TRANSITO", p);
              }}
              onDelete={(p) => {
                console.log("Delete EN_TRANSITO", p);
              }}
            />
          ) : activeStage === "DESCARGADO_ROATAN" ? (
            <UnloadedStage
              isEs={isEs}
              packages={visiblePackages as any}
              onScanPackage={() => {
                setIsUnloadModalOpen(true);
                setIsUnloadScannerOpen(true);
              }}
              onView={handleViewPackage}
              onEdit={(p) => {
                console.log("Edit DESCARGADO_ROATAN", p);
              }}
              onDelete={(p) => {
                console.log("Delete DESCARGADO_ROATAN", p);
              }}
            />
          ) : activeStage === "PASTILLA" ? (
            <PickupStage
              isEs={isEs}
              packages={visiblePackages as any}
              onScanPickup={() => {
                setIsPickupQrMode(false);
                setIsQrModalOpen(true);
                setPickupScannerActive(true);
              }}
              onView={handleViewPackage}
              onEdit={(p) => {
                console.log("Edit PASTILLA", p);
              }}
              onDelete={(p) => {
                console.log("Delete PASTILLA", p);
              }}
            />
          ) : activeStage === "FACTURAS" ? (
            <InvoicesStage
              isEs={isEs}
              // Invoices no es una etapa del flujo; usamos todos los paquetes y el
              // componente InvoicesStage filtra por nombre de cliente.
              packages={packages as any}
              onView={handleOpenInvoiceModal as any}
              onBulkGenerate={handleBulkGenerateInvoices}
              onChangeApproval={handleChangeInvoiceApproval as any}
              onChangeInvoiceStatus={handleChangeInvoiceStatus as any}
              onDeleteInvoice={handleDeleteInvoice as any}
            />
          ) : null}
        </section>
      </main>

      {renderCheckInModal()}

      {isViewModalOpen && viewPackage && (
        <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ga-modal ga-modal-large">
            <div className="ga-modal-header">
              <div>
                <h4>{isEs ? "Detalle del envío" : "Shipment details"}</h4>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#6b7280",
                    marginTop: 4,
                  }}
                >
                  {isEs ? "Estado actual: " : "Current status: "}
                  <span style={{ fontWeight: 600 }}>
                    {viewPackage.estado || (isEs ? "Desconocido" : "Unknown")}
                  </span>
                </p>
              </div>
              <button
                type="button"
                className="ga-icon-button ga-icon-button-light"
                onClick={handleCloseViewModal}
              >
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>

            <div className="ga-modal-body">
              <div className="ga-field-group" style={{ marginBottom: "0.5rem" }}>
                <label style={{ fontWeight: 600, fontSize: "0.85rem", textTransform: "uppercase", color: "#6b7280" }}>
                  {isEs ? "Recibido (Florida)" : "Received (Florida)"}
                </label>
              </div>

              <div className="ga-form-grid">
                <div className="ga-field-group">
                  <label>Tracking</label>
                  <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                    {viewPackage.tracking}
                  </div>
                </div>

                <div className="ga-field-group">
                  <label>{isEs ? "Paquetería" : "Carrier"}</label>
                  <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                    {viewPackage.carrier || "-"}
                  </div>
                </div>

                <div className="ga-field-group">
                  <label>{isEs ? "Tipo" : "Type"}</label>
                  <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                    {getCategoryLabel(viewPackage.type, isEs)}
                  </div>
                </div>

                <div className="ga-field-group">
                  <label>{isEs ? "Contenido" : "Contents"}</label>
                  <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                    {viewPackage.dims || "-"}
                  </div>
                </div>

                <div className="ga-field-group">
                  <label>{isEs ? "Tiempo de escaneo" : "Scan time"}</label>
                  <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                    {viewPackage.horaFecha
                      ? new Date(viewPackage.horaFecha).toLocaleString(
                          isEs ? "es-ES" : "en-US",
                        )
                      : "-"}
                  </div>
                </div>

                <div className="ga-field-group">
                  <label>{isEs ? "Registrado por" : "Registered by"}</label>
                  <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                    {viewPackage.registro || "-"}
                  </div>
                </div>

                <div className="ga-field-group" style={{ gridColumn: "1 / -1", marginTop: "0.75rem" }}>
                  <label
                    style={{
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      textTransform: "uppercase",
                      color: "#6b7280",
                    }}
                  >
                    {isEs ? "Check-In y estado actual" : "Check-In & current status"}
                  </label>
                </div>

                <div className="ga-field-group">
                  <label>{isEs ? "N.º cliente" : "Client #"}</label>
                  <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                    {viewPackage.numeroCliente != null ? viewPackage.numeroCliente : "-"}
                  </div>
                </div>

                <div className="ga-field-group">
                  <label>{isEs ? "Nombre del cliente" : "Client name"}</label>
                  <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                    {viewPackage.clienteNombre && viewPackage.clienteNombre.trim().length > 0
                      ? viewPackage.clienteNombre
                      : "-"}
                  </div>
                </div>

                {viewCheckInDetails && (
                  <>
                    <div className="ga-field-group" style={{ gridColumn: "1 / -1" }}>
                      <label>
                        {isEs ? "Detalles de Check In" : "Check-In details"}
                      </label>
                    </div>

                    <div className="ga-field-group">
                      <label>{isEs ? "Alto (in)" : "Height (in)"}</label>
                      <div
                        className="ga-input"
                        style={{ border: "none", paddingLeft: 0 }}
                      >
                        {viewCheckInDetails.height != null
                          ? viewCheckInDetails.height
                          : "-"}
                      </div>
                    </div>

                    <div className="ga-field-group">
                      <label>{isEs ? "Ancho (in)" : "Width (in)"}</label>
                      <div
                        className="ga-input"
                        style={{ border: "none", paddingLeft: 0 }}
                      >
                        {viewCheckInDetails.width != null
                          ? viewCheckInDetails.width
                          : "-"}
                      </div>
                    </div>

                    <div className="ga-field-group">
                      <label>{isEs ? "Largo (in)" : "Length (in)"}</label>
                      <div
                        className="ga-input"
                        style={{ border: "none", paddingLeft: 0 }}
                      >
                        {viewCheckInDetails.length != null
                          ? viewCheckInDetails.length
                          : "-"}
                      </div>
                    </div>

                    <div className="ga-field-group">
                      <label>{isEs ? "Peso real (lb)" : "Real weight (lb)"}</label>
                      <div
                        className="ga-input"
                        style={{ border: "none", paddingLeft: 0 }}
                      >
                        {viewCheckInDetails.weight != null
                          ? viewCheckInDetails.weight
                          : "-"}
                      </div>
                    </div>

                    <div className="ga-field-group">
                      <label>
                        {isEs
                          ? "Consolidación"
                          : "Consolidation details"}
                      </label>
                      <div
                        className="ga-input"
                        style={{ border: "none", paddingLeft: 0 }}
                      >
                        {viewPackage.type === "BOX" ? (
                          viewPackage.consolidatedChildrenTrackings &&
                          viewPackage.consolidatedChildrenTrackings.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                              {viewPackage.consolidatedChildrenTrackings.map(
                                (t: string, idx: number) => (
                                  <li key={idx}>{t}</li>
                                ),
                              )}
                            </ul>
                          ) : isEs ? (
                            "Esta caja no tiene paquetes consolidados"
                          ) : (
                            "This box has no consolidated packages"
                          )
                        ) : viewPackage.consolidatedIntoBoxTracking ? (
                          isEs ? (
                            `Consolidado en la caja ${viewPackage.consolidatedIntoBoxTracking}`
                          ) : (
                            `Consolidated into box ${viewPackage.consolidatedIntoBoxTracking}`
                          )
                        ) : isEs ? (
                          "Este paquete no está consolidado en ninguna caja"
                        ) : (
                          "This package is not consolidated into any box"
                        )}
                      </div>
                    </div>

                    <div className="ga-field-group">
                      <label>{isEs ? "Tiene problema/daño" : "Has issue/damage"}</label>
                      <div
                        className="ga-input"
                        style={{ border: "none", paddingLeft: 0 }}
                      >
                        {viewCheckInDetails.hasProblem
                          ? isEs
                            ? "Sí"
                            : "Yes"
                          : isEs
                          ? "No"
                          : "No"}
                      </div>
                    </div>

                    <div className="ga-field-group">
                      <label>{isEs ? "Notas del problema" : "Problem notes"}</label>
                      <div
                        className="ga-input"
                        style={{ border: "none", paddingLeft: 0 }}
                      >
                        {viewCheckInDetails.problemNotes &&
                        viewCheckInDetails.problemNotes.trim().length > 0
                          ? viewCheckInDetails.problemNotes
                          : isEs
                          ? "Sin notas de problema"
                          : "No problem notes"}
                      </div>
                    </div>

                    {Array.isArray(viewPackage?.notas_imagenes) &&
                      viewPackage.notas_imagenes.length > 0 && (
                        <div
                          className="ga-field-group"
                          style={{ gridColumn: "1 / -1" }}
                        >
                          <label>
                            {isEs
                              ? "Fotos del problema"
                              : "Problem photos"}
                          </label>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.5rem",
                            }}
                          >
                            {viewPackage.notas_imagenes
                              .filter(
                                (url: string | null | undefined) =>
                                  typeof url === "string" && url.trim().length > 0,
                              )
                              .map((url: string, idx: number) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setImagePreviewUrl(url);
                                    setIsImagePreviewOpen(true);
                                  }}
                                  style={{
                                    padding: 0,
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 8,
                                    overflow: "hidden",
                                    background: "transparent",
                                    cursor: "pointer",
                                  }}
                                >
                                  <img
                                    src={url}
                                    alt={
                                      isEs
                                        ? `Foto del problema ${idx + 1}`
                                        : `Problem photo ${idx + 1}`
                                    }
                                    style={{
                                      width: 96,
                                      height: 96,
                                      objectFit: "cover",
                                      display: "block",
                                    }}
                                  />
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                    <div className="ga-field-group" style={{ gridColumn: "1 / -1" }}>
                      <label>
                        {isEs ? "Cargos adicionales" : "Extra charges"}
                      </label>
                      <div
                        className="ga-input"
                        style={{ border: "none", paddingLeft: 0 }}
                      >
                        {viewCheckInDetails.extraCharges &&
                        viewCheckInDetails.extraCharges.trim().length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                            {viewCheckInDetails.extraCharges
                              .split(",")
                              .map((item: string, idx: number) => {
                                const trimmed = item.trim();
                                if (!trimmed) return null;
                                return <li key={idx}>{trimmed}</li>;
                              })}
                          </ul>
                        ) : isEs ? (
                          "Sin cargos adicionales"
                        ) : (
                          "No extra charges"
                        )}
                      </div>
                    </div>

                    {/* Sección Descargado (Roatán) */}
                    <div className="ga-field-group" style={{ gridColumn: "1 / -1", marginTop: "0.75rem" }}>
                      <label
                        style={{
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          textTransform: "uppercase",
                          color: "#6b7280",
                        }}
                      >
                        {isEs ? "Descargado (Roatán)" : "Unloaded (Roatán)"}
                      </label>
                    </div>

                    <div className="ga-field-group">
                      <label>{isEs ? "Descargado por" : "Unloaded by"}</label>
                      <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                        {viewPackage.descargado || "-"}
                      </div>
                    </div>

                    <div className="ga-field-group">
                      <label>{isEs ? "Fecha descarga" : "Unload date"}</label>
                      <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                        {viewPackage.fechaDescargado
                          ? new Date(viewPackage.fechaDescargado).toLocaleString(
                              isEs ? "es-ES" : "en-US",
                            )
                          : "-"}
                      </div>
                    </div>

                    {/* Sección Entrega / Pickup */}
                    <div className="ga-field-group" style={{ gridColumn: "1 / -1", marginTop: "0.75rem" }}>
                      <label
                        style={{
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          textTransform: "uppercase",
                          color: "#6b7280",
                        }}
                      >
                        {isEs ? "Entrega / Pickup" : "Delivery / Pickup"}
                      </label>
                    </div>

                    <div className="ga-field-group">
                      <label>{isEs ? "Entregado por" : "Delivered by"}</label>
                      <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                        {viewPackage.entregadoPor || "-"}
                      </div>
                    </div>

                    <div className="ga-field-group">
                      <label>{isEs ? "Fecha entrega" : "Delivery date"}</label>
                      <div className="ga-input" style={{ border: "none", paddingLeft: 0 }}>
                        {viewPackage.fechaEntregado
                          ? new Date(viewPackage.fechaEntregado).toLocaleString(
                              isEs ? "es-ES" : "en-US",
                            )
                          : "-"}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="ga-modal-footer">
              <button
                type="button"
                className="ga-secondary-button"
                onClick={handleCloseViewModal}
              >
                {isEs ? "Cerrar" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {messageModal && (
        <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ga-modal" style={{ maxWidth: 420 }}>
            <div className="ga-modal-header">
              <h4>{messageModal.title}</h4>
              <button
                type="button"
                className="ga-icon-button ga-icon-button-light"
                onClick={() => setMessageModal(null)}
                aria-label={isEs ? "Cerrar" : "Close"}
              >
                <span style={{ lineHeight: 1 }}>×</span>
              </button>
            </div>
            <div className="ga-modal-body">
              <p style={{ margin: 0, fontSize: "0.95rem", whiteSpace: "pre-line" }}>
                {messageModal.message}
              </p>
            </div>
            <div className="ga-modal-actions" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="ga-primary-button"
                onClick={() => setMessageModal(null)}
              >
                {isEs ? "Aceptar" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteInvoice && (
        <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ga-modal" style={{ maxWidth: 440 }}>
            <div className="ga-modal-header">
              <h4>{isEs ? "Eliminar factura" : "Delete invoice"}</h4>
              <button
                type="button"
                className="ga-icon-button ga-icon-button-light"
                onClick={() => setPendingDeleteInvoice(null)}
                aria-label={isEs ? "Cerrar" : "Close"}
              >
                <span style={{ lineHeight: 1 }}>×</span>
              </button>
            </div>
            <div className="ga-modal-body">
              <p style={{ margin: 0, fontSize: "0.95rem", whiteSpace: "pre-line" }}>
                {isEs
                  ? "¿Eliminar los montos de esta factura para este envío?"
                  : "Delete invoice amounts for this shipment?"}
              </p>
            </div>
            <div
              className="ga-modal-actions"
              style={{ justifyContent: "flex-end", gap: "0.5rem" }}
            >
              <button
                type="button"
                className="ga-secondary-button"
                onClick={() => setPendingDeleteInvoice(null)}
              >
                {isEs ? "Cancelar" : "Cancel"}
              </button>
              <button
                type="button"
                className="ga-primary-button ga-danger-button"
                onClick={confirmDeleteInvoice}
              >
                {isEs ? "Eliminar" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isInvoiceModalOpen && invoicePackage && (
        <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ga-modal ga-modal-large">
            <div className="ga-modal-header">
              <div>
                <h4>Invoice preview</h4>
              </div>
              <button
                type="button"
                className="ga-icon-button ga-icon-button-light"
                onClick={handleCloseInvoiceModal}
              >
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>

            <div className="ga-modal-body">
              <InvoicePreview
                clientName={invoicePackage.clienteNombre}
                clientNumber={invoicePackage.numeroCliente ?? undefined}
                tracking={invoicePackage.tracking}
                carrier={invoicePackage.carrier}
                typeLabel={getCategoryLabel(invoicePackage.type, false)}
                contents={invoicePackage.dims}
                extraCharges={invoiceExtraCharges}
                isConsolidationBox={invoiceIsConsolidationBox}
                consolidatedPackagesCount={invoicePackage.consolidationCount ?? undefined}
                billingSubtotal={invoicePackage.billing_subtotal ?? null}
                billingTax={invoicePackage.billing_tax ?? null}
                billingTotal={invoicePackage.billing_total ?? null}
              />
            </div>

            <div className="ga-modal-footer">
              <button
                type="button"
                className="ga-secondary-button"
                onClick={handleCloseInvoiceModal}
              >
                {isEs ? "Cerrar" : "Close"}
              </button>
              <button
                type="button"
                className="ga-primary-button"
                disabled={isSendingInvoiceEmail}
                onClick={() => setIsConfirmSendInvoiceOpen(true)}
              >
                {isSendingInvoiceEmail
                  ? isEs
                    ? "Enviando..."
                    : "Sending..."
                  : isEs
                  ? "Enviar por correo"
                  : "Send by email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isConfirmSendInvoiceOpen && invoicePackage && (
        <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ga-modal" style={{ maxWidth: 420 }}>
            <div className="ga-modal-header">
              <h4>{isEs ? "Confirmar envío" : "Confirm send"}</h4>
            </div>
            <div className="ga-modal-body">
              <p style={{ marginBottom: "0.75rem" }}>
                {isEs
                  ? "¿Estás seguro de que quieres enviar esta factura al correo:"
                  : "Are you sure you want to send this invoice to:"}
              </p>
              <p
                style={{
                  fontWeight: 600,
                  color: "#111827",
                  marginBottom: "0.5rem",
                  wordBreak: "break-all",
                }}
              >
                {(invoicePackage.clienteEmail || "").trim()}
              </p>
              {!invoicePackage.clienteEmail && (
                <p style={{ fontSize: "0.8rem", color: "#b91c1c" }}>
                  {isEs
                    ? "Este cliente no tiene correo registrado. No se podrá enviar la factura."
                    : "This client has no email on file. Invoice cannot be sent."}
                </p>
              )}

              {(() => {
                const approval = (invoicePackage.approval_status || "").toUpperCase();
                const isNotApproved = approval !== "APPROVED";
                if (!isNotApproved) return null;

                return (
                  <p style={{ fontSize: "0.8rem", color: "#b45309", marginTop: "0.5rem" }}>
                    {isEs
                      ? "Esta factura está marcada como REQUIERE REVISIÓN. Debe aprobarse en el panel de facturas antes de poder enviarla."
                      : "This invoice is marked as REQUIRES REVIEW. Please approve it in the invoices panel before emailing."}
                  </p>
                );
              })()}
            </div>
            <div className="ga-modal-footer">
              {(() => {
                const approval = (invoicePackage.approval_status || "").toUpperCase();
                const isNotApproved = approval !== "APPROVED";

                return (
                  <>
                  <button
                    type="button"
                    className="ga-secondary-button"
                    disabled={isSendingInvoiceEmail}
                    onClick={() => setIsConfirmSendInvoiceOpen(false)}
                  >
                    {isEs ? "Cancelar" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    className="ga-primary-button"
                    disabled={isSendingInvoiceEmail || isNotApproved}
                    onClick={handleSendInvoiceEmail}
                  >
                    {isSendingInvoiceEmail
                      ? isEs
                        ? "Enviando..."
                        : "Sending..."
                      : isEs
                        ? "Confirmar envío"
                        : "Confirm send"}
                  </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {isImagePreviewOpen && imagePreviewUrl && (
        <div
          className="ga-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setIsImagePreviewOpen(false);
            setImagePreviewUrl(null);
          }}
        >
          <div
            className="ga-modal"
            style={{ maxWidth: "80vw", maxHeight: "80vh", padding: "0.5rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ga-modal-header">
              <h4>{isEs ? "Foto del problema" : "Problem photo"}</h4>
              <button
                type="button"
                className="ga-icon-button ga-icon-button-light"
                onClick={() => {
                  setIsImagePreviewOpen(false);
                  setImagePreviewUrl(null);
                }}
                style={{
                  color: "#ffffff",
                  border: "none",
                  background: "transparent",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                }}
                aria-label={isEs ? "Cerrar" : "Close"}
              >
                {/* X visible incluso si falla el icono */}
                <span style={{ lineHeight: 1 }}>×</span>
              </button>
            </div>
            <div
              className="ga-modal-body"
              style={{ justifyContent: "center", alignItems: "center" }}
            >
              <img
                src={imagePreviewUrl}
                alt={isEs ? "Foto del problema" : "Problem photo"}
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: 8,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {isQrModalOpen && (
        <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ga-modal">
            <div className="ga-modal-header">
              <h4>{isEs ? "Escanear retiro" : "Scan pickup"}</h4>
              <button
                type="button"
                className="ga-icon-button ga-icon-button-light"
                onClick={() => {
                  stopPickupScanner();
                  setIsQrModalOpen(false);
                  setIsPickupQrMode(false);
                  setQrError(null);
                  setQrPedido(null);
                }}
              >
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>

            <div className="ga-modal-body" style={{ gap: "1rem" }}>
              <p style={{ margin: 0, fontSize: "0.95rem" }}>
                {isEs
                  ? "Escanea el código para confirmar la salida del pedido."
                  : "Scan the code to confirm the shipment exit."}
              </p>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="ga-secondary-button"
                  style={{ flex: 1, opacity: isPickupQrMode ? 0.6 : 1 }}
                  onClick={() => {
                    // Volver al escáner de código de barras
                    setIsPickupQrMode(false);
                    setQrError(null);
                    setQrPedido(null);
                    setPendingQrTracking("");
                    setPickupScannerActive(true);
                  }}
                >
                  {isEs ? "Escáner código de barras" : "Barcode scanner"}
                </button>
                <button
                  type="button"
                  className="ga-secondary-button"
                  style={{ flex: 1, opacity: isPickupQrMode ? 1 : 0.6 }}
                  onClick={() => {
                    // Cambiar al escáner QR exclusivo Caribex
                    stopPickupScanner();
                    setIsPickupQrMode(true);
                    setQrError(null);
                    setQrPedido(null);
                    setPendingQrTracking("");
                  }}
                >
                  {isEs ? "Escáner QR Caribex" : "Caribex QR scanner"}
                </button>
              </div>

              {!isPickupQrMode ? (
                <div
                  id="ga-pickup-scanner-container"
                  className="ga-barcode-video"
                  style={{
                    width: "100%",
                    height: "220px",
                    borderRadius: "10px",
                    border: "1px solid #e5e7eb",
                    overflow: "hidden",
                  }}
                />
              ) : (
                <div style={{ width: "100%" }}>
                  <EscanerQRCaribex onCaribexScan={handleCaribexQrResult} />
                </div>
              )}

              {/* Entrada manual de tracking eliminada: ahora solo se permite escanear */}

              {qrError && <p style={{ color: "#dc2626", margin: 0 }}>{qrError}</p>}
            </div>

            <div className="ga-modal-actions" style={{ justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="ga-secondary-button"
                onClick={() => {
                  stopPickupScanner();
                  setIsQrModalOpen(false);
                  setIsPickupQrMode(false);
                  setQrError(null);
                  setQrPedido(null);
                  setPendingQrTracking("");
                }}
              >
                {isEs ? "Cerrar" : "Close"}
              </button>

              {isPickupQrMode && (
                <button
                  type="button"
                  className="ga-primary-button"
                  disabled={!pendingQrTracking}
                  onClick={async () => {
                    const text = pendingQrTracking.trim();
                    if (!text) return;
                    await handlePickupDecoded(text);
                    setPendingQrTracking("");
                    setQrError(null);
                    setQrPedido(null);
                    setIsQrModalOpen(false);
                    setIsPickupQrMode(false);
                  }}
                >
                  {isEs ? "Confirmar entrega" : "Confirm delivery"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isUnloadModalOpen && (
        <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ga-modal">
            <div
              className="ga-modal-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <h4>{isEs ? "Escanear para descargar" : "Scan to unload"}</h4>
              <button
                type="button"
                className="ga-icon-button ga-icon-button-light"
                onClick={() => {
                  stopUnloadScanner();
                  setIsUnloadQrMode(false);
                  setIsUnloadModalOpen(false);
                }}
              >
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>

            <div className="ga-modal-body">
              <p style={{ marginBottom: "0.75rem" }}>
                {isEs
                  ? "Escanee el código de barras del paquete que viene en tránsito para marcarlo como descargado."
                  : "Scan the barcode of a package that is in transit to mark it as unloaded."}
              </p>

              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <button
                  type="button"
                  className="ga-secondary-button"
                  style={{ flex: 1, opacity: isUnloadQrMode ? 0.6 : 1 }}
                  onClick={() => {
                    // Volver al escáner de código de barras para descarga
                    setIsUnloadQrMode(false);
                    setIsUnloadScannerOpen(true);
                  }}
                >
                  {isEs ? "Escáner código de barras" : "Barcode scanner"}
                </button>
                <button
                  type="button"
                  className="ga-secondary-button"
                  style={{ flex: 1, opacity: isUnloadQrMode ? 1 : 0.6 }}
                  onClick={() => {
                    // Cambiar al escáner QR exclusivo Caribex para descarga
                    stopUnloadScanner();
                    setIsUnloadQrMode(true);
                  }}
                >
                  {isEs ? "Escáner QR Caribex" : "Caribex QR scanner"}
                </button>
              </div>

              {isUnloadQrMode ? (
                <div style={{ width: "100%" }}>
                  <EscanerQRCaribex onCaribexScan={handleCaribexUnloadResult} />
                </div>
              ) : (
                isUnloadScannerOpen && (
                  <div className="ga-barcode-scanner">
                    <div
                      id="ga-unload-scanner-container"
                      className="ga-barcode-video"
                      style={{
                        width: "100%",
                        height: "220px",
                        borderRadius: "10px",
                        border: "1px solid #e5e7eb",
                        overflow: "hidden",
                      }}
                    />
                  </div>
                )
              )}
            </div>

            <div className="ga-modal-actions" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="ga-secondary-button"
                onClick={() => {
                  stopUnloadScanner();
                  setIsUnloadQrMode(false);
                  setIsUnloadModalOpen(false);
                }}
              >
                {isEs ? "Cancelar escaneo" : "Cancel scan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
