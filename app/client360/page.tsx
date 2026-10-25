"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Client360Admin from "../login/Client360Admin";
import { supabase } from "../../lib/supabaseClient";

export default function Client360Page() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<any>({ clientes: [], pedidos: [], facturas: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) { window.location.href = "/login"; return; }
      const userId = session.session.user.id;
      const [{ data: admin }, { data: staff }] = await Promise.all([
        supabase.from("administradores").select("id").eq("id", userId).maybeSingle(),
        supabase.from("personal").select("id").eq("id", userId).maybeSingle(),
      ]);
      if (!admin && !staff) { setAllowed(false); return; }
      const [{ data: clientes, error: clientError }, { data: packages }, { data: invoices }, { data: containerLinks }, { data: containers }] = await Promise.all([
        supabase.from("numero_cliente").select("id, nombre, numero_cliente, email, telefono, puerto, tipo_cuenta, prepaid_allowance_cubic_feet, prepaid_used_cubic_feet, creado_en, auth_user_id").order("creado_en", { ascending: false }),
        supabase.from("paquetes_registro").select("id, tracking, estado, nombre_paqueteria, tipo_paquete, contenido, notas, notas_imagenes, numero_cliente_id, registro, hora_fecha, fecha_entregado, problema, problema_notas, cubic_feet, prepaid_review_required, prepaid_review_status, numero_cliente:numero_cliente_id(numero_cliente, nombre)" ).order("registro", { ascending: false }),
        supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, billing_subtotal, billing_tax, billing_total, approval_status, invoice_status, notas, numero_cliente:numero_cliente_id(numero_cliente, nombre)" ).not("billing_total", "is", null),
        supabase.from("contenedor_paquetes").select("paquete_id, contenedor_id"),
        supabase.from("contenedores").select("id, codigo"),
      ]);
      if (clientError) { setError(clientError.message); setAllowed(false); return; }
      const containerById = new Map((containers || []).map((container: any) => [container.id, container.codigo || container.id]));
      const containersByPackage = new Map<string, string[]>();
      (containerLinks || []).forEach((link: any) => {
        const code = containerById.get(link.contenedor_id);
        if (!code) return;
        const current = containersByPackage.get(link.paquete_id) || [];
        if (!current.includes(code)) current.push(code);
        containersByPackage.set(link.paquete_id, current);
      });
      setData({ clientes: clientes || [], pedidos: (packages || []).map((p: any) => ({ ...p, clienteNumero: p.numero_cliente?.numero_cliente ?? null, clienteNombre: p.numero_cliente?.nombre ?? null, carrier: p.nombre_paqueteria, containerCode: containersByPackage.get(p.id)?.join(", ") || null })), facturas: (invoices || []).map((f: any) => ({ ...f, clienteNumero: f.numero_cliente?.numero_cliente ?? null, clienteNombre: f.numero_cliente?.nombre ?? null, carrier: f.nombre_paqueteria, subtotal: f.billing_subtotal, tax: f.billing_tax, total: f.billing_total })) });
      setAllowed(true);
    })();
  }, []);
  if (allowed === null) return <main className="portal-page portal-centered">Loading Client 360…</main>;
  if (!allowed) return <main className="portal-page portal-centered"><h1>Client 360 unavailable</h1><p>{error || "Admin or staff access is required."}</p><Link href="/login" className="portal-button">Back to login</Link></main>;
  return <main className="portal-page" style={{ padding: "2rem" }}><div style={{ maxWidth: 1200, margin: "0 auto" }}><Link href="/gestion-almacen" className="pa-secondary-btn">← Back to warehouse</Link><Client360Admin clientes={data.clientes} pedidos={data.pedidos} facturas={data.facturas} /></div></main>;
}
