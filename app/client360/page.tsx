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
      const [{ data: clientes, error: clientError }, { data: packages }, { data: invoices }] = await Promise.all([
        supabase.from("numero_cliente").select("id, nombre, numero_cliente, email, telefono, puerto, tipo_cuenta, creado_en, auth_user_id").order("creado_en", { ascending: false }),
        supabase.from("paquetes_registro").select("id, tracking, estado, nombre_paqueteria, tipo_paquete, contenido, notas, numero_cliente_id, registro, hora_fecha, fecha_entregado, problema, problema_notas, numero_cliente:numero_cliente_id(numero_cliente, nombre)" ).order("registro", { ascending: false }),
        supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, billing_subtotal, billing_tax, billing_total, approval_status, invoice_status, notas, numero_cliente:numero_cliente_id(numero_cliente, nombre)" ).not("billing_total", "is", null),
      ]);
      if (clientError) { setError(clientError.message); setAllowed(false); return; }
      setData({ clientes: clientes || [], pedidos: (packages || []).map((p: any) => ({ ...p, clienteNumero: p.numero_cliente?.numero_cliente ?? null, clienteNombre: p.numero_cliente?.nombre ?? null, carrier: p.nombre_paqueteria })), facturas: (invoices || []).map((f: any) => ({ ...f, clienteNumero: f.numero_cliente?.numero_cliente ?? null, clienteNombre: f.numero_cliente?.nombre ?? null, carrier: f.nombre_paqueteria, subtotal: f.billing_subtotal, tax: f.billing_tax, total: f.billing_total })) });
      setAllowed(true);
    })();
  }, []);
  if (allowed === null) return <main className="portal-page portal-centered">Loading Client 360…</main>;
  if (!allowed) return <main className="portal-page portal-centered"><h1>Client 360 unavailable</h1><p>{error || "Admin or staff access is required."}</p><Link href="/login" className="portal-button">Back to login</Link></main>;
  return <main className="portal-page" style={{ padding: "2rem" }}><div style={{ maxWidth: 1200, margin: "0 auto" }}><Link href="/gestion-almacen" className="pa-secondary-btn">← Back to warehouse</Link><Client360Admin clientes={data.clientes} pedidos={data.pedidos} facturas={data.facturas} /></div></main>;
}
