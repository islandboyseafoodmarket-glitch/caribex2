"use client";

import React, { useState, useMemo } from "react";

import { PackageOpen, Camera, Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type PackageCategoryId = "BOX" | "PACKAGE";

type UnloadedPackage = {
  id: number;
  tracking: string;
  carrier?: string | null;
  type: PackageCategoryId;
  registro?: string | null;
  descargado?: string | null;
  entregadoPor?: string | null;
  fechaDescargado?: string | null;
  fechaEntregado?: string | null;
  horaFecha?: string | null;
  obs?: string | null;
  estado?: string | null;
  numeroClienteId?: string | null;
  numeroCliente?: number | null;
};

type UnloadedProps = {
  isEs: boolean;
  packages: UnloadedPackage[];
  onScanPackage: () => void;
  onView: (pkg: UnloadedPackage) => void;
  onEdit: (pkg: UnloadedPackage) => void;
  onDelete: (pkg: UnloadedPackage) => void;
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

const UnloadedStage: React.FC<UnloadedProps> = ({
  isEs,
  packages,
  onScanPackage,
  onView,
  onEdit,
}) => {
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

  const hasPackages = filtered.length > 0;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UnloadedPackage | null>(null);

  const handleDelete = (p: UnloadedPackage) => {
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
          (isEs
            ? "No se pudo eliminar el envío"
            : "Could not delete shipment"),
      );
      return;
    }

    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
    // La eliminación se reflejará vía realtime en GestionAlmacen.
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
              <PackageOpen size={18} />
            </span>

            <div>
              <h2 className="ga-state-title">{isEs ? "Descargado (Roatán)" : "Unloaded (Roatán)"}</h2>
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

          <button
            type="button"
            className="ga-primary-button"
            onClick={onScanPackage}
          >
            <Camera size={14} />
            <span>{isEs ? "Escanear paquete" : "Scan package"}</span>
          </button>
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
                    {(p.obs && p.obs.trim().length > 0) ? p.obs : "-"}
                  </td>
                  <td className="ga-table-text">
                    {isEs ? "No" : "No"}
                  </td>
                  <td className="ga-table-text">{p.estado || "-"}</td>
                  <td className="ga-table-text">
                    {p.horaFecha
                      ? new Date(p.horaFecha).toLocaleString(
                          isEs ? "es-ES" : "en-US",
                        )
                      : "-"}
                  </td>
                  <td className="ga-table-actions">
                    <button
                      type="button"
                      className="ga-icon-button"
                      title={isEs ? "Ver detalles" : "View details"}
                      onClick={() => onView(p)}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      className="ga-icon-button"
                      title={isEs ? "Editar" : "Edit"}
                      onClick={() => onEdit(p)}
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
            <PackageOpen size={24} />
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
              <h4>
                {isEs ? "Confirmar eliminación" : "Confirm deletion"}
              </h4>
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
                  ? `¿Estás seguro de que deseas eliminar el envío con tracking ${
                      deleteTarget.tracking
                    }? Esta acción no se puede deshacer.`
                  : `Are you sure you want to delete the shipment with tracking ${
                      deleteTarget.tracking
                    }? This action cannot be undone.`}
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

export default UnloadedStage;