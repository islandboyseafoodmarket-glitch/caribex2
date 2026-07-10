"use client";

import React, { useState, useMemo } from "react";
import { Box, Package as PackageIcon, Truck, Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type PackageCategoryId = "BOX" | "PACKAGE";

type StageCheckInPackage = {
  id: number;
  tracking: string;
  carrier?: string | null;
  type: PackageCategoryId;
  obs?: string;
  registro?: string | null;
  descargado?: string | null;
  entregadoPor?: string | null;
  estado?: string | null;
  horaFecha?: string | null;
  consolidationCount?: number;
  numeroClienteId?: string | null;
  numeroCliente?: number | null;
  consolidatedIntoBoxTracking?: string | null;
};

type StageCheckInProps = {
  isEs: boolean;
  packages: StageCheckInPackage[];
  onBulkTransit: () => void;
  onView?: (pkg: StageCheckInPackage) => void;
  onEditCheckIn?: (pkg: StageCheckInPackage) => void;
};

const CATEGORIES = [
  {
    id: "BOX" as PackageCategoryId,
    icon: <Box size={18} />,
    title: "Caja",
    subtitle: "Cobrado por pie cúbico",
  },
  {
    id: "PACKAGE" as PackageCategoryId,
    icon: <PackageIcon size={18} />,
    title: "Paquete",
    subtitle: "Mínimo $15.20",
  },
];

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
  }
  switch (id) {
    case "BOX":
      return "Box";
    case "PACKAGE":
      return "Package";
    default:
      return id;
  }
};

const StageCheckIn: React.FC<StageCheckInProps> = ({
  isEs,
  packages,
  onBulkTransit,
  onView,
  onEditCheckIn,
}) => {
  const hasPackages = packages.length > 0;
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StageCheckInPackage | null>(
    null,
  );
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return packages;

    return packages.filter((p) => {
      const tracking = (p.tracking || "").toLowerCase();
      const clientNumber =
        typeof p.numeroCliente === "number"
          ? String(p.numeroCliente).toLowerCase()
          : "";
      return tracking.includes(term) || clientNumber.includes(term);
    });
  }, [packages, search]);

  const handleOpenEdit = (p: StageCheckInPackage) => {
    if (onEditCheckIn) {
      onEditCheckIn(p);
    }
  };

  const handleDelete = (p: StageCheckInPackage) => {
    setDeleteTarget(p);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    const { error } = await supabase
      .from("paquetes_registro")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      alert(
        error.message ||
          (isEs ? "No se pudo eliminar el envío" : "Could not delete shipment"),
      );
      return;
    }

    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
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
              <Box size={24} />
            </span>
            <div>
              <h2 className="ga-state-title">
                {isEs ? "Check In" : "Check In"}
              </h2>
              <p className="ga-state-subtitle">
                {isEs
                  ? `${filtered.length} envíos`
                  : `${filtered.length} shipments`}
              </p>
            </div>
          </div>

          <div className="ga-search-bar" style={{ maxWidth: 260 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isEs
                  ? "Buscar por tracking o cliente..."
                  : "Search by tracking or client..."
              }
            />
          </div>

          {hasPackages && (
            <button
              type="button"
              className="ga-primary-button"
              onClick={onBulkTransit}
            >
              <Truck size={14} style={{ marginRight: 6 }} />
              <span>
                {isEs
                  ? "Mover todos a En tránsito"
                  : "Move all to In-Transit"}
              </span>
            </button>
          )}
        </div>
      </header>

      {hasPackages ? (
        <div className="ga-table-card">
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
                <th className="ga-table-col-actions">
                  {isEs ? "Acciones" : "Actions"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="ga-table-row">
                  <td className="ga-table-text">
                    {p.numeroCliente != null ? p.numeroCliente : "-"}
                  </td>
                  <td className="ga-table-tracking">{p.tracking}</td>
                  <td className="ga-table-text">{p.carrier || "-"}</td>
                  <td className="ga-table-text">
                    <span className="ga-tag">{getCategoryLabel(p.type, isEs)}</span>
                  </td>
                  <td className="ga-table-text">
                    {p.obs && p.obs.trim().length > 0
                      ? isEs
                        ? "Tiene nota"
                        : "Has note"
                      : "-"}
                  </td>
                  <td className="ga-table-text">
                    {p.type === "BOX"
                      ? (p.consolidationCount ?? 0) > 0
                        ? `${p.consolidationCount} ${
                            isEs ? "paquetes" : "packages"
                          }`
                        : isEs
                        ? "Sin consolidación"
                        : "No consolidation"
                      : p.consolidatedIntoBoxTracking
                      ? isEs
                        ? `En caja ${p.consolidatedIntoBoxTracking}`
                        : `In box ${p.consolidatedIntoBoxTracking}`
                      : "-"}
                  </td>
                  <td className="ga-table-text">{p.estado || "-"}</td>
                  <td className="ga-table-text">
                    {p.horaFecha
                      ? new Date(p.horaFecha).toLocaleString(isEs ? "es-ES" : "en-US")
                      : "-"}
                  </td>
                  <td className="ga-table-actions">
                    <button
                      type="button"
                      className="ga-icon-button"
                      title={isEs ? "Ver detalles" : "View details"}
                      onClick={() => onView && onView(p)}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      className="ga-icon-button"
                      title={isEs ? "Editar" : "Edit"}
                      onClick={() => handleOpenEdit(p)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="ga-icon-button"
                      title={isEs ? "Eliminar" : "Delete"}
                      onClick={() => handleDelete(p)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ga-empty-state">
          <div className="ga-empty-icon">
            <Box size={24} />
          </div>
          <p className="ga-empty-title">
            {isEs
              ? "No hay envíos en esta etapa"
              : "No shipments in this stage"}
          </p>
        </div>
      )}
      {isDeleteModalOpen && deleteTarget && (
        <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ga-modal">
            <div className="ga-modal-header">
              <h4>{isEs ? "Confirmar eliminación" : "Confirm deletion"}</h4>
              <button
                type="button"
                className="ga-icon-button ga-icon-button-light"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteTarget(null);
                }}
              >
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>

            <div className="ga-modal-body">
              <p style={{ marginBottom: "0.75rem" }}>
                {isEs
                  ? `¿Estás seguro de que deseas eliminar el envío con tracking ${deleteTarget.tracking}? Esta acción no se puede deshacer.`
                  : `Are you sure you want to delete the shipment with tracking ${deleteTarget.tracking}? This action cannot be undone.`}
              </p>
            </div>

            <div className="ga-modal-footer">
              <button
                type="button"
                className="ga-secondary-button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteTarget(null);
                }}
              >
                {isEs ? "Cancelar" : "Cancel"}
              </button>
              <button
                type="button"
                className="ga-danger-button || ga-primary-button"
                onClick={handleConfirmDelete}
              >
                {isEs ? "Eliminar" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StageCheckIn;

