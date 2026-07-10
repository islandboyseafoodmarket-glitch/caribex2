"use client";

import React, { useEffect, useState } from "react";
import { Box, PackageOpen, ChevronDown, ChevronUp, Eye, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type InTransitPackage = {
  id: number;
  tracking: string;
};

type InTransitProps = {
  isEs: boolean;
  packages: InTransitPackage[];
  onView: (pkg: InTransitPackage) => void;
  onEdit: (pkg: InTransitPackage) => void;
  onDelete: (pkg: InTransitPackage) => void;
};

type ContainerRow = {
  id: string;
  codigo: string;
  creado_en: string | null;
  shipmentCount: number;
};

type ContainerShipment = {
  id: string;
  tracking: string;
  carrier: string | null;
  type: string | null;
  estado: string | null;
  numeroCliente: number | null;
  scanTime?: string | null;
  hasNote?: boolean;
  consolidationCount?: number | null;
  consolidatedIntoBoxTracking?: string | null;
};

const InTransitStage: React.FC<InTransitProps> = ({
  isEs,
  packages,
  onView,
  onDelete,
}) => {
  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<ContainerRow | null>(
    null,
  );
  const [containerShipments, setContainerShipments] = useState<
    ContainerShipment[]
  >([]);
  const [expandedContainerId, setExpandedContainerId] = useState<string | null>(
    null,
  );
  const [detailDebugMessage, setDetailDebugMessage] = useState<string | null>(
    null,
  );

  const handleDeleteContainer = async (cont: ContainerRow) => {
    if (cont.shipmentCount > 0) {
      // Por seguridad, no permitir borrar contenedores con envíos.
      return;
    }

    const confirmed = window.confirm(
      isEs
        ? `¿Eliminar el contenedor ${cont.codigo}? Esta acción no afecta los pedidos, solo elimina el contenedor vacío.`
        : `Delete container ${cont.codigo}? This will not affect shipments, only remove the empty container.`,
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("contenedores")
      .delete()
      .eq("id", cont.id);

    if (error) {
      alert(
        error.message ||
          (isEs
            ? "No se pudo eliminar el contenedor."
            : "Could not delete container."),
      );
      return;
    }

    // Actualizar lista local para que desaparezca sin esperar recarga
    setContainers((prev) => prev.filter((c) => c.id !== cont.id));

    // Si estaba expandido, limpiarlo
    if (expandedContainerId === cont.id) {
      setExpandedContainerId(null);
      setSelectedContainer(null);
      setContainerShipments([]);
      setDetailDebugMessage(null);
    }
  };

  useEffect(() => {
    const loadContainers = async () => {
      setLoading(true);
      try {
        // Cargar todos los contenedores junto con la cantidad de envíos asociados
        const { data, error } = await supabase
          .from("contenedores")
          .select("id, codigo, creado_en");

        if (error || !data) {
          setContainers([]);
          return;
        }

        const base = data as any[];

        // Para simplificar la primera versión, contamos los paquetes por contenedor
        const rows: ContainerRow[] = [];
        for (const row of base) {
          const { count, error: countError } = await supabase
            .from("contenedor_paquetes")
            .select("id", { count: "exact", head: true })
            .eq("contenedor_id", row.id);

          if (countError) continue;

          rows.push({
            id: String(row.id),
            codigo: String(row.codigo),
            creado_en: row.creado_en as string | null,
            shipmentCount: count ?? 0,
          });
        }

        // Mostrar primero los contenedores más recientes
        rows.sort((a, b) => {
          const da = a.creado_en ? new Date(a.creado_en).getTime() : 0;
          const db = b.creado_en ? new Date(b.creado_en).getTime() : 0;
          return db - da;
        });

        setContainers(rows);
      } finally {
        setLoading(false);
      }
    };

    loadContainers();
  }, [packages]);

  const hasContainers = containers.length > 0;

  const toggleContainerExpanded = async (cont: ContainerRow) => {
    if (expandedContainerId === cont.id) {
      setExpandedContainerId(null);
      setSelectedContainer(null);
      setContainerShipments([]);
      setDetailDebugMessage(null);
      return;
    }

    setExpandedContainerId(cont.id);
    setSelectedContainer(cont);
    setContainerShipments([]);
    setDetailDebugMessage(null);

    // 1) Obtener los ids de paquetes asociados al contenedor
    const { data: rels, error: relError } = await supabase
      .from("contenedor_paquetes")
      .select("*")
      .eq("contenedor_id", cont.id);

    if (relError || !rels || rels.length === 0) {
      setContainerShipments([]);
      setDetailDebugMessage(
        relError
          ? `Error loading relations: ${relError.message}`
          : "No relations found for this container",
      );
      return;
    }

    const paqueteIds = (rels as any[])
      .map((r) =>
        r.paquete_id ??
        r.paquete_registro_id ??
        r.paqueteRegistroId ??
        r.paqueteId ??
        null,
      )
      .filter((id) => !!id);

    if (!paqueteIds.length) {
      setContainerShipments([]);
      setDetailDebugMessage("No package ids resolved from contenedor_paquetes.");
      return;
    }

    // 2) Cargar los paquetes desde paquetes_registro
    // Nota: usamos un select sencillo para evitar fallos por relaciones inexistentes.
    const { data: pkgs, error: pkgError } = await supabase
      .from("paquetes_registro")
      .select(
        "id, tracking, nombre_paqueteria, tipo_paquete, estado, numero_cliente_id, numero_cliente (numero_cliente)",
      )
      .in("id", paqueteIds as any[]);

    if (pkgError || !pkgs) {
      setContainerShipments([]);
      setDetailDebugMessage(
        pkgError
          ? `Error loading packages: ${pkgError.message}`
          : "No packages returned from paquetes_registro.",
      );
      return;
    }

    // Solo queremos mostrar aquí envíos que sigan en tránsito, no los que ya
    // fueron descargados o entregados.
    const transitPkgs = (pkgs as any[]).filter((p) => {
      const raw = (p.estado ? String(p.estado) : "").toLowerCase().trim();
      if (!raw) return false;
      // variantes comunes: "En transito", "En tránsito", "In-Transit"
      if (raw === "en transito" || raw === "en tránsito") return true;
      if (raw.includes("transit")) return true;
      return false;
    });

    const baseShipments: ContainerShipment[] = transitPkgs.map((p) => ({
      id: String(p.id),
      tracking: String(p.tracking),
      carrier: (p.nombre_paqueteria as string) ?? null,
      type: (p.tipo_paquete as string) ?? null,
      estado: (p.estado as string) ?? null,
      numeroCliente: p.numero_cliente?.numero_cliente ?? null,
    }));

    // Enriquecer con datos de nota y consolidación desde el array packages
    const enriched: ContainerShipment[] = baseShipments.map((s) => {
      const full = (packages as any[] | undefined)?.find(
        (p: any) =>
          String(p.id) === String(s.id) ||
          String(p.tracking) === String(s.tracking),
      );

      return {
        ...s,
        hasNote: full ? Boolean(full.obs && String(full.obs).trim().length > 0) : false,
        consolidationCount:
          full && typeof full.consolidationCount === "number"
            ? (full.consolidationCount as number)
            : null,
        consolidatedIntoBoxTracking:
          full && full.consolidatedIntoBoxTracking
            ? String(full.consolidatedIntoBoxTracking)
            : null,
        scanTime: full && full.horaFecha ? String(full.horaFecha) : null,
      };
    });

    // Ordenar por tracking para que sea más fácil de leer
    enriched.sort((a, b) => a.tracking.localeCompare(b.tracking));
    setContainerShipments(enriched);
  };

  return (
    <>
      <header className="ga-state-card-header">
        <div
          className="ga-state-title-row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="ga-state-header-icon">
              <Box size={18} />
            </span>

            <div>
              <h2 className="ga-state-title">{isEs ? "En tránsito" : "In-Transit"}</h2>
              <p className="ga-state-subtitle">
                {loading
                  ? isEs
                    ? "Cargando contenedores..."
                    : "Loading containers..."
                  : isEs
                  ? `${containers.length} contenedores`
                  : `${containers.length} containers`}
              </p>
            </div>
          </div>
        </div>
      </header>

      {hasContainers ? (
        <div className="ga-table-card">
          <table className="ga-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}></th>
                <th>{isEs ? "Contenedor" : "Container"}</th>
                <th>{isEs ? "Envíos" : "Shipments"}</th>
                <th>{isEs ? "Creado en" : "Created at"}</th>
                <th style={{ width: "80px" }}>
                  {isEs ? "Acciones" : "Actions"}
                </th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <React.Fragment key={c.id}>
                  <tr className="ga-table-row">
                    <td className="ga-table-actions">
                      <button
                        type="button"
                        className="ga-icon-button ga-icon-button-light"
                        onClick={() => toggleContainerExpanded(c)}
                      >
                        <span
                          style={{
                            fontSize: "1rem",
                            fontWeight: 600,
                            color: "#111827",
                            display: "inline-block",
                            lineHeight: 1,
                          }}
                        >
                          {expandedContainerId === c.id ? "▲" : "▼"}
                        </span>
                      </button>
                    </td>
                    <td className="ga-table-text">{c.codigo}</td>
                    <td className="ga-table-text">{c.shipmentCount}</td>
                    <td className="ga-table-text">
                      {c.creado_en
                        ? new Date(c.creado_en).toLocaleString(
                            isEs ? "es-ES" : "en-US",
                          )
                        : "-"}
                    </td>
                    <td className="ga-table-actions">
                      <button
                        type="button"
                        className={
                          c.shipmentCount === 0
                            ? "ga-icon-button ga-icon-button-danger"
                            : "ga-icon-button ga-icon-button-disabled"
                        }
                        disabled={c.shipmentCount !== 0}
                        title={
                          c.shipmentCount === 0
                            ? isEs
                              ? "Eliminar contenedor vacío"
                              : "Delete empty container"
                            : isEs
                            ? "Solo se puede eliminar cuando no tenga envíos"
                            : "Can only be deleted when it has no shipments"
                        }
                        onClick={() => handleDeleteContainer(c)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>

                  {expandedContainerId === c.id && (
                    <tr className="ga-table-row-detail">
                      <td colSpan={4} style={{ backgroundColor: "#f9fafb" }}>
                        {containerShipments.length === 0 ? (
                          <>
                            <p style={{ margin: "0.5rem 0" }}>
                              {isEs
                                ? "Este contenedor no tiene envíos asociados todavía."
                                : "This container does not have any shipments yet."}
                            </p>
                            {detailDebugMessage && (
                              <p
                                style={{
                                  margin: "0.25rem 0 0",
                                  fontSize: "0.8rem",
                                  color: "#b91c1c",
                                }}
                              >
                                Debug: {detailDebugMessage}
                              </p>
                            )}
                          </>
                        ) : (
                          <div
                            className="ga-table-card"
                            style={{ boxShadow: "none", marginTop: "0.5rem" }}
                          >
                            <table className="ga-table">
                              <thead>
                                <tr>
                                  <th>{isEs ? "N.º cliente" : "Client #"}</th>
                                  <th>Tracking</th>
                                  <th>{isEs ? "Paquetería" : "Carrier"}</th>
                                  <th>{isEs ? "Tipo" : "Type"}</th>
                                  <th>{isEs ? "Nota" : "Note"}</th>
                                  <th>{isEs ? "Consolidación" : "Consolidation"}</th>
                                  <th>{isEs ? "Estado" : "Status"}</th>
                                  <th>{isEs ? "Tiempo de escaneo" : "Scan time"}</th>
                                  <th className="ga-table-col-actions">Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {containerShipments.map((s) => (
                                  <tr key={s.id} className="ga-table-row">
                                    <td className="ga-table-text">
                                      {s.numeroCliente != null ? s.numeroCliente : "-"}
                                    </td>
                                    <td className="ga-table-tracking">{s.tracking}</td>
                                    <td className="ga-table-text">{s.carrier || "-"}</td>
                                    <td className="ga-table-text">{s.type || "-"}</td>
                                    <td className="ga-table-text">
                                      {s.hasNote
                                        ? isEs
                                          ? "Tiene nota"
                                          : "Has note"
                                        : "-"}
                                    </td>
                                    <td className="ga-table-text">
                                      {s.type === "BOX"
                                        ? (s.consolidationCount ?? 0) > 0
                                          ? `${s.consolidationCount} ${
                                              isEs ? "paquetes" : "packages"
                                            }`
                                          : isEs
                                          ? "Sin consolidación"
                                          : "No consolidation"
                                        : s.consolidatedIntoBoxTracking
                                        ? isEs
                                          ? `En caja ${s.consolidatedIntoBoxTracking}`
                                          : `In box ${s.consolidatedIntoBoxTracking}`
                                        : "-"}
                                    </td>
                                    <td className="ga-table-text">{s.estado || "-"}</td>
                                    <td className="ga-table-text">
                                      {s.scanTime
                                        ? new Date(s.scanTime).toLocaleString(
                                            isEs ? "es-ES" : "en-US",
                                          )
                                        : "-"}
                                    </td>
                                    <td className="ga-table-actions">
                                      <button
                                        type="button"
                                        className="ga-icon-button"
                                        onClick={() => {
                                          const full = (packages as any[] | undefined)?.find(
                                            (p: any) =>
                                              String(p.id) === String(s.id) ||
                                              String(p.tracking) === String(s.tracking),
                                          );
                                          onView(
                                            full || {
                                              id: Number(s.id),
                                              tracking: s.tracking,
                                            },
                                          );
                                        }}
                                      >
                                        <Eye size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        className="ga-icon-button ga-icon-button-danger"
                                        onClick={() =>
                                          onDelete({
                                            id: Number(s.id),
                                            tracking: s.tracking,
                                          })
                                        }
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ga-empty-state">
          <div className="ga-empty-icon">
            <PackageOpen size={24} />
          </div>
          <p className="ga-empty-title">
            {isEs
              ? "No hay envíos en esta etapa"
              : "No shipments in this stage"}
          </p>
        </div>
      )}
    </>
  );
};

export default InTransitStage;

