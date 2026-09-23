"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Pencil, Trash2, Unlock, LogOut, Image as ImageIcon, Check, AlertCircle, Send, DollarSign, ChevronDown } from "lucide-react";
import FerryManifestAdmin from "./FerryManifestAdmin";
import Client360Admin from "./Client360Admin";

/**
 * DASHBOARD OPERATIVO - VERSIÓN VISUAL PURA
 * Estilo: Warehouse Management System
 * Ajustes: Sin buscador, iconos específicos (Equipo/Maletín), estilo fiel a referencia.
 */

const NUEVO_CLIENTE_INITIAL = {
  nombre: "",
  email: "",
  telefono: "",
  puerto: "",
  tipoCuenta: "Personal",
};

const STAFF_PERMISSION_OPTIONS = [
  { key: "shipment_workflow", label: "Shipment workflow" },
  { key: "client360", label: "Client 360" },
  { key: "invoices", label: "View and send invoices" },
  { key: "invoice_edit", label: "Edit invoice add-ons" },
  { key: "ferry_manifests", label: "Ferry manifests" },
] as const;

type StaffPermissions = Record<(typeof STAFF_PERMISSION_OPTIONS)[number]["key"], boolean>;
const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  shipment_workflow: true,
  client360: true,
  invoices: true,
  invoice_edit: false,
  ferry_manifests: false,
};

const ADMIN_EXTRA_CHARGE_OPTIONS = [
  "Storage fees (daily)",
  "Handling fees",
  "Documentation fees",
  "Insurance premium (2% of insurable value)",
  "Forklift charge ($100)",
  "Miscellaneous fee ($10)",
  "Consolidation fee ($2.5)",
  "Honduran imposed duty",
];
const PORTAL_EVENT_LABELS: Record<string, string> = {
  account_created: "Customer account created",
  portal_access_provisioned: "Portal access provisioned",
  login_attempt: "Portal login attempt",
  password_reset_requested: "Password reset requested",
};
const portalEventLabel = (eventType: string) => PORTAL_EVENT_LABELS[eventType] || eventType.replaceAll("_", " ");

const App = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'personal' | 'clientes' | 'client360' | 'pedidos' | 'incidencias' | 'facturas' | 'leads' | 'portal' | 'ferry'
  >('personal');
  const [expandedNavGroups, setExpandedNavGroups] = useState<Record<string, boolean>>({
    operations: true,
    customers: true,
    billing: true,
    administration: true,
  });
  const toggleNavGroup = (group: string) => setExpandedNavGroups((current) => ({ ...current, [group]: !current[group] }));

  const [personal, setPersonal] = useState<{ id: string; nombre: string; rol: string; permissions?: Partial<StaffPermissions> | null }[]>([]);
  type Cliente = {
    id: string;
    nombre: string;
    numero_cliente: number;
    email: string | null;
    telefono: string | null;
    puerto: string | null;
    tipo_cuenta: string | null;
    creado_en: string | null;
    auth_user_id?: string | null;
  };
  const [clientes, setClientes] = useState<Cliente[]>([]);
  type Pedido = {
    id: string;
    tracking: string;
    clienteNumero: number | null;
    clienteNombre: string | null;
    estado: string | null;
    carrier?: string | null;
    tipo_paquete?: string | null;
    remitente?: string | null;
    destinatario?: string | null;
    contenido?: string | null;
    notas?: string | null;
    notas_imagenes?: string | string[] | null;
    numero_cliente_id?: string | null;
    // Campos de auditoría y tiempos
    registro?: string | null;
    descargado?: string | null;
    entregado_por?: string | null;
    hora_fecha?: string | null;
    fecha_descargado?: string | null;
    hora_descargado?: string | null;
    fecha_entregado?: string | null;
    hora_entregado?: string | null;
    // Campos de Check In / dimensiones y problemas
    alto?: number | null;
    ancho?: number | null;
    largo?: number | null;
    peso?: number | null;
    problema?: boolean | null;
    problema_notas?: string | null;
    cargos_adicionales?: string | null;
    consolidacion?: boolean | null;
  };
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  type Factura = {
    id: string;
    tracking: string;
    clienteNumero: number | null;
    clienteNombre: string | null;
    clienteEmail: string | null;
    carrier: string | null;
    tipo_paquete: string | null;
    subtotal: number | null;
    tax: number | null;
    total: number | null;
    approval_status: string | null;
    invoice_status: string | null;
    notas: string | null;
  };

  const [facturas, setFacturas] = useState<Factura[]>([]);
  const facturasCount = facturas.length;
  type Lead = { id: string; nombre: string; email: string; telefono: string | null; mensaje: string; service_type: string | null; status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED'; admin_notes: string | null; created_at: string };
  const [leads, setLeads] = useState<Lead[]>([]);
  type PortalEvent = { id: string; customer_name: string | null; account_number: number | null; email: string; event_type: string; success: boolean; reason: string | null; created_at: string };
  const [portalEvents, setPortalEvents] = useState<PortalEvent[]>([]);
  const cargarPortalEvents = useCallback(async () => {
    const { data } = await supabase.from("customer_portal_login_events").select("id, customer_name, account_number, email, event_type, success, reason, created_at").order("created_at", { ascending: false }).limit(100);
    if (data) setPortalEvents(data as PortalEvent[]);
  }, []);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const cargarLeads = useCallback(async () => {
    const [{ data: contactData }, { data: customerData }] = await Promise.all([
      supabase.from('contact_submissions').select('id, nombre, email, telefono, mensaje, service_type, status, admin_notes, created_at').order('created_at', { ascending: false }),
      supabase.from('customer_leads').select('id, nombre, email, mensaje, asunto, estado, creado_en').order('creado_en', { ascending: false }),
    ]);
    const legacy = (contactData || []) as Lead[];
    const newer = (customerData || []).map((lead: any): Lead => ({
      id: lead.id,
      nombre: lead.nombre,
      email: lead.email,
      telefono: null,
      mensaje: lead.mensaje,
      service_type: lead.asunto || 'Landing page lead',
      status: lead.estado === 'contactado' ? 'CONTACTED' : lead.estado === 'cerrado' ? 'CLOSED' : lead.estado === 'spam' ? 'CLOSED' : 'NEW',
      admin_notes: null,
      created_at: lead.creado_en,
    }));
    const seen = new Set<string>();
    setLeads([...newer, ...legacy].filter((lead) => { const key = `${lead.email}|${lead.mensaje}`; if (seen.has(key)) return false; seen.add(key); return true; }));
  }, []);

  type InvoiceTab = 'sinAprobar' | 'aprobadas' | 'enviadas' | 'pagadas';
  const [activeInvoiceTab, setActiveInvoiceTab] = useState<InvoiceTab>('sinAprobar');

  // Modal de confirmación para marcar factura como pagada
  const [pendingPayInvoice, setPendingPayInvoice] = useState<Factura | null>(null);
  const [editingInvoiceAddOns, setEditingInvoiceAddOns] = useState<Factura | null>(null);
  const [invoiceAddOnType, setInvoiceAddOnType] = useState("");
  const [invoiceAddOnAmount, setInvoiceAddOnAmount] = useState("");

  const facturasFiltradas = useMemo(() => {
    return facturas.filter((f) => {
      const approval = (f.approval_status || '').toUpperCase();
      const invoice = (f.invoice_status || '').toUpperCase();

      if (activeInvoiceTab === 'sinAprobar') {
        return !approval || approval === 'PENDING';
      }
      if (activeInvoiceTab === 'aprobadas') {
        return approval === 'APPROVED';
      }
      if (activeInvoiceTab === 'enviadas') {
        return invoice === 'SENT';
      }
      if (activeInvoiceTab === 'pagadas') {
        return invoice === 'PAID';
      }
      return true;
    });
  }, [facturas, activeInvoiceTab]);

  const [pedidoFiltro, setPedidoFiltro] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);

  const [nuevoPersonal, setNuevoPersonal] = useState({
    email: "",
    nombre: "",
    password: "",
    permissions: { ...DEFAULT_STAFF_PERMISSIONS },
  });
  const [editingStaff, setEditingStaff] = useState<{ id: string; nombre: string; permissions?: Partial<StaffPermissions> | null } | null>(null);
  const [editingStaffPermissions, setEditingStaffPermissions] = useState<StaffPermissions>({ ...DEFAULT_STAFF_PERMISSIONS });
  const [staffPermissionSaving, setStaffPermissionSaving] = useState(false);

  const [nuevoCliente, setNuevoCliente] = useState({ ...NUEVO_CLIENTE_INITIAL });
  const [clienteEditandoId, setClienteEditandoId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [clienteSaving, setClienteSaving] = useState(false);
  const [clienteModalError, setClienteModalError] = useState<string | null>(null);

  // Detalle de pedido (paquetes_registro + paquetes_checkin + numero_cliente)
  const [isPedidoDetalleOpen, setIsPedidoDetalleOpen] = useState(false);
  const [pedidoDetalle, setPedidoDetalle] = useState<any | null>(null);
  const [pedidoDetalleLoading, setPedidoDetalleLoading] = useState(false);
  const [pedidoDetalleError, setPedidoDetalleError] = useState<string | null>(null);
  const [isPedidoEditOpen, setIsPedidoEditOpen] = useState(false);
  const [pedidoEditId, setPedidoEditId] = useState<string | null>(null);
  const [pedidoClienteLabel, setPedidoClienteLabel] = useState<string>("");
  const [pedidoCheckin, setPedidoCheckin] = useState<any | null>(null);
  const [pedidoCheckinId, setPedidoCheckinId] = useState<string | null>(null);
  const [pedidoCheckinForm, setPedidoCheckinForm] = useState({
    alto: "",
    ancho: "",
    largo: "",
    peso: "",
    problema: false,
    problema_notas: "",
    cargos_adicionales: "",
    consolidacion: false,
  });
  const [pedidoForm, setPedidoForm] = useState({
    tracking: "",
    carrier: "",
    tipo_paquete: "BOX",
    remitente: "",
    destinatario: "",
    contenido: "",
    notas: "",
    estado: "Recibido",
    numero_cliente_id: "",
    // Auditoría y tiempos
    registro: "",
    descargado: "",
    entregado_por: "",
    hora_fecha: "",
    fecha_descargado: "",
    hora_descargado: "",
    fecha_entregado: "",
    hora_entregado: "",
    // Dimensiones / problemas
    alto: "",
    ancho: "",
    largo: "",
    peso: "",
    problema: false,
    problema_notas: "",
    cargos_adicionales: "",
    consolidacion: false,
  });
  const [pedidoQrUrl, setPedidoQrUrl] = useState<string | null>(null);
  const [clients, setClients] = useState<
    { id: string; nombre: string; numero_cliente: number }[]
  >([]);

  const [incidenciaImagenes, setIncidenciaImagenes] = useState<string[] | null>(null);
  const [incidenciaTitulo, setIncidenciaTitulo] = useState<string>("");

  const cargarPersonal = useCallback(async () => {
    const { data, error } = await supabase
      .from("personal")
      .select("id, nombre, rol, permissions")
      .order("creado_en", { ascending: false });

    if (!error && data) {
      setPersonal(data as any);
    }
  }, []);

  const openStaffPermissions = (staff: { id: string; nombre: string; permissions?: Partial<StaffPermissions> | null }) => {
    setEditingStaff(staff);
    setEditingStaffPermissions({ ...DEFAULT_STAFF_PERMISSIONS, ...(staff.permissions || {}) });
  };

  const saveStaffPermissions = async () => {
    if (!editingStaff) return;
    setStaffPermissionSaving(true);
    const { error } = await supabase.from("personal").update({ permissions: editingStaffPermissions }).eq("id", editingStaff.id);
    setStaffPermissionSaving(false);
    if (error) {
      setModalError(error.message || "Could not update staff permissions.");
      return;
    }
    await cargarPersonal();
    setEditingStaff(null);
  };

  const pedidosConIncidencia = useMemo(
    () =>
      pedidos.filter(
        (p) =>
          (p.notas && p.notas.trim() !== "") ||
          (Array.isArray(p.notas_imagenes)
            ? p.notas_imagenes.length > 0
            : typeof p.notas_imagenes === "string" && p.notas_imagenes.trim() !== ""),
      ),
    [pedidos],
  );

  const obtenerUrlsIncidencia = (p: Pedido): string[] => {
    const raw = p.notas_imagenes;
    if (Array.isArray(raw)) {
      return raw.filter((u) => typeof u === "string" && u.trim() !== "");
    }
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((u) => typeof u === "string" && u.trim() !== "");
        }
        // Si no es un JSON de array, intentamos separar por comas
        const parts = raw.split(",").map((s) => s.trim());
        return parts.filter((u) => u !== "");
      } catch {
        // No es JSON: podría ser una lista separada por comas o una sola URL
        const parts = raw.split(",").map((s) => s.trim());
        return parts.filter((u) => u !== "");
      }
    }
    return [];
  };

  const abrirDetallePedido = async (id: string) => {
    setIsPedidoDetalleOpen(true);
    setPedidoDetalle(null);
    setPedidoDetalleError(null);
    setPedidoDetalleLoading(true);

    try {
      const [{ data, error }, { data: checkins, error: checkinError }] = await Promise.all([
        supabase
          .from("paquetes_registro")
          .select("*, numero_cliente:numero_cliente_id (*)")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("paquetes_checkin")
          .select("*")
          .eq("paquete_id", id),
      ]);

      if (error) throw error;
      if (checkinError) throw checkinError;

      if (!data) {
        setPedidoDetalleError("No se encontró información detallada para este pedido.");
      } else {
        setPedidoDetalle({ ...data, paquetes_checkin: checkins || [] });
      }
    } catch (err: any) {
      console.error("Error cargando detalle de pedido", err);
      setPedidoDetalleError(
        err?.message || "Ocurrió un error al cargar el detalle del pedido."
      );
    } finally {
      setPedidoDetalleLoading(false);
    }
  };

  const generarQrPedido = (pedido: Pedido) => {
    const payload = JSON.stringify({
      id: pedido.id,
      tracking: pedido.tracking,
      carrier: pedido.carrier,
      tipo_paquete: pedido.tipo_paquete,
      remitente: pedido.remitente,
      destinatario: pedido.destinatario,
      estado: pedido.estado,
    });
    const encoded = encodeURIComponent(payload);
    setPedidoQrUrl(
      `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`,
    );
  };

  const abrirEditarPedido = (pedido: Pedido) => {
    setPedidoEditId(pedido.id);
    const label =
      pedido.clienteNumero != null && pedido.clienteNombre
        ? `#${pedido.clienteNumero} - ${pedido.clienteNombre}`
        : "Sin cliente asignado";
    setPedidoClienteLabel(label);
    setPedidoCheckin(null);
    setPedidoCheckinId(null);
    setPedidoCheckinForm({
      alto: "",
      ancho: "",
      largo: "",
      peso: "",
      problema: false,
      problema_notas: "",
      cargos_adicionales: "",
      consolidacion: false,
    });
    setPedidoForm({
      tracking: pedido.tracking || "",
      carrier: pedido.carrier || "",
      tipo_paquete: pedido.tipo_paquete || "BOX",
      remitente: pedido.remitente || "",
      destinatario: pedido.destinatario || "",
      contenido: pedido.contenido || "",
      notas: pedido.notas || "",
      estado: pedido.estado || "Recibido",
      numero_cliente_id: pedido.numero_cliente_id || "",
      // Auditoría y tiempos
      registro: pedido.registro || "",
      descargado: pedido.descargado || "",
      entregado_por: pedido.entregado_por || "",
      hora_fecha: pedido.hora_fecha || "",
      // Los date inputs requieren formato YYYY-MM-DD; si viene un timestamp, tomamos solo la parte de fecha
      fecha_descargado: pedido.fecha_descargado
        ? String(pedido.fecha_descargado).substring(0, 10)
        : "",
      hora_descargado: pedido.hora_descargado || "",
      fecha_entregado: pedido.fecha_entregado
        ? String(pedido.fecha_entregado).substring(0, 10)
        : "",
      hora_entregado: pedido.hora_entregado || "",
      // Dimensiones / problemas
      alto: pedido.alto != null ? String(pedido.alto) : "",
      ancho: pedido.ancho != null ? String(pedido.ancho) : "",
      largo: pedido.largo != null ? String(pedido.largo) : "",
      peso: pedido.peso != null ? String(pedido.peso) : "",
      problema: !!pedido.problema,
      problema_notas: pedido.problema_notas || "",
      cargos_adicionales: pedido.cargos_adicionales || "",
      consolidacion: !!pedido.consolidacion,
    });
    // Cargar información de check-in (dimensiones, problemas) para este paquete
    (async () => {
      const { data } = await supabase
        .from("paquetes_checkin")
        .select(
          "id, alto, ancho, largo, peso, problema, problema_notas, cargos_adicionales, consolidacion",
        )
        .eq("paquete_id", pedido.id)
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setPedidoCheckin(data);
        setPedidoCheckinId(data.id as string);
        setPedidoCheckinForm({
          alto: data.alto != null ? String(data.alto) : "",
          ancho: data.ancho != null ? String(data.ancho) : "",
          largo: data.largo != null ? String(data.largo) : "",
          peso: data.peso != null ? String(data.peso) : "",
          problema: !!data.problema,
          problema_notas: data.problema_notas || "",
          cargos_adicionales: data.cargos_adicionales || "",
          consolidacion: !!data.consolidacion,
        });
      }
    })();

    generarQrPedido(pedido);
    setIsPedidoEditOpen(true);
  };

  const handleDeletePedido = async (pedidoId: string) => {
    if (!window.confirm("¿Eliminar este pedido?")) return;
    const { error } = await supabase
      .from("paquetes_registro")
      .delete()
      .eq("id", pedidoId);

    if (error) {
      alert(error.message || "No se pudo eliminar el pedido");
      return;
    }

    cargarPedidos();
  };

  const handleUpdatePedido = async () => {
    if (!pedidoEditId) return;
    const pedidoOriginal = pedidos.find((p) => p.id === pedidoEditId) || null;

    if (pedidoOriginal && pedidoOriginal.estado !== pedidoForm.estado) {
      const confirmado = window.confirm(
        "Vas a cambiar el estado de este paquete desde el panel administrativo. Esto también cambiará la etapa en Gestión de almacén (por ejemplo, de Check In a En tránsito, o de En tránsito a Descargado). ¿Seguro que deseas continuar?",
      );
      if (!confirmado) {
        return;
      }
    }

    const { error } = await supabase
      .from("paquetes_registro")
      .update({
        tracking: pedidoForm.tracking,
        nombre_paqueteria: pedidoForm.carrier || null,
        tipo_paquete: pedidoForm.tipo_paquete,
        contenido: pedidoForm.contenido || null,
        notas: pedidoForm.notas || null,
        estado: pedidoForm.estado || null,
        numero_cliente_id: pedidoForm.numero_cliente_id || null,
        registro: pedidoForm.registro || null,
        descargado: pedidoForm.descargado || null,
        entregado_por: pedidoForm.entregado_por || null,
        hora_fecha: pedidoForm.hora_fecha || null,
        fecha_descargado: pedidoForm.fecha_descargado || null,
        hora_descargado: pedidoForm.hora_descargado || null,
        fecha_entregado: pedidoForm.fecha_entregado || null,
        hora_entregado: pedidoForm.hora_entregado || null,
      })
      .eq("id", pedidoEditId);

    if (error) {
      alert(error.message || "No se pudo guardar el pedido");
      return;
    }

    // Guardar datos de Check In en paquetes_checkin (editar o crear registro)
    const hasCheckinData =
      pedidoCheckinForm.alto !== "" ||
      pedidoCheckinForm.ancho !== "" ||
      pedidoCheckinForm.largo !== "" ||
      pedidoCheckinForm.peso !== "" ||
      pedidoCheckinForm.problema ||
      pedidoCheckinForm.problema_notas.trim() !== "" ||
      pedidoCheckinForm.cargos_adicionales.trim() !== "" ||
      pedidoCheckinForm.consolidacion;

    if (hasCheckinData) {
      const payload: any = {
        paquete_id: pedidoEditId,
        alto: pedidoCheckinForm.alto ? Number(pedidoCheckinForm.alto) : null,
        ancho: pedidoCheckinForm.ancho ? Number(pedidoCheckinForm.ancho) : null,
        largo: pedidoCheckinForm.largo ? Number(pedidoCheckinForm.largo) : null,
        peso: pedidoCheckinForm.peso ? Number(pedidoCheckinForm.peso) : null,
        problema: pedidoCheckinForm.problema,
        problema_notas: pedidoCheckinForm.problema_notas || null,
        cargos_adicionales: pedidoCheckinForm.cargos_adicionales || null,
        consolidacion: pedidoCheckinForm.consolidacion,
        numero_cliente_id: pedidoForm.numero_cliente_id || null,
      };

      if (pedidoCheckinId) {
        const { error: checkinError } = await supabase
          .from("paquetes_checkin")
          .update(payload)
          .eq("id", pedidoCheckinId);

        if (checkinError) {
          alert(checkinError.message || "No se pudieron guardar los datos de Check In");
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from("paquetes_checkin")
          .insert(payload);

        if (insertError) {
          alert(insertError.message || "No se pudieron guardar los datos de Check In");
          return;
        }
      }
    }

    cerrarModalEditarPedido();
    cargarPedidos();
  };

  const cerrarModalEditarPedido = () => {
    setIsPedidoEditOpen(false);
    setPedidoEditId(null);
    setPedidoQrUrl(null);
  };

  const handlePedidoFormChange = (field: keyof typeof pedidoForm, value: string) => {
    setPedidoForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildPedidoFromForm = (): Pedido => ({
    id: pedidoEditId || "temp",
    tracking: pedidoForm.tracking,
    carrier: pedidoForm.carrier,
    tipo_paquete: pedidoForm.tipo_paquete,
    remitente: pedidoForm.remitente,
    destinatario: pedidoForm.destinatario,
    contenido: pedidoForm.contenido,
    notas: pedidoForm.notas,
    estado: pedidoForm.estado,
    numero_cliente_id: pedidoForm.numero_cliente_id || null,
    registro: pedidoForm.registro || null,
    descargado: pedidoForm.descargado || null,
    entregado_por: pedidoForm.entregado_por || null,
    hora_fecha: pedidoForm.hora_fecha || null,
    fecha_descargado: pedidoForm.fecha_descargado || null,
    hora_descargado: pedidoForm.hora_descargado || null,
    fecha_entregado: pedidoForm.fecha_entregado || null,
    hora_entregado: pedidoForm.hora_entregado || null,
    alto: pedidoForm.alto ? Number(pedidoForm.alto) : null,
    ancho: pedidoForm.ancho ? Number(pedidoForm.ancho) : null,
    largo: pedidoForm.largo ? Number(pedidoForm.largo) : null,
    peso: pedidoForm.peso ? Number(pedidoForm.peso) : null,
    problema: pedidoForm.problema,
    problema_notas: pedidoForm.problema_notas || null,
    cargos_adicionales: pedidoForm.cargos_adicionales || null,
    consolidacion: pedidoForm.consolidacion,
    clienteNumero: null,
    clienteNombre: null,
  });

  const generarQrDesdeFormulario = () => {
    const pedido = buildPedidoFromForm();
    generarQrPedido(pedido);
  };

  const handleCheckinFormChange = (
    field: keyof typeof pedidoCheckinForm,
    value: string | boolean,
  ) => {
    setPedidoCheckinForm((prev) => ({ ...prev, [field]: value }));
  };

  const cargarClientes = useCallback(async () => {
    const { data, error } = await supabase
      .from("numero_cliente")
      .select("id, nombre, numero_cliente, email, telefono, puerto, tipo_cuenta, creado_en, auth_user_id")
      .order("creado_en", { ascending: false });

    if (!error && data) {
      setClientes(data as Cliente[]);
    }
  }, []);

  const cerrarModalCliente = () => {
    setIsClienteModalOpen(false);
    setClienteEditandoId(null);
    setClienteModalError(null);
    setClienteSaving(false);
    setNuevoCliente({ ...NUEVO_CLIENTE_INITIAL });
  };

  const abrirModalNuevoCliente = () => {
    setClienteEditandoId(null);
    setNuevoCliente({ ...NUEVO_CLIENTE_INITIAL });
    setClienteModalError(null);
    setIsClienteModalOpen(true);
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setClienteEditandoId(cliente.id);
    setNuevoCliente({
      nombre: cliente.nombre,
      email: cliente.email ?? "",
      telefono: cliente.telefono ?? "",
      puerto: cliente.puerto ?? "",
      tipoCuenta: cliente.tipo_cuenta ?? "Personal",
    });
    setClienteModalError(null);
    setIsClienteModalOpen(true);
  };

  const cargarPedidos = useCallback(async () => {
    const { data, error } = await supabase
      .from("paquetes_registro")
      .select(
        "id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, notas_imagenes, estado, numero_cliente:numero_cliente_id (id, numero_cliente, nombre), numero_cliente_id, registro, descargado, entregado_por, hora_fecha, fecha_descargado, hora_descargado, fecha_entregado, hora_entregado",
      )
      .order("creado_en", { ascending: false });

    if (error) {
      alert("Error cargando pedidos: " + (error.message || ""));
      console.error("Error cargarPedidos", error);
      return;
    }

    if (data) {
      const mapped = (data as any[]).map((row) => ({
        id: row.id as string,
        tracking: (row.tracking as string) || "-",
        clienteNumero: row.numero_cliente?.numero_cliente ?? null,
        clienteNombre: row.numero_cliente?.nombre ?? null,
        estado: (row.estado as string) || null,
        carrier: row.nombre_paqueteria || null,
        tipo_paquete: row.tipo_paquete || null,
        remitente: null,
        destinatario: null,
        contenido: row.contenido || null,
        notas: row.notas || null,
        notas_imagenes: row.notas_imagenes || null,
        numero_cliente_id: row.numero_cliente_id || row.numero_cliente?.id || null,
        registro: row.registro || null,
        descargado: row.descargado || null,
        entregado_por: row.entregado_por || null,
        hora_fecha: row.hora_fecha || null,
        fecha_descargado: row.fecha_descargado || null,
        hora_descargado: row.hora_descargado || null,
        fecha_entregado: row.fecha_entregado || null,
        hora_entregado: row.hora_entregado || null,
      }));

      setPedidos(mapped);
    }
  }, []);

  const cargarFacturas = useCallback(async () => {
    const { data, error } = await supabase
      .from("paquetes_registro")
      .select(
        "id, tracking, nombre_paqueteria, tipo_paquete, notas, notas_imagenes, billing_subtotal, billing_tax, billing_total, approval_status, invoice_status, numero_cliente:numero_cliente_id (id, numero_cliente, nombre, email)",
      )
      .or("estado.ilike.%descargado%,estado.ilike.%entregado%")
      .order("creado_en", { ascending: false });

    if (error) {
      console.error("Error cargarFacturas", error);
      return;
    }

    if (data) {
      const mapped = (data as any[]).map((row) => ({
        id: row.id as string,
        tracking: (row.tracking as string) || "-",
        clienteNumero: row.numero_cliente?.numero_cliente ?? null,
        clienteNombre: row.numero_cliente?.nombre ?? null,
        clienteEmail: row.numero_cliente?.email ?? null,
        carrier: (row.nombre_paqueteria as string) || null,
        tipo_paquete: (row.tipo_paquete as string) || null,
        subtotal: (row.billing_subtotal as number | null) ?? null,
        tax: (row.billing_tax as number | null) ?? null,
        total: (row.billing_total as number | null) ?? null,
        approval_status: (row.approval_status as string | null) ?? null,
        invoice_status: (row.invoice_status as string | null) ?? null,
        notas: (row.notas as string | null) ?? null,
      }));

      // En el panel admin mostramos todas las facturas posibles para paquetes descargados/entregados,
      // aunque todavía tengan montos en cero.
      setFacturas(mapped);
    }
  }, []);

  const updateFacturaEnEstado = (id: string, partial: Partial<Factura>) => {
    setFacturas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...partial } : f)),
    );
  };

  useEffect(() => {
    cargarPersonal();
    cargarClientes();
    cargarPedidos();
    cargarFacturas();
    cargarLeads();

    const pedidoSubscription = supabase
      .channel("realtime-pedidos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "paquetes_registro" },
        () => {
          cargarPedidos();
          cargarFacturas();
        },
      )
      .subscribe();

    const clienteSubscription = supabase
      .channel("realtime-numero-cliente")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "numero_cliente" },
        () => {
          cargarClientes();
        },
      )
      .subscribe();
    const leadSubscription = supabase.channel('realtime-contact-leads').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_submissions' }, (payload) => {
      setLeads((prev) => [payload.new as Lead, ...prev]);
      setAdminNotice(`New customer lead received from ${(payload.new as Lead).nombre}`);
    }).subscribe();
    const signupSubscription = supabase.channel('realtime-customer-signups').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'numero_cliente' }, (payload) => {
      setAdminNotice(`New customer account created: ${(payload.new as any).nombre || 'customer'}`);
    }).subscribe();

    return () => {
      supabase.removeChannel(pedidoSubscription);
      supabase.removeChannel(clienteSubscription);
      supabase.removeChannel(leadSubscription);
      supabase.removeChannel(signupSubscription);
    };
  }, [cargarPersonal, cargarClientes, cargarPedidos, cargarFacturas, cargarLeads]);

  useEffect(() => {
    if (activeTab === "portal") void cargarPortalEvents();
  }, [activeTab, cargarPortalEvents]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === "pedidos") {
        cargarPedidos();
      } else if (activeTab === "facturas") {
        cargarFacturas();
      } else if (activeTab === "leads") {
        cargarLeads();
      } else if (activeTab === "portal") {
        cargarPortalEvents();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTab, cargarPedidos, cargarFacturas, cargarLeads, cargarPortalEvents]);

  const actualizarLead = async (id: string, changes: Partial<Lead>) => {
    const { data: legacyRows } = await supabase.from('contact_submissions').update(changes).eq('id', id).select('id');
    if (!legacyRows?.length) {
      const estado = changes.status === 'CONTACTED' ? 'contactado' : changes.status === 'CLOSED' ? 'cerrado' : changes.status === 'CONVERTED' ? 'contactado' : 'nuevo';
      await supabase.from('customer_leads').update({ estado }).eq('id', id);
    }
    setLeads((prev) => prev.map((lead) => lead.id === id ? { ...lead, ...changes } : lead));
  };

  const handleAdminChangeApproval = async (
    factura: Factura,
    status: 'APPROVED' | 'PENDING',
  ) => {
    const { error } = await supabase
      .from('paquetes_registro')
      .update({ approval_status: status })
      .eq('id', factura.id);

    if (error) {
      alert(error.message || 'No se pudo actualizar la aprobación de la factura');
      return;
    }

    updateFacturaEnEstado(factura.id, { approval_status: status });
  };

  const handleAdminChangeInvoiceStatus = async (
    factura: Factura,
    status: 'PENDING' | 'SENT' | 'PAID' | 'OVERDUE',
  ) => {
    const { error } = await supabase
      .from('paquetes_registro')
      .update({ invoice_status: status })
      .eq('id', factura.id);

    if (error) {
      alert(error.message || 'No se pudo actualizar el estado de la factura');
      return;
    }

    updateFacturaEnEstado(factura.id, { invoice_status: status });
  };

  const handleAdminEditInvoiceAddOns = async (factura: Factura) => {
    const { data: checkin } = await supabase.from("paquetes_checkin").select("id, cargos_adicionales").eq("paquete_id", factura.id).order("creado_en", { ascending: false }).limit(1).maybeSingle();
    if (!checkin) { alert("No check-in record exists for this invoice yet."); return; }
    setInvoiceAddOnType("");
    setInvoiceAddOnAmount("");
    setEditingInvoiceAddOns(factura);
  };

  const saveAdminInvoiceAddOn = async () => {
    if (!editingInvoiceAddOns || !invoiceAddOnType) return;
    const amount = Number(invoiceAddOnAmount);
    if (!Number.isFinite(amount) || amount <= 0) { alert("Enter an amount greater than zero."); return; }
    const { data: checkin } = await supabase.from("paquetes_checkin").select("id, cargos_adicionales").eq("paquete_id", editingInvoiceAddOns.id).order("creado_en", { ascending: false }).limit(1).maybeSingle();
    if (!checkin) { alert("No check-in record exists for this invoice yet."); return; }
    const subtotal = Number(editingInvoiceAddOns.subtotal || 0) + amount;
    const tax = subtotal * 0.15;
    const total = subtotal + tax;
    const prior = String(checkin.cargos_adicionales || "").split(",").map((item) => item.trim()).filter(Boolean);
    const charge = `${invoiceAddOnType} ($${amount.toFixed(2)})`;
    const [invoiceUpdate, checkinUpdate] = await Promise.all([
      supabase.from("paquetes_registro").update({ billing_subtotal: subtotal, billing_tax: tax, billing_total: total }).eq("id", editingInvoiceAddOns.id),
      supabase.from("paquetes_checkin").update({ cargos_adicionales: [...prior, charge].join(", ") }).eq("id", checkin.id),
    ]);
    if (invoiceUpdate.error || checkinUpdate.error) { alert(invoiceUpdate.error?.message || checkinUpdate.error?.message || "Could not update invoice add-on"); return; }
    updateFacturaEnEstado(editingInvoiceAddOns.id, { subtotal, tax, total });
    setEditingInvoiceAddOns(null);
  };

  const handleAdminSendInvoice = async (factura: Factura) => {
    if (!factura.clienteEmail) { alert("This customer does not have an email address."); return; }
    if ((factura.approval_status || "PENDING").toUpperCase() !== "APPROVED") { alert("Approve the invoice before sending it."); return; }
    const { data: checkin } = await supabase.from("paquetes_checkin").select("cargos_adicionales, consolidacion").eq("paquete_id", factura.id).order("creado_en", { ascending: false }).limit(1).maybeSingle();
    const extraCharges = String(checkin?.cargos_adicionales || "").split(",").map((item) => item.trim()).filter(Boolean);
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/send-invoice", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` }, body: JSON.stringify({ to: factura.clienteEmail, subject: `Invoice for ${factura.clienteNombre || factura.tracking}`, clientName: factura.clienteNombre, clientNumber: factura.clienteNumero, tracking: factura.tracking, typeLabel: factura.tipo_paquete || "Shipment", contents: factura.notas, subtotal: factura.subtotal || 0, tax: factura.tax || 0, total: factura.total || 0, extraCharges, isConsolidationBox: Boolean(checkin?.consolidacion) }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { alert(body.error || "Could not send invoice"); return; }
    await handleAdminChangeInvoiceStatus(factura, "SENT");
    alert("Invoice emailed successfully.");
  };

  const openConfirmPayInvoice = (factura: Factura) => {
    setPendingPayInvoice(factura);
  };

  const handleConfirmPayInvoice = async () => {
    if (!pendingPayInvoice) return;
    const target = pendingPayInvoice;
    await handleAdminChangeInvoiceStatus(target, 'PAID');
    setPendingPayInvoice(null);
  };

  const handleRemoveAccess = async (id: string) => {
    if (!window.confirm("¿Quitar acceso a este miembro de personal?")) return;

    try {
      const resp = await fetch("/api/personal/remove-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        alert(json.error || "No se pudo remover el acceso");
        return;
      }

      await cargarPersonal();
    } catch (err: any) {
      alert(err?.message || "Error de red al remover acceso");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("¿Eliminar completamente este usuario (personal + Auth)?")) return;

    try {
      const resp = await fetch("/api/personal/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        alert(json.error || "No se pudo eliminar el usuario");
        return;
      }

      await cargarPersonal();
    } catch (err: any) {
      alert(err?.message || "Error de red al eliminar usuario");
    }
  };

  const handleEliminarCliente = async (clienteId: string) => {
    if (!window.confirm("¿Eliminar este cliente y todos sus pedidos?")) return;

    try {
      await supabase.from("paquetes_checkin").delete().eq("numero_cliente_id", clienteId);
      await supabase.from("paquetes_registro").delete().eq("numero_cliente_id", clienteId);

      const { error } = await supabase
        .from("numero_cliente")
        .delete()
        .eq("id", clienteId);

      if (error) {
        alert(error.message || "No se pudo eliminar el cliente");
        return;
      }

      await cargarClientes();
      await cargarPedidos();
    } catch (err: any) {
      alert(err?.message || "Error de red al eliminar el cliente");
    }
  };

  // Iconos SVG específicos para cada sección
  const IconUsers = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );

  const IconBriefcase = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>
  );

  return (
    <div className="dashboard-root">
      <style suppressHydrationWarning>{`
        :root {
          --bg-main: #f4f7fa;
          --primary-blue: #2563eb;
          --success-green: #166534;
          --success-bg: #dcfce7;
          --text-dark: #0f172a;
          --text-muted: #64748b;
          --white: #ffffff;
          --border: #eef2f6;
          --radius: 24px;
        }

        body {
          margin: 0;
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          background-color: var(--bg-main);
          color: var(--text-dark);
          -webkit-font-smoothing: antialiased;
        }

        .dashboard-root {
          padding: 32px clamp(18px, 4vw, 56px) 56px;
          max-width: 1480px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 250px minmax(0, 1fr);
          gap: 24px;
          align-items: start;
        }

        .admin-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .admin-brand-logo {
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          background: var(--white);
          border: 1px solid var(--border);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
          overflow: hidden;
          flex: 0 0 auto;
        }

        .admin-brand-logo img {
          width: 48px;
          height: 48px;
          object-fit: contain;
        }

        /* Header Style */
        .page-header {
          margin-bottom: 28px;
          padding: 22px 24px;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid var(--border);
          border-radius: 22px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
        }

        .page-header h1 {
          font-size: clamp(1.7rem, 3vw, 2.25rem);
          margin: 0;
          font-weight: 700;
          color: var(--text-dark);
          letter-spacing: -0.02em;
        }

        .page-header p {
          color: var(--text-muted);
          margin: 8px 0 0;
          font-size: 1rem;
        }

        .page-header,
        .data-card {
          grid-column: 2;
          min-width: 0;
        }

        /* Sidebar navigation */
        .tabs-container {
          grid-column: 1;
          grid-row: 1 / span 2;
          position: sticky;
          top: 24px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          margin-bottom: 0;
          padding: 8px;
          overflow: visible;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: #f8fafc;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        }

        .admin-nav-group {
          min-width: 0;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
        }

        .admin-nav-label {
          display: flex;
          align-items: center;
          min-height: 28px;
          margin: 0 2px 8px;
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .admin-nav-section-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
          text-align: left;
        }

        .admin-nav-section-toggle .admin-nav-label {
          margin-bottom: 0;
        }

        .nav-chevron {
          color: #94a3b8;
          transition: transform 0.2s ease;
        }

        .nav-chevron.is-open {
          transform: rotate(180deg);
        }

        .admin-nav-buttons {
          display: flex;
          flex-direction: column;
          flex-wrap: nowrap;
          gap: 7px;
          overflow: visible;
          padding: 0;
        }

        .tab-pill {
          width: 100%;
          min-width: 0;
          justify-content: center;
          min-height: 40px;
          padding: 8px 9px;
          border-radius: 50px;
          background: var(--white);
          border: 1px solid transparent;
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .tab-pill:hover {
          background: #f8fafc;
        }

        .tab-pill.active {
          background: var(--white);
          color: var(--success-green);
          border: 1px solid var(--success-bg);
          box-shadow: 0 4px 12px rgba(22, 101, 52, 0.08);
        }

        .count-badge {
          font-weight: 600;
          color: #000;
          margin-left: 4px;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 8px;
          font-size: 0.85rem;
        }

        .tab-pill.active .count-badge {
          background: var(--success-bg);
          color: var(--success-green);
        }

        .tab-pill--operations.active { color: #2563eb; border-color: #bfdbfe; background: #eff6ff; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.14); }
        .tab-pill--customers.active { color: #7c3aed; border-color: #ddd6fe; background: #f5f3ff; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.14); }
        .tab-pill--billing.active { color: #b45309; border-color: #fde68a; background: #fffbeb; box-shadow: 0 4px 12px rgba(180, 83, 9, 0.14); }
        .tab-pill--admin.active { color: #be185d; border-color: #fbcfe8; background: #fdf2f8; box-shadow: 0 4px 12px rgba(190, 24, 93, 0.14); }
        .tab-pill--operations.active .count-badge { background: #dbeafe; color: #1d4ed8; }
        .tab-pill--customers.active .count-badge { background: #ede9fe; color: #6d28d9; }
        .tab-pill--billing.active .count-badge { background: #fef3c7; color: #92400e; }
        .tab-pill--admin.active .count-badge { background: #fce7f3; color: #9d174d; }

        @media (max-width: 1100px) {
          .dashboard-root { grid-template-columns: 215px minmax(0, 1fr); }
        }

        @media (max-width: 640px) {
          .dashboard-root { display: block; }
          .tabs-container { position: static; margin-bottom: 20px; }
          .admin-nav-buttons { flex-direction: row; flex-wrap: wrap; }
          .tab-pill { width: auto; flex: 1 1 auto; }
          .page-header, .data-card { margin-bottom: 20px; }
        }

        /* Contenedor Principal de Información */
        .data-card {
          background: var(--white);
          border-radius: var(--radius);
          box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 10px 15px -5px rgba(0,0,0,0.02);
          padding: 32px;
          border: 1px solid rgba(0,0,0,0.02);
        }

        .card-header-inner {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 24px;
        }

        .card-header-inner h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-dark);
        }
        
        .card-header-inner span {
          color: var(--text-muted);
          font-size: 0.95rem;
        }

        .divider {
          height: 1px;
          background: #f1f5f9;
          margin: 0 -32px 32px -32px;
        }

        /* Estado Vacío / Visual */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 100px 0;
          text-align: center;
        }

        .empty-icon-wrapper {
          width: 80px;
          height: 80px;
          background: #f8fafc;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          margin-bottom: 24px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.03);
        }

        .empty-state p {
          margin: 0;
          color: var(--text-dark);
          font-weight: 600;
          font-size: 1.1rem;
        }

        .empty-state span {
          color: var(--text-muted);
          font-size: 0.95rem;
          margin-top: 8px;
        }

        .pa-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 1.5rem;
        }

        .pa-modal {
          background: #ffffff;
          border-radius: 1.25rem;
          width: 100%;
          max-width: 460px;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
          padding: 1.75rem 1.75rem 1.5rem;
        }

        .pa-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .pa-modal-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
        }

        .pa-close-btn {
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 1.25rem;
          color: #94a3b8;
        }

        .pa-field {
          margin-bottom: 0.9rem;
        }

        .pa-field label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
          color: #475569;
        }

        .pa-input {
          width: 100%;
          padding: 0.6rem 0.75rem;
          border-radius: 0.6rem;
          border: 1px solid #e2e8f0;
          font-size: 0.9rem;
        }

        .pa-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.75rem;
        }

        .pa-secondary-btn {
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 0.5rem 1.2rem;
          font-size: 0.85rem;
          cursor: pointer;
        }

        .pa-primary-btn {
          border-radius: 999px;
          border: 1px solid #22c55e;
          background: #22c55e;
          padding: 0.5rem 1.4rem;
          font-size: 0.85rem;
          color: #ffffff;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>

      {/* Cabecera del Almacén */}
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
        <div className="admin-brand">
          <div className="admin-brand-logo">
            <Image src="/imagenes/logo.png" alt="Caribex Logistics Group" width={58} height={58} />
          </div>
          <div>
          <h1>Warehouse management</h1>
          <p>Track and manage shipments across all stages</p>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          style={{
            padding: '0.45rem 0.7rem',
            borderRadius: '999px',
            border: '1px solid #e11d48',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </header>

      {/* Grouped admin navigation */}
      <div className="tabs-container">
        <div className="admin-nav-group">
          <button type="button" className="admin-nav-section-toggle" onClick={() => toggleNavGroup('operations')}><span className="admin-nav-label">Operations</span><ChevronDown size={15} className={expandedNavGroups.operations ? 'nav-chevron is-open' : 'nav-chevron'} /></button>
          {expandedNavGroups.operations && <div className="admin-nav-buttons">
            <button className={`tab-pill tab-pill--operations ${activeTab === 'pedidos' ? 'active' : ''}`} onClick={() => setActiveTab('pedidos')}><IconBriefcase /> Shipments <span className="count-badge">{pedidos.length}</span></button>
            <button className={`tab-pill tab-pill--operations ${activeTab === 'client360' ? 'active' : ''}`} onClick={() => setActiveTab('client360')}><IconUsers /> Client 360</button>
            <button className={`tab-pill tab-pill--operations ${activeTab === 'incidencias' ? 'active' : ''}`} onClick={() => setActiveTab('incidencias')}><IconBriefcase /> Issues <span className="count-badge">{pedidosConIncidencia.length}</span></button>
          </div>}
        </div>
        <div className="admin-nav-group">
          <button type="button" className="admin-nav-section-toggle" onClick={() => toggleNavGroup('customers')}><span className="admin-nav-label">Customers</span><ChevronDown size={15} className={expandedNavGroups.customers ? 'nav-chevron is-open' : 'nav-chevron'} /></button>
          {expandedNavGroups.customers && <div className="admin-nav-buttons">
            <button className={`tab-pill tab-pill--customers ${activeTab === 'clientes' ? 'active' : ''}`} onClick={() => setActiveTab('clientes')}><IconBriefcase /> Customer # <span className="count-badge">{clientes.length}</span></button>
            <button className={`tab-pill tab-pill--customers ${activeTab === 'leads' ? 'active' : ''}`} onClick={() => setActiveTab('leads')}><IconBriefcase /> Leads <span className="count-badge">{leads.filter((lead) => lead.status === 'NEW').length}</span></button>
            <button className={`tab-pill tab-pill--customers ${activeTab === 'portal' ? 'active' : ''}`} onClick={() => setActiveTab('portal')}><IconBriefcase /> Portal alerts <span className="count-badge">{portalEvents.filter((event) => !event.success).length}</span></button>
          </div>}
        </div>
        <div className="admin-nav-group">
          <button type="button" className="admin-nav-section-toggle" onClick={() => toggleNavGroup('billing')}><span className="admin-nav-label">Billing & logistics</span><ChevronDown size={15} className={expandedNavGroups.billing ? 'nav-chevron is-open' : 'nav-chevron'} /></button>
          {expandedNavGroups.billing && <div className="admin-nav-buttons">
            <button className={`tab-pill tab-pill--billing ${activeTab === 'facturas' ? 'active' : ''}`} onClick={() => setActiveTab('facturas')}><IconBriefcase /> Invoices <span className="count-badge">{facturasCount}</span></button>
            <button className={`tab-pill tab-pill--billing ${activeTab === 'ferry' ? 'active' : ''}`} onClick={() => setActiveTab('ferry')}><IconBriefcase /> Ferry manifests</button>
          </div>}
        </div>
        <div className="admin-nav-group">
          <button type="button" className="admin-nav-section-toggle" onClick={() => toggleNavGroup('administration')}><span className="admin-nav-label">Administration</span><ChevronDown size={15} className={expandedNavGroups.administration ? 'nav-chevron is-open' : 'nav-chevron'} /></button>
          {expandedNavGroups.administration && <div className="admin-nav-buttons">
            <button className={`tab-pill tab-pill--admin ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}><IconUsers /> Staff <span className="count-badge">{personal.length}</span></button>
          </div>}
        </div>
      </div>

      {/* Card de Visualización de Datos */}
      <div className="data-card">
        <div className="card-header-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h3>
              {activeTab === 'personal' ? <IconUsers /> : <IconBriefcase />}{' '}
              {activeTab === 'personal'
                ? 'Listado de Personal'
                : activeTab === 'clientes'
                  ? 'Listado de Clientes'
                  : activeTab === 'client360'
                    ? 'Client 360'
                  : activeTab === 'pedidos'
                    ? 'Listado de Pedidos'
                  : activeTab === 'incidencias'
                    ? 'Paquetes con problemas'
                    : activeTab === 'facturas'
                      ? 'Panel de Facturas'
                      : activeTab === 'leads'
                        ? 'Customer leads'
                      : activeTab === 'portal'
                        ? 'Customer Portal alerts'
                      : 'Ferry manifests'}
            </h3>
            <span>
              {activeTab === 'personal'
                ? `${personal.length} registro${personal.length === 1 ? '' : 's'} en esta categoría`
                : activeTab === 'clientes'
                  ? `${clientes.length} registro${clientes.length === 1 ? '' : 's'} en esta categoría`
                  : activeTab === 'client360'
                    ? 'Complete customer profile and operational history'
                  : activeTab === 'pedidos'
                    ? `${pedidos.length} registro${pedidos.length === 1 ? '' : 's'} en esta categoría`
                  : activeTab === 'incidencias'
                    ? `${pedidosConIncidencia.length} registro${pedidosConIncidencia.length === 1 ? '' : 's'} en esta categoría`
                    : activeTab === 'facturas'
                      ? `${facturasCount} registro${facturasCount === 1 ? '' : 's'} en esta categoría`
                      : activeTab === 'leads'
                        ? `${leads.length} leads received from the website`
                      : activeTab === 'portal'
                        ? `${portalEvents.length} recent portal and account events`
                      : 'Create, share, and archive weekly ferry manifests'}
            </span>
          </div>

          {activeTab === 'personal' && (
            <button
              type="button"
              style={{
                padding: '0.55rem 1.3rem',
                borderRadius: '999px',
                border: '1px solid #22c55e',
                backgroundColor: '#22c55e',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 6px 14px rgba(34,197,94,0.25)',
                whiteSpace: 'nowrap',
              }}
              onClick={() => setIsModalOpen(true)}
            >
              + Agregar personal
            </button>
          )}

          {activeTab === 'clientes' && (
            <button
              type="button"
              style={{
                padding: '0.55rem 1.3rem',
                borderRadius: '999px',
                border: '1px solid #22c55e',
                backgroundColor: '#22c55e',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 6px 14px rgba(34,197,94,0.25)',
                whiteSpace: 'nowrap',
              }}
              onClick={abrirModalNuevoCliente}
            >
              + Agregar cliente
            </button>
          )}
        </div>

        <div className="divider"></div>

        {adminNotice && <div style={{ margin: '0.75rem 0', padding: '0.75rem 1rem', borderRadius: '0.75rem', background: '#dcfce7', border: '1px solid #86efac', color: '#166534', display: 'flex', justifyContent: 'space-between' }}><span>{adminNotice}</span><button type="button" onClick={() => setAdminNotice(null)} style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}>Dismiss</button></div>}

        {activeTab === 'client360' && <Client360Admin clientes={clientes} pedidos={pedidos} facturas={facturas} />}

        {activeTab === 'leads' && <div style={{ width: '100%', overflowX: 'auto' }}>
          {leads.length === 0 ? <p style={{ padding: '1.5rem', color: '#64748b' }}>No customer leads have been received yet.</p> : <table className="admin-table" style={{ minWidth: 980, width: '100%' }}><thead><tr><th>Date</th><th>Customer</th><th>Contact</th><th>Message</th><th>Status</th><th>Admin notes</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td>{new Date(lead.created_at).toLocaleString()}</td><td><strong>{lead.nombre}</strong><br /><small>{lead.service_type || 'Website contact'}</small></td><td><a href={`mailto:${lead.email}`}>{lead.email}</a><br />{lead.telefono || '-'}</td><td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{lead.mensaje}</td><td><select value={lead.status} onChange={(event) => actualizarLead(lead.id, { status: event.target.value as Lead['status'] })}><option value="NEW">New</option><option value="CONTACTED">Contacted</option><option value="CONVERTED">Converted</option><option value="CLOSED">Closed</option></select></td><td><textarea defaultValue={lead.admin_notes || ''} rows={2} placeholder="Add notes" onBlur={(event) => { const notes = event.target.value; if (notes !== (lead.admin_notes || '')) actualizarLead(lead.id, { admin_notes: notes }); }} /></td></tr>)}</tbody></table>}
        </div>}

        {activeTab === 'portal' && <div style={{ width: '100%', overflowX: 'auto' }}>
          {portalEvents.length === 0 ? <p style={{ padding: '1.5rem', color: '#64748b' }}>No customer portal or account events have been recorded yet.</p> : <table className="admin-table" style={{ minWidth: 980, width: '100%' }}><thead><tr><th>Date</th><th>Customer</th><th>Email</th><th>Result</th><th>Reason</th><th>Event</th></tr></thead><tbody>{portalEvents.map((event) => <tr key={event.id}><td>{new Date(event.created_at).toLocaleString()}</td><td>{event.customer_name || '-'}{event.account_number != null && <><br /><small>Account #{event.account_number}</small></>}</td><td>{event.email}</td><td><span style={{ color: event.success ? '#166534' : '#b91c1c', fontWeight: 700 }}>{event.success ? (event.event_type === 'login_attempt' ? 'Successful' : 'Completed') : 'Problem'}</span></td><td>{event.reason || '-'}</td><td>{portalEventLabel(event.event_type)}</td></tr>)}</tbody></table>}
        </div>}

        {activeTab === 'ferry' && <FerryManifestAdmin />}

        {activeTab === 'personal' && personal.length > 0 && (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.2fr 0.9fr',
                columnGap: '1rem',
                padding: '0.4rem 0',
                fontSize: '0.8rem',
                color: '#64748b',
                borderBottom: '1px solid #e2e8f0',
                fontWeight: 600,
                minWidth: 520,
              }}
            >
              <span style={{ minWidth: 130 }}>Nombre</span>
              <span style={{ minWidth: 130 }}>Rol</span>
              <span style={{ textAlign: 'right', minWidth: 180 }}>Staff task access</span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {personal.map((p) => (
                <li
                  key={p.id}
                  style={{
                    padding: '0.65rem 0',
                    borderBottom: '1px solid #e2e8f0',
                    fontSize: '0.9rem',
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.2fr 0.9fr',
                    columnGap: '1rem',
                    alignItems: 'center',
                    minWidth: 520,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '999px',
                        background: '#dbeafe',
                        color: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      {p.nombre?.charAt(0) || '?'}
                    </div>
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>{p.nombre}</span>
                  </div>
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{p.rol}</span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="pa-secondary-btn"
                      title="Edit staff task access"
                      onClick={() => openStaffPermissions(p)}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', borderColor: '#2563eb', color: '#1d4ed8', fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      Edit permissions
                    </button>
                    <button
                      type="button"
                      title="Eliminar personal"
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '999px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#fee2e2',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#b91c1c',
                      }}
                      onClick={() => handleDeleteUser(p.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'facturas' && facturas.length > 0 && (
          <div style={{ width: '100%', overflowX: 'hidden' }}>
            {/* Sub-pestañas internas para facturas (carrusel horizontal) */}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                overflowX: 'auto',
                paddingBottom: '0.25rem',
              }}
            >
              <button
                type="button"
                className={`tab-pill ${activeInvoiceTab === 'sinAprobar' ? 'active' : ''}`}
                style={{ minWidth: 120, fontSize: '0.8rem' }}
                onClick={() => setActiveInvoiceTab('sinAprobar')}
              >
                Sin aprobar
              </button>
              <button
                type="button"
                className={`tab-pill ${activeInvoiceTab === 'aprobadas' ? 'active' : ''}`}
                style={{ minWidth: 120, fontSize: '0.8rem' }}
                onClick={() => setActiveInvoiceTab('aprobadas')}
              >
                Aprobadas
              </button>
              <button
                type="button"
                className={`tab-pill ${activeInvoiceTab === 'enviadas' ? 'active' : ''}`}
                style={{ minWidth: 120, fontSize: '0.8rem' }}
                onClick={() => setActiveInvoiceTab('enviadas')}
              >
                Enviadas
              </button>
              <button
                type="button"
                className={`tab-pill ${activeInvoiceTab === 'pagadas' ? 'active' : ''}`}
                style={{ minWidth: 120, fontSize: '0.8rem' }}
                onClick={() => setActiveInvoiceTab('pagadas')}
              >
                Pagadas
              </button>
            </div>

            {/* Encabezados de la tabla de facturas */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 2.2fr 1.4fr 1fr 1fr 1.4fr 1.4fr 1.4fr',
                columnGap: '0.75rem',
                padding: '0.4rem 0',
                fontSize: '0.8rem',
                color: '#64748b',
                borderBottom: '1px solid #e2e8f0',
                fontWeight: 600,
                minWidth: 840,
              }}
            >
              <span style={{ minWidth: 100 }}>Tracking</span>
              <span style={{ minWidth: 160 }}>Cliente</span>
              <span style={{ minWidth: 140 }}>Carrier</span>
              <span style={{ minWidth: 90 }}>Subtotal</span>
              <span style={{ minWidth: 90 }}>Total</span>
              <span style={{ minWidth: 150 }}>Aprobación</span>
              <span style={{ minWidth: 150 }}>Estado factura</span>
              <span style={{ textAlign: 'right', minWidth: 160 }}>Acciones</span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {facturasFiltradas.map((f) => {
                const clienteLabel =
                  f.clienteNumero != null && f.clienteNombre
                    ? `#${f.clienteNumero} - ${f.clienteNombre}`
                    : '-';

                const approval = (f.approval_status || '').toUpperCase();
                const invoice = (f.invoice_status || '').toUpperCase();

                const approvalLabel =
                  approval === 'APPROVED'
                    ? 'Aprobada'
                    : approval === 'REJECTED'
                      ? 'Rechazada'
                      : 'Sin aprobar / Revisión';

                const invoiceLabel =
                  invoice === 'PAID'
                    ? 'Pagada'
                    : invoice === 'SENT'
                      ? 'Enviada'
                      : invoice === 'OVERDUE'
                        ? 'Vencida'
                        : 'Pendiente';

                const formatMoney = (v: number | null) => {
                  if (typeof v !== 'number' || Number.isNaN(v)) return '$0.00';
                  return `$${v.toFixed(2)}`;
                };

                const isApproved = approval === 'APPROVED';
                const isPendingApproval = !approval || approval === 'PENDING';
                const isSent = invoice === 'SENT';
                const isPaid = invoice === 'PAID';

                return (
                  <li
                    key={f.id}
                    style={{
                      padding: '0.8rem 0',
                      borderBottom: '1px solid #e2e8f0',
                      fontSize: '0.9rem',
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 2.2fr 1.4fr 1fr 1fr 1.4fr 1.4fr 1.4fr',
                      columnGap: '0.75rem',
                      alignItems: 'center',
                      minWidth: 840,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        minWidth: 100,
                        maxWidth: 140,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <button type="button" className="ga-client360-tracking" onClick={() => void abrirDetallePedido(f.id)} title="Open invoice details">
                        #{f.tracking}
                      </button>
                    </span>
                    <span
                      style={{
                        color: '#0f172a',
                        minWidth: 160,
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {clienteLabel}
                    </span>
                    <span
                      style={{
                        color: '#475569',
                        minWidth: 140,
                        maxWidth: 160,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.carrier || '-'}
                    </span>
                    <span style={{ fontFeatureSettings: '"tnum" on', minWidth: 90 }}>
                      {formatMoney(f.subtotal)}
                    </span>
                    <span style={{ fontFeatureSettings: '"tnum" on', minWidth: 90 }}>
                      {formatMoney(f.total)}
                    </span>
                    <span
                      style={{
                        color: approval === 'APPROVED' ? '#166534' : '#b45309',
                        fontSize: '0.85rem',
                        minWidth: 150,
                      }}
                    >
                      {approvalLabel}
                    </span>
                    <span
                      style={{
                        color:
                          invoice === 'PAID'
                            ? '#166534'
                            : invoice === 'OVERDUE'
                              ? '#b91c1c'
                              : '#1d4ed8',
                        fontSize: '0.85rem',
                        minWidth: 150,
                      }}
                    >
                      {invoiceLabel}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '0.35rem',
                        minWidth: 160,
                      }}
                    >
                      <button
                        type="button"
                        title="Open invoice details"
                        className="pa-secondary-btn"
                        style={{ padding: '0.3rem 0.55rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                        onClick={() => void abrirDetallePedido(f.id)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        title="Edit invoice add-ons"
                        style={{ width: 28, height: 28, borderRadius: '999px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => void handleAdminEditInvoiceAddOns(f)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Aprobar factura"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '999px',
                          border: '1px solid #bbf7d0',
                          backgroundColor: '#dcfce7',
                          fontSize: '0.75rem',
                          cursor: isApproved ? 'default' : 'pointer',
                          opacity: isApproved ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        disabled={isApproved}
                        onClick={() => !isApproved && handleAdminChangeApproval(f, 'APPROVED')}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        title="Marcar para revisión"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '999px',
                          border: '1px solid #fed7aa',
                          backgroundColor: '#ffedd5',
                          fontSize: '0.75rem',
                          cursor: isPendingApproval ? 'default' : 'pointer',
                          opacity: isPendingApproval ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        disabled={isPendingApproval}
                        onClick={() => !isPendingApproval && handleAdminChangeApproval(f, 'PENDING')}
                      >
                        <AlertCircle size={14} />
                      </button>
                      <button
                        type="button"
                        title="Marcar como enviada"
                        style={{
                          minWidth: 28,
                          height: 28,
                          borderRadius: '999px',
                          border: '1px solid #bfdbfe',
                          backgroundColor: '#eff6ff',
                          fontSize: '0.75rem',
                          cursor: isSent || isPaid ? 'default' : 'pointer',
                          opacity: isSent || isPaid ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        disabled={isSent || isPaid}
                        onClick={() => !(isSent || isPaid) && void handleAdminSendInvoice(f)}
                      >
                        <Send size={14} /> <span style={{ fontSize: '0.72rem' }}>Send</span>
                      </button>
                      <button
                        type="button"
                        title="Marcar como pagada"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '999px',
                          border: '1px solid #bbf7d0',
                          backgroundColor: '#dcfce7',
                          fontSize: '0.75rem',
                          cursor: isPaid ? 'default' : 'pointer',
                          opacity: isPaid ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        disabled={isPaid}
                        onClick={() => !isPaid && openConfirmPayInvoice(f)}
                      >
                        <DollarSign size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {activeTab === 'incidencias' && pedidosConIncidencia.length > 0 && (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 2fr 2.6fr 1fr",
                columnGap: "1rem",
                padding: "0.4rem 0",
                fontSize: "0.8rem",
                color: "#64748b",
                borderBottom: "1px solid #e2e8f0",
                fontWeight: 600,
                minWidth: 640,
              }}
            >
              <span style={{ minWidth: 100 }}>Tracking</span>
              <span style={{ minWidth: 140 }}>Cliente</span>
              <span style={{ minWidth: 220 }}>Descripción del problema</span>
              <span style={{ textAlign: "right", minWidth: 120 }}>Acciones</span>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {pedidosConIncidencia.map((p) => {
                const clienteLabel =
                  p.clienteNumero != null && p.clienteNombre
                    ? `#${p.clienteNumero} - ${p.clienteNombre}`
                    : "";
                const descripcion = p.notas?.trim() || "Sin descripción";
                const urls = obtenerUrlsIncidencia(p);

                return (
                  <li
                    key={p.id}
                    style={{
                      padding: "0.8rem 0",
                      borderBottom: "1px solid #e2e8f0",
                      fontSize: "0.9rem",
                      display: "grid",
                      gridTemplateColumns: "1.4fr 2fr 2.6fr 1fr",
                      columnGap: "0.75rem",
                      alignItems: "center",
                      minWidth: 640,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        minWidth: 100,
                        maxWidth: 140,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      #{p.tracking}
                    </span>
                    <span
                      style={{
                        color: "#0f172a",
                        minWidth: 140,
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {clienteLabel}
                    </span>
                    <span
                      style={{
                        color: "#475569",
                        fontSize: "0.85rem",
                        minWidth: 220,
                        maxWidth: 260,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {descripcion}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.35rem",
                      }}
                    >
                      <button
                        type="button"
                        title="Ver imágenes"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "999px",
                          border: "1px solid #bfdbfe",
                          backgroundColor: "#eff6ff",
                          cursor: urls.length ? "pointer" : "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#1d4ed8",
                          opacity: urls.length ? 1 : 0.5,
                        }}
                        disabled={urls.length === 0}
                        onClick={() => {
                          setIncidenciaTitulo(`#${p.tracking}`);
                          setIncidenciaImagenes(urls);
                        }}
                      >
                        <ImageIcon size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {activeTab === 'clientes' && clientes.length > 0 && (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '0.7fr 1.5fr 1.8fr 1.2fr 1.1fr 1fr 0.8fr',
                columnGap: '1rem',
                padding: '0.4rem 0',
                fontSize: '0.8rem',
                color: '#64748b',
                borderBottom: '1px solid #e2e8f0',
                fontWeight: 600,
                minWidth: 960,
              }}
            >
              <span style={{ minWidth: 80 }}>Número</span>
              <span style={{ minWidth: 140 }}>Nombre</span>
              <span style={{ minWidth: 220 }}>Email</span>
              <span style={{ minWidth: 120 }}>Teléfono</span>
              <span style={{ minWidth: 110 }}>Puerto</span>
              <span style={{ minWidth: 120 }}>Tipo cuenta</span>
              <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 80 }}>Acciones</div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {clientes.map((c) => (
                <li
                  key={c.id}
                  style={{
                    padding: '0.65rem 0',
                    borderBottom: '1px solid #e2e8f0',
                    fontSize: '0.9rem',
                    display: 'grid',
                    gridTemplateColumns: '0.7fr 1.5fr 1.8fr 1.2fr 1.1fr 1fr 0.8fr',
                    columnGap: '1rem',
                    alignItems: 'center',
                    minWidth: 960,
                  }}
                >
                  <span style={{ fontWeight: 600, minWidth: 80 }}>#{c.numero_cliente}</span>
                  <span style={{ color: '#0f172a', minWidth: 140 }}>{c.nombre}</span>
                  <span
                    style={{
                      color: '#475569',
                      minWidth: 220,
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.email || '-'}
                  </span>
                  <span
                    style={{
                      color: '#475569',
                      minWidth: 120,
                      maxWidth: 120,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.telefono || '-'}
                  </span>
                  <span style={{ color: '#475569', textTransform: 'capitalize', minWidth: 110 }}>{c.puerto || '-'}</span>
                  <span style={{ color: '#475569', minWidth: 120 }}>{c.tipo_cuenta || '-'}</span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                    <button
                      type="button"
                      title="Editar cliente"
                      onClick={() => handleEditarCliente(c)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '999px',
                        border: '1px solid #cbd5f5',
                        backgroundColor: '#eff6ff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1d4ed8',
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      title="Eliminar cliente"
                      onClick={() => handleEliminarCliente(c.id)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '999px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#fee2e2',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#b91c1c',
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'pedidos' && pedidos.length > 0 && (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            {/* Filtro por número o nombre de cliente */}
            <div style={{ marginBottom: '0.75rem' }}>
              <input
                type="text"
                placeholder="Filtrar por # de cliente o nombre..."
                value={pedidoFiltro}
                onChange={(e) => setPedidoFiltro(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '320px',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '999px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Encabezados de la tabla de pedidos */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 2fr 1fr 1.2fr',
                columnGap: '0.75rem',
                padding: '0.4rem 0',
                fontSize: '0.8rem',
                color: '#64748b',
                borderBottom: '1px solid #e2e8f0',
                fontWeight: 600,
                minWidth: 520,
              }}
            >
              <span style={{ minWidth: 100 }}>Tracking</span>
              <span style={{ minWidth: 140 }}>Cliente</span>
              <span style={{ minWidth: 120 }}>Estado</span>
              <span style={{ textAlign: 'right', minWidth: 80 }}>Acciones</span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pedidos
                .filter((p) => {
                  const term = pedidoFiltro.trim().toLowerCase();
                  if (!term) return true;

                  const num = p.clienteNumero != null ? String(p.clienteNumero) : "";
                  const name = p.clienteNombre ? p.clienteNombre.toLowerCase() : "";

                  return (
                    num.startsWith(term) ||
                    name.includes(term)
                  );
                })
                .map((p) => {
                const clienteLabel =
                  p.clienteNumero != null && p.clienteNombre
                    ? `#${p.clienteNumero} - ${p.clienteNombre}`
                    : '';

                return (
                  <li
                    key={p.id}
                    style={{
                      padding: '0.8rem 0',
                      borderBottom: '1px solid #e2e8f0',
                      fontSize: '0.9rem',
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 2fr 1fr 1.2fr',
                      columnGap: '0.75rem',
                      alignItems: 'center',
                      minWidth: 520,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        minWidth: 100,
                        maxWidth: 140,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      #{p.tracking}
                    </span>
                    <span
                      style={{
                        color: '#0f172a',
                        minWidth: 140,
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {clienteLabel}
                    </span>
                    <span
                      style={{
                        color: p.estado === 'Check In' ? '#16a34a' : '#0f172a',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        minWidth: 120,
                        maxWidth: 160,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.estado || '-'}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                      <button
                        type="button"
                        title="Editar pedido"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '999px',
                          border: '1px solid #bfdbfe',
                          backgroundColor: '#eff6ff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#1d4ed8',
                        }}
                        onClick={() => abrirEditarPedido(p)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        title="Eliminar pedido"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '999px',
                          border: '1px solid #fecaca',
                          backgroundColor: '#fee2e2',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#b91c1c',
                        }}
                        onClick={() => handleDeletePedido(p.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {incidenciaImagenes && incidenciaImagenes.length > 0 && (
        <div
          className="pa-modal-overlay"
          onClick={() => {
            setIncidenciaImagenes(null);
            setIncidenciaTitulo("");
          }}
        >
          <div
            className="pa-modal"
            style={{
              maxWidth: "960px",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pa-modal-header">
              <h4
                className="pa-modal-title"
                style={{
                  maxWidth: "calc(100% - 40px)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginRight: "0.5rem",
                }}
              >
                {incidenciaTitulo || "Imágenes de incidencia"}
              </h4>
              <button
                type="button"
                className="pa-close-btn"
                onClick={() => {
                  setIncidenciaImagenes(null);
                  setIncidenciaTitulo("");
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1rem",
                justifyContent: "center",
              }}
            >
              {incidenciaImagenes.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  style={{
                    borderRadius: "0.75rem",
                    overflow: "hidden",
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb",
                    maxWidth: "420px",
                    maxHeight: "420px",
                  }}
                >
                  <Image
                    src={url}
                    alt="Incidencia"
                    width={800}
                    height={800}
                    unoptimized
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingInvoiceAddOns && (
        <div className="pa-modal-overlay">
          <div className="pa-modal">
            <div className="pa-modal-header">
              <h4 className="pa-modal-title">Edit invoice add-on</h4>
              <button type="button" className="pa-close-btn" onClick={() => setEditingInvoiceAddOns(null)}>×</button>
            </div>
            <div className="pa-field">
              <label htmlFor="admin-invoice-charge-type">Charge type</label>
              <select id="admin-invoice-charge-type" className="pa-input" value={invoiceAddOnType} onChange={(event) => setInvoiceAddOnType(event.target.value)}>
                <option value="">Select a charge type</option>
                {ADMIN_EXTRA_CHARGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="pa-field">
              <label htmlFor="admin-invoice-charge-amount">Amount</label>
              <input id="admin-invoice-charge-amount" className="pa-input" type="number" min="0.01" step="0.01" value={invoiceAddOnAmount} onChange={(event) => setInvoiceAddOnAmount(event.target.value)} placeholder="0.00" />
            </div>
            <div className="pa-modal-actions">
              <button type="button" className="pa-secondary-btn" onClick={() => setEditingInvoiceAddOns(null)}>Cancel</button>
              <button type="button" className="pa-primary-btn" disabled={!invoiceAddOnType || !invoiceAddOnAmount} onClick={() => void saveAdminInvoiceAddOn()}>Save charge</button>
            </div>
          </div>
        </div>
      )}

      {pendingPayInvoice && (
        <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ga-modal" style={{ maxWidth: 420 }}>
            <div className="ga-modal-header">
              <h4>Confirmar pago</h4>
              <button
                type="button"
                className="ga-icon-button ga-icon-button-light"
                onClick={() => setPendingPayInvoice(null)}
                aria-label="Cerrar"
              >
                <span style={{ lineHeight: 1 }}>×</span>
              </button>
            </div>
            <div className="ga-modal-body">
              <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                {`¿Marcar como PAGADA la factura del tracking ${pendingPayInvoice.tracking}?`}
              </p>
              {pendingPayInvoice.clienteNombre && (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                  Cliente: #{pendingPayInvoice.clienteNumero ?? '-'} - {pendingPayInvoice.clienteNombre}
                </p>
              )}
            </div>
            <div className="ga-modal-actions" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="ga-secondary-button"
                onClick={() => setPendingPayInvoice(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ga-primary-button"
                onClick={handleConfirmPayInvoice}
              >
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}

      {isPedidoDetalleOpen && (
        <div className="pa-modal-overlay">
          <div
            className="pa-modal"
            style={{
              maxWidth: "780px",
              maxHeight: "80vh",
              overflowY: "auto",
              padding: "1.75rem 2rem 1.75rem",
            }}
          >

            <div className="pa-modal-header">
              <h4 className="pa-modal-title">Detalle de pedido</h4>
              <button
                type="button"
                className="pa-close-btn"
                onClick={() => {
                  setIsPedidoDetalleOpen(false);
                  setPedidoDetalle(null);
                  setPedidoDetalleError(null);
                }}
              >
                ×
              </button>
            </div>

            {pedidoDetalleLoading && (
              <p style={{ fontSize: "0.9rem", color: "#64748b" }}>Cargando detalle...</p>
            )}

            {!pedidoDetalleLoading && pedidoDetalleError && (
              <p style={{ color: "#dc2626", fontSize: "0.85rem" }}>{pedidoDetalleError}</p>
            )}

            {!pedidoDetalleLoading && pedidoDetalle && (
              <div style={{ fontSize: "0.85rem", color: "#0f172a", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* paquetes_registro */}
                <section
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "0.9rem",
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h5 style={{ marginBottom: "0.6rem", fontWeight: 700 }}>Tabla: paquetes_registro</h5>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 180px) minmax(0, 1fr)",
                      rowGap: "0.2rem",
                      columnGap: "0.75rem",
                    }}
                  >
                    {Object.entries(pedidoDetalle)
                      .filter(([key]) => key !== "numero_cliente" && key !== "paquetes_checkin")
                      .map(([key, value]) => (
                        <React.Fragment key={key}>
                          <div style={{ fontWeight: 600, color: "#4b5563", textTransform: "none" }}>{key}</div>
                          <div style={{ color: "#111827" }}>{String(value ?? "-")}</div>
                        </React.Fragment>
                      ))}
                  </div>
                </section>

                {/* numero_cliente */}
                <section
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "0.9rem",
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h5 style={{ marginBottom: "0.6rem", fontWeight: 700 }}>Tabla: numero_cliente (relación)</h5>
                  {pedidoDetalle.numero_cliente ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 180px) minmax(0, 1fr)",
                        rowGap: "0.2rem",
                        columnGap: "0.75rem",
                      }}
                    >
                      {Object.entries(pedidoDetalle.numero_cliente as any).map(([key, value]) => (
                        <React.Fragment key={key}>
                          <div style={{ fontWeight: 600, color: "#4b5563" }}>{key}</div>
                          <div style={{ color: "#111827" }}>{String(value ?? "-")}</div>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      Este pedido no tiene número de cliente asociado.
                    </p>
                  )}
                </section>

                {/* paquetes_checkin */}
                <section
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "0.9rem",
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h5 style={{ marginBottom: "0.6rem", fontWeight: 700 }}>Tabla: paquetes_checkin (relación)</h5>
                  {pedidoDetalle.paquetes_checkin && (pedidoDetalle.paquetes_checkin as any[]).length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {(pedidoDetalle.paquetes_checkin as any[]).map((check, idx) => (
                        <div
                          key={check.id || idx}
                          style={{
                            padding: "0.7rem 0.85rem",
                            borderRadius: "0.75rem",
                            border: "1px dashed #cbd5f5",
                            background: "#ffffff",
                          }}
                        >
                          <div style={{ marginBottom: "0.4rem", fontWeight: 600, color: "#1d4ed8" }}>
                            Registro Check-In #{idx + 1}
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 180px) minmax(0, 1fr)",
                              rowGap: "0.18rem",
                              columnGap: "0.75rem",
                            }}
                          >
                            {Object.entries(check).map(([key, value]) => (
                              <React.Fragment key={key}>
                                <div style={{ fontWeight: 600, color: "#4b5563" }}>{key}</div>
                                <div style={{ color: "#111827" }}>{String(value ?? "-")}</div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      No hay registros de Check In asociados a este paquete.
                    </p>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {isPedidoEditOpen && (
        <div className="pa-modal-overlay">
          <div className="pa-modal" style={{ maxWidth: "640px" }}>
            <div className="pa-modal-header">
              <h4 className="pa-modal-title">Editar pedido</h4>
              <button type="button" className="pa-close-btn" onClick={cerrarModalEditarPedido}>
                ×
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleUpdatePedido();
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label>Tracking</label>
                  <input
                    className="pa-input"
                    value={pedidoForm.tracking}
                    onChange={(e) => handlePedidoFormChange("tracking", e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label>Carrier</label>
                  <input
                    className="pa-input"
                    value={pedidoForm.carrier}
                    onChange={(e) => handlePedidoFormChange("carrier", e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label>Tipo de paquete</label>
                  <select
                    className="pa-input"
                    value={pedidoForm.tipo_paquete}
                    onChange={(e) => handlePedidoFormChange("tipo_paquete", e.target.value)}
                  >
                    <option value="BOX">Caja</option>
                    <option value="PACKAGE">Paquete</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label>Estado</label>
                  <select
                    className="pa-input"
                    value={pedidoForm.estado}
                    onChange={(e) => handlePedidoFormChange("estado", e.target.value)}
                  >
                    {(() => {
                      const BASE = [
                        "Recibido",
                        "Registro",
                        "En transito",
                        "Descargado",
                        "Entregado",
                      ];
                      const current = pedidoForm.estado || "";
                      const options =
                        current && !BASE.includes(current) ? [current, ...BASE] : BASE;

                      return options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label>Remitente</label>
                  <input
                    className="pa-input"
                    value={pedidoForm.remitente}
                    onChange={(e) => handlePedidoFormChange("remitente", e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label>Destinatario</label>
                  <input
                    className="pa-input"
                    value={pedidoForm.destinatario}
                    onChange={(e) => handlePedidoFormChange("destinatario", e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label>Contenido</label>
                  <input
                    className="pa-input"
                    value={pedidoForm.contenido}
                    onChange={(e) => handlePedidoFormChange("contenido", e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label>Notas</label>
                  <input
                    className="pa-input"
                    value={pedidoForm.notas}
                    onChange={(e) => handlePedidoFormChange("notas", e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label>Cliente</label>
                  <input
                    className="pa-input"
                    value={pedidoClienteLabel || "Sin cliente asignado"}
                    readOnly
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  marginBottom: "1.25rem",
                  borderTop: "1px solid #e5e7eb",
                  paddingTop: "0.75rem",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "0.75rem 1rem",
                    fontSize: "0.8rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#4b5563" }}>Registrado por</div>
                    <div style={{ color: "#111827" }}>{pedidoForm.registro || "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#4b5563" }}>Hora/fecha recibido</div>
                    <div style={{ color: "#111827" }}>{pedidoForm.hora_fecha || "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#4b5563" }}>Descargado por</div>
                    <div style={{ color: "#111827" }}>{pedidoForm.descargado || "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#4b5563" }}>Fecha/hora descargado</div>
                    <div style={{ color: "#111827" }}>
                      {pedidoForm.fecha_descargado || "-"} {pedidoForm.hora_descargado || ""}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#4b5563" }}>Entregado por</div>
                    <div style={{ color: "#111827" }}>{pedidoForm.entregado_por || "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#4b5563" }}>Fecha/hora entregado</div>
                    <div style={{ color: "#111827" }}>
                      {pedidoForm.fecha_entregado || "-"} {pedidoForm.hora_entregado || ""}
                    </div>
                  </div>
                </div>

                {(
                  pedidoCheckin ||
                  pedidoCheckinForm.alto !== "" ||
                  pedidoCheckinForm.ancho !== "" ||
                  pedidoCheckinForm.largo !== "" ||
                  pedidoCheckinForm.peso !== "" ||
                  pedidoCheckinForm.problema ||
                  pedidoCheckinForm.consolidacion ||
                  pedidoCheckinForm.problema_notas.trim() !== "" ||
                  pedidoCheckinForm.cargos_adicionales.trim() !== ""
                ) && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "0.75rem",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        marginBottom: "0.4rem",
                        color: "#374151",
                      }}
                    >
                      Datos de Check In
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "0.4rem 1rem",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: "#4b5563" }}>Alto</div>
                        <input
                          className="pa-input"
                          type="number"
                          value={pedidoCheckinForm.alto}
                          onChange={(e) =>
                            handleCheckinFormChange("alto", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#4b5563" }}>Ancho</div>
                        <input
                          className="pa-input"
                          type="number"
                          value={pedidoCheckinForm.ancho}
                          onChange={(e) =>
                            handleCheckinFormChange("ancho", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#4b5563" }}>Largo</div>
                        <input
                          className="pa-input"
                          type="number"
                          value={pedidoCheckinForm.largo}
                          onChange={(e) =>
                            handleCheckinFormChange("largo", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#4b5563" }}>Peso</div>
                        <input
                          className="pa-input"
                          type="number"
                          value={pedidoCheckinForm.peso}
                          onChange={(e) =>
                            handleCheckinFormChange("peso", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#4b5563" }}>Problema</div>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <input
                            type="checkbox"
                            checked={pedidoCheckinForm.problema}
                            onChange={(e) =>
                              handleCheckinFormChange("problema", e.target.checked)
                            }
                          />
                          <span style={{ color: "#111827" }}>
                            {pedidoCheckinForm.problema ? "Sí" : "No"}
                          </span>
                        </label>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#4b5563" }}>Consolidación</div>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <input
                            type="checkbox"
                            checked={pedidoCheckinForm.consolidacion}
                            onChange={(e) =>
                              handleCheckinFormChange("consolidacion", e.target.checked)
                            }
                          />
                          <span style={{ color: "#111827" }}>
                            {pedidoCheckinForm.consolidacion ? "Sí" : "No"}
                          </span>
                        </label>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ fontWeight: 600, color: "#4b5563" }}>Notas de problema</div>
                        <textarea
                          className="pa-input"
                          rows={2}
                          value={pedidoCheckinForm.problema_notas}
                          onChange={(e) =>
                            handleCheckinFormChange("problema_notas", e.target.value)
                          }
                        />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ fontWeight: 600, color: "#4b5563" }}>Cargos adicionales</div>
                        <textarea
                          className="pa-input"
                          rows={2}
                          value={pedidoCheckinForm.cargos_adicionales}
                          onChange={(e) =>
                            handleCheckinFormChange("cargos_adicionales", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ display: "grid", gap: "0.35rem" }}>
                  <label>Fecha descargado</label>
                  <input
                    type="date"
                    className="pa-input"
                    value={pedidoForm.fecha_descargado}
                    onChange={(e) => handlePedidoFormChange("fecha_descargado", e.target.value)}
                  />
                </div>
                <div style={{ display: "grid", gap: "0.35rem" }}>
                  <label>Hora descargado</label>
                  <input
                    type="time"
                    className="pa-input"
                    value={pedidoForm.hora_descargado}
                    onChange={(e) => handlePedidoFormChange("hora_descargado", e.target.value)}
                  />
                </div>
                <div style={{ display: "grid", gap: "0.35rem" }}>
                  <label>Fecha entregado</label>
                  <input
                    type="date"
                    className="pa-input"
                    value={pedidoForm.fecha_entregado}
                    onChange={(e) => handlePedidoFormChange("fecha_entregado", e.target.value)}
                  />
                </div>
                <div style={{ display: "grid", gap: "0.35rem" }}>
                  <label>Hora entregado</label>
                  <input
                    type="time"
                    className="pa-input"
                    value={pedidoForm.hora_entregado}
                    onChange={(e) => handlePedidoFormChange("hora_entregado", e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
                <button
                  type="button"
                  className="pa-secondary-btn"
                  onClick={generarQrDesdeFormulario}
                >
                  Generar QR
                </button>
                {pedidoQrUrl && (
                  <div style={{ textAlign: "center" }}>
                    <Image
                      src={pedidoQrUrl}
                      alt="QR pedido"
                      width={200}
                      height={200}
                      unoptimized
                      style={{ maxWidth: "200px" }}
                    />
                  </div>
                )}
              </div>

              <div className="pa-modal-actions">
                <button
                  type="button"
                  className="pa-secondary-btn"
                  onClick={cerrarModalEditarPedido}
                >
                  Cancelar
                </button>
                <button type="submit" className="pa-primary-btn">
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="pa-modal-overlay">
          <div className="pa-modal">
            <div className="pa-modal-header">
              <h4 className="pa-modal-title">Nuevo miembro de personal</h4>
              <button
                type="button"
                className="pa-close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setModalError(null);
                setSaving(true);

                try {
                  const resp = await fetch("/api/personal/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(nuevoPersonal),
                  });

                  const json = await resp.json();

                  if (!resp.ok) {
                    setModalError(json.error || "Error al crear el usuario");
                    setSaving(false);
                    return;
                  }

                  // éxito: recargar lista, limpiar y cerrar
                  await cargarPersonal();
                  setNuevoPersonal({ email: "", nombre: "", password: "", permissions: { ...DEFAULT_STAFF_PERMISSIONS } });
                  setSaving(false);
                  setIsModalOpen(false);
                } catch (err: any) {
                  setModalError(err?.message || "Error de red al crear el usuario");
                  setSaving(false);
                }
              }}
            >
              <div className="pa-field">
                <label htmlFor="pa-email">Correo electrónico</label>
                <input
                  id="pa-email"
                  type="email"
                  className="pa-input"
                  value={nuevoPersonal.email}
                  onChange={(e) =>
                    setNuevoPersonal((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="pa-field">
                <label htmlFor="pa-nombre">Nombre del personal</label>
                <input
                  id="pa-nombre"
                  type="text"
                  className="pa-input"
                  value={nuevoPersonal.nombre}
                  onChange={(e) =>
                    setNuevoPersonal((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="pa-field">
                <label htmlFor="pa-password">Contraseña</label>
                <input
                  id="pa-password"
                  type="text"
                  className="pa-input"
                  value={nuevoPersonal.password}
                  onChange={(e) =>
                    setNuevoPersonal((prev) => ({ ...prev, password: e.target.value }))
                  }
                  required
                />
              </div>

              <fieldset className="pa-permission-grid">
                <legend>Task access</legend>
                {STAFF_PERMISSION_OPTIONS.map((permission) => (
                  <label key={permission.key} className="pa-permission-option">
                    <input
                      type="checkbox"
                      checked={nuevoPersonal.permissions[permission.key]}
                      onChange={(event) => setNuevoPersonal((prev) => ({ ...prev, permissions: { ...prev.permissions, [permission.key]: event.target.checked } }))}
                    />
                    <span>{permission.label}</span>
                  </label>
                ))}
              </fieldset>

              <div className="pa-modal-actions">
                <button
                  type="button"
                  className="pa-secondary-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="pa-primary-btn" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>

              {modalError && (
                <p style={{ marginTop: "0.6rem", color: "#dc2626", fontSize: "0.8rem" }}>
                  {modalError}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {editingStaff && (
        <div className="pa-modal-overlay">
          <div className="pa-modal">
            <div className="pa-modal-header">
              <h4 className="pa-modal-title">Task access: {editingStaff.nombre}</h4>
              <button type="button" className="pa-close-btn" onClick={() => setEditingStaff(null)}>×</button>
            </div>
            <fieldset className="pa-permission-grid">
              <legend>Select the tasks this staff member may access</legend>
              {STAFF_PERMISSION_OPTIONS.map((permission) => (
                <label key={permission.key} className="pa-permission-option">
                  <input
                    type="checkbox"
                    checked={editingStaffPermissions[permission.key]}
                    onChange={(event) => setEditingStaffPermissions((prev) => ({ ...prev, [permission.key]: event.target.checked }))}
                  />
                  <span>{permission.label}</span>
                </label>
              ))}
            </fieldset>
            <div className="pa-modal-actions">
              <button type="button" className="pa-secondary-btn" onClick={() => setEditingStaff(null)}>Cancel</button>
              <button type="button" className="pa-primary-btn" disabled={staffPermissionSaving} onClick={() => void saveStaffPermissions()}>{staffPermissionSaving ? "Saving…" : "Save access"}</button>
            </div>
          </div>
        </div>
      )}

      {isClienteModalOpen && (
        <div className="pa-modal-overlay">
          <div className="pa-modal">
            <div className="pa-modal-header">
              <h4 className="pa-modal-title">
                {clienteEditandoId ? "Editar cliente" : "Nuevo cliente"}
              </h4>
              <button
                type="button"
                className="pa-close-btn"
                onClick={cerrarModalCliente}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setClienteModalError(null);
                setClienteSaving(true);

                try {
                  if (nuevoCliente.email) {
                    let emailQuery = supabase
                      .from("numero_cliente")
                      .select("id")
                      .eq("email", nuevoCliente.email);

                    if (clienteEditandoId) {
                      emailQuery = emailQuery.neq("id", clienteEditandoId);
                    }

                    const { data: emailMatch, error: emailError } = await emailQuery.maybeSingle();

                    if (emailError) {
                      setClienteModalError(emailError.message || "Error validando el correo");
                      setClienteSaving(false);
                      return;
                    }

                    if (emailMatch) {
                      setClienteModalError("Este correo electrónico ya está registrado.");
                      setClienteSaving(false);
                      return;
                    }
                  }

                  if (clienteEditandoId) {
                    const { error } = await supabase
                      .from("numero_cliente")
                      .update({
                        nombre: nuevoCliente.nombre,
                        email: nuevoCliente.email || null,
                        telefono: nuevoCliente.telefono || null,
                        puerto: nuevoCliente.puerto || null,
                        tipo_cuenta: nuevoCliente.tipoCuenta,
                      })
                      .eq("id", clienteEditandoId);

                    if (error) {
                      setClienteModalError(error.message || "Error al actualizar el cliente");
                      setClienteSaving(false);
                      return;
                    }
                  } else {
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

                    const { error: insertError } = await supabase
                      .from("numero_cliente")
                      .insert({
                        nombre: nuevoCliente.nombre,
                        email: nuevoCliente.email,
                        telefono: nuevoCliente.telefono,
                        puerto: nuevoCliente.puerto,
                        tipo_cuenta: nuevoCliente.tipoCuenta,
                        numero_cliente: siguienteNumero,
                      });

                    if (insertError) {
                      setClienteModalError(insertError.message || "Error al crear el cliente");
                      setClienteSaving(false);
                      return;
                    }
                  }

                  await cargarClientes();
                  cerrarModalCliente();
                } catch (err: any) {
                  setClienteModalError(err?.message || "Error de red al guardar el cliente");
                  setClienteSaving(false);
                }
              }}
            >
              <div className="pa-field">
                <label htmlFor="cliente-nombre">Nombre completo</label>
                <input
                  id="cliente-nombre"
                  type="text"
                  className="pa-input"
                  value={nuevoCliente.nombre}
                  onChange={(e) =>
                    setNuevoCliente((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="pa-field">
                <label htmlFor="cliente-email">Correo electrónico</label>
                <input
                  id="cliente-email"
                  type="email"
                  className="pa-input"
                  value={nuevoCliente.email}
                  onChange={(e) =>
                    setNuevoCliente((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="pa-field">
                <label htmlFor="cliente-telefono">Teléfono</label>
                <input
                  id="cliente-telefono"
                  type="tel"
                  className="pa-input"
                  value={nuevoCliente.telefono}
                  onChange={(e) =>
                    setNuevoCliente((prev) => ({ ...prev, telefono: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="pa-field">
                <label htmlFor="cliente-puerto">Puerto / ubicación</label>
                <input
                  id="cliente-puerto"
                  type="text"
                  className="pa-input"
                  value={nuevoCliente.puerto}
                  onChange={(e) =>
                    setNuevoCliente((prev) => ({ ...prev, puerto: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="pa-field">
                <label htmlFor="cliente-tipo">Tipo de cuenta</label>
                <select
                  id="cliente-tipo"
                  className="pa-input"
                  value={nuevoCliente.tipoCuenta}
                  onChange={(e) =>
                    setNuevoCliente((prev) => ({ ...prev, tipoCuenta: e.target.value }))
                  }
                >
                  <option value="Personal">Personal</option>
                  <option value="Negocios">Negocios</option>
                </select>
              </div>

              <div className="pa-modal-actions">
                <button
                  type="button"
                  className="pa-secondary-btn"
                  onClick={cerrarModalCliente}
                >
                  Cancelar
                </button>
                <button type="submit" className="pa-primary-btn" disabled={clienteSaving}>
                  {clienteSaving ? "Guardando..." : clienteEditandoId ? "Actualizar" : "Guardar"}
                </button>
              </div>

              {clienteModalError && (
                <p style={{ marginTop: "0.6rem", color: "#dc2626", fontSize: "0.8rem" }}>
                  {clienteModalError}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
