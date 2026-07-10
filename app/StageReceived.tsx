"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Barcode,
  Box,
  Camera,
  Plus,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { supabase } from "../lib/supabaseClient";
import { detectCarrier } from "./lib/carrierDetection";

type PackageCategoryId = "BOX" | "PACKAGE";

type StageReceivedPackage = {
  id: number;
  tracking: string;
  remitente?: string | null;
  destinatario?: string | null;
  carrier?: string | null;
  type: PackageCategoryId;
  weight?: number;
  dims?: string;
  obs?: string | null;
  registro?: string | null;
  descargado?: string | null;
  entregadoPor?: string | null;
  estado?: string | null;
  horaFecha?: string | null;
  numeroClienteId?: string | null;
  numeroCliente?: number | null;
};

type StageReceivedProps = {
  isEs: boolean;
  packages: StageReceivedPackage[];
  onOpenNext: (pkg: StageReceivedPackage) => void;
  onPackageCreated?: (pkg: StageReceivedPackage) => void;
  currentUserName?: string | null;
  onView?: (pkg: StageReceivedPackage) => void;
};

const CATEGORIES: {
  id: PackageCategoryId;
  icon: JSX.Element;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "BOX",
    icon: <Box size={18} />,
    title: "Caja",
    subtitle: "Cobrado por pie cúbico",
  },
  {
    id: "PACKAGE",
    icon: <Box size={18} />,
    title: "Paquete",
    subtitle: "Mínimo $15.20",
  },
];

const getCategoryLabel = (id: PackageCategoryId, isEsLang: boolean): string => {
  if (isEsLang) {
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

const StageReceived: React.FC<StageReceivedProps> = ({
  isEs,
  packages,
  onOpenNext,
  onPackageCreated,
  currentUserName,
  onView,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [selectedType, setSelectedType] = useState<PackageCategoryId | null>(
    null,
  );
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [contents, setContents] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [viewPackage, setViewPackage] = useState<StageReceivedPackage | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StageReceivedPackage | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<StageReceivedPackage | null>(
    null,
  );
  const [search, setSearch] = useState("");

  const resetForm = () => {
    setBarcode("");
    setTracking("");
    setCarrier("");
    setSelectedType(null);
    setSender("");
    setRecipient("");
    setContents("");
    setIsScannerOpen(false);
    setEditingPackage(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  useEffect(() => {
    if (!isScannerOpen) {
      if (scannerRef.current) {
        try {
          const instance: any = scannerRef.current;
          instance.stop?.().catch(() => {});
          instance.clear?.().catch(() => {});
        } catch {
          // ignorar errores al cerrar el escáner
        }
        scannerRef.current = null;
      }
      return;
    }

    const elementId = "ga-barcode-scanner-container";

    const html5QrCode: any = new Html5Qrcode(elementId);
    scannerRef.current = html5QrCode;

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
          const text = decodedText.trim();
          if (!text) return;

          const info = detectCarrier(text);

          setBarcode(text);
          setTracking(info.trackingNumber);

          const carrierMap: Record<string, string> = {
            ups: "UPS",
            fedex: "FedEx",
            dhl: "DHL",
            usps: "USPS",
            amazon: "Amazon logistics",
          };

          if (info.carrier !== "unknown") {
            setCarrier(carrierMap[info.carrier] || "");
          }

          console.log(
            "Detected Carrier:",
            info.carrier,
            "Tracking:",
            info.trackingNumber,
            "Confidence:",
            info.confidence,
          );

          setIsScannerOpen(false);
        },
        () => {},
      )
      .catch((err: unknown) => {
        console.error("Error iniciando el escáner", err);
        alert(
          isEs
            ? "No se pudo acceder a la cámara. Revisa los permisos del navegador y que la página tenga acceso a la cámara."
            : "Could not access the camera. Check browser permissions and that this page is allowed to use the camera.",
        );
        setIsScannerOpen(false);
      });

    return () => {
      if (scannerRef.current) {
        const instance: any = scannerRef.current;
        instance
          .stop?.()
          .then(() => instance.clear?.().catch(() => {}))
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
          });
      }
    };
  }, [isScannerOpen, isEs]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (!selectedType) {
      alert(
        isEs
          ? "Seleccione un tipo de paquete"
          : "Please select a package type",
      );
      return;
    }

    const effectiveTracking = (tracking || barcode).trim();
    if (!effectiveTracking) {
      alert(
        isEs
          ? "Ingrese un número de tracking o un código de barras"
          : "Enter a tracking number or a barcode",
      );
      return;
    }

    const guardar = async () => {
      // Modo edición: actualizar registro existente
      if (editingPackage) {
        const { error } = await supabase
          .from("paquetes_registro")
          .update({
            tracking: effectiveTracking.toUpperCase(),
            nombre_paqueteria: carrier || "",
            tipo_paquete: selectedType,
            contenido: contents || null,
          })
          .eq("id", editingPackage.id);

        if (error) {
          alert(error.message || "No se pudo actualizar el paquete");
          return;
        }

        // La lista se actualizará por el listener en GestionAlmacen.
        handleCloseModal();
        return;
      }

      // Modo creación: primero verificar si ya existe un tracking igual
      const upperTracking = effectiveTracking.toUpperCase();

      const { data: existing, error: checkError } = await supabase
        .from("paquetes_registro")
        .select("id")
        .eq("tracking", upperTracking)
        .maybeSingle();

      if (!checkError && existing) {
        alert(
          isEs
            ? "Ya existe un envío registrado con este número de tracking."
            : "A shipment with this tracking number is already registered.",
        );
        return;
      }

      // Insertar nuevo registro
      const { data, error } = await supabase
        .from("paquetes_registro")
        .insert({
          tracking: upperTracking,
          nombre_paqueteria: carrier || "",
          tipo_paquete: selectedType,
          contenido: contents || null,
          notas: null,
          registro: currentUserName,
          descargado: null,
          estado: "Recibido",
        })
        .select(
          "id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, registro, descargado, estado, hora_fecha",
        )
        .single();

      if (error) {
        // Manejar específicamente errores de constraint única si el backend los expone
        const msg =
          error.message && error.message.toLowerCase().includes("duplicate")
            ? isEs
              ? "Ya existe un envío con este número de tracking."
              : "There is already a shipment with this tracking number."
            : error.message ||
              (isEs
                ? "No se pudo guardar el paquete"
                : "Could not save the shipment");
        alert(msg);
        return;
      }

      const row: any = data;
      const newPackage: StageReceivedPackage = {
        id: row.id,
        tracking: row.tracking,
        carrier: row.nombre_paqueteria || null,
        type: row.tipo_paquete as PackageCategoryId,
        obs: row.notas || null,
        registro: row.registro || null,
        descargado: row.descargado || null,
        estado: row.estado || null,
        horaFecha: row.hora_fecha || null,
        entregadoPor: null,
      };

      onPackageCreated?.(newPackage);
      handleCloseModal();
    };

    guardar();
  };

  const handleViewDetails = (p: StageReceivedPackage) => {
    if (onView) {
      onView(p);
      return;
    }

    setViewPackage(p);
    setIsViewModalOpen(true);
  };

  const handleEditFromTable = (p: StageReceivedPackage) => {
    // Preparar formulario con los datos actuales para editar dentro del modal
    setEditingPackage(p);
    setBarcode("");
    setTracking(p.tracking || "");
    setCarrier(p.carrier || "");
    setSelectedType(p.type || null);
    // dims viene de paquetes_registro.contenido mapeado en GestionAlmacen
    setContents(p.dims || "");
    setIsModalOpen(true);
  };

  const handleDelete = (p: StageReceivedPackage) => {
    setDeleteTarget(p);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    const { error } = await supabase
      .from('paquetes_registro')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      alert(
        error.message ||
          (isEs
            ? 'No se pudo eliminar el envío'
            : 'Could not delete shipment'),
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
              <Box size={18} />
            </span>

            <div>
              <h2 className="ga-state-title">
                {isEs ? "Recibido (Florida)" : "Received (Florida)"}
              </h2>
              <p className="ga-state-subtitle">
                {isEs
                  ? `${packages.length} envíos`
                  : `${packages.length} shipments`}
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
            onClick={handleOpenModal}
          >
            <Plus size={14} />
            <span>{isEs ? "Nuevo envío" : "New Shipment"}</span>
          </button>
        </div>
      </header>

      {packages.length ? (
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
              {packages
                .filter((p) => {
                  const term = search.trim().toLowerCase();
                  if (!term) return true;
                  const tracking = (p.tracking || "").toLowerCase();
                  const clientNumber =
                    typeof p.numeroCliente === "number"
                      ? String(p.numeroCliente).toLowerCase()
                      : "";
                  return (
                    tracking.includes(term) || clientNumber.includes(term)
                  );
                })
                .map((p) => (
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
                      onClick={() => handleViewDetails(p)}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      className="ga-icon-button"
                      title={isEs ? "Editar" : "Edit"}
                      onClick={() => handleEditFromTable(p)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="ga-icon-button"
                      onClick={() => onOpenNext(p)}
                      title={isEs ? "Pasar a Check In" : "Move to Check In"}
                    >
                      <ArrowRight size={16} />
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
            {isEs ? "No hay envíos en este estado" : "No shipments in this status"}
          </p>
        </div>
      )}

      {isDeleteModalOpen && deleteTarget && (
        <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ga-modal">
            <div className="ga-modal-header">
              <h4>
                {isEs
                  ? 'Confirmar eliminación'
                  : 'Confirm deletion'}
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
              <p style={{ marginBottom: '0.75rem' }}>
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
                {isEs ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                className="ga-danger-button || ga-primary-button"
                onClick={handleConfirmDelete}
              >
                {isEs ? 'Eliminar' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="ga-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ga-modal">
            <div className="ga-modal-header">
              <h4>{isEs ? "Registro de Paquete" : "Package Registration"}</h4>
              <button
                type="button"
                className="ga-icon-button ga-icon-button-light"
                onClick={handleCloseModal}
              >
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>

            <form className="ga-modal-body" onSubmit={handleSubmit}>
              <div className="ga-form-grid">
                <div className="ga-field-group">
                  <label>
                    {isEs ? "Número de Tracking *" : "Tracking Number *"}
                  </label>
                  <div className="ga-barcode-input">
                    <Barcode size={16} />
                    <input
                      type="text"
                      required
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      placeholder={
                        isEs ? "Ej. 1234567890" : "e.g. 1234567890"
                      }
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                  </div>
                  <button
                    type="button"
                    className="ga-secondary-button"
                    style={{ marginTop: "0.5rem", width: "100%" }}
                    onClick={() => setIsScannerOpen((open) => !open)}
                  >
                    <Camera size={16} style={{ marginRight: 8 }} />
                    {isEs
                      ? "Escanear código de barras"
                      : "Scan barcode"}
                  </button>
                  {isScannerOpen && (
                    <div className="ga-barcode-scanner">
                      <div
                        id="ga-barcode-scanner-container"
                        className="ga-barcode-video"
                      />
                    </div>
                  )}
                </div>

                <div className="ga-field-group">
                  <label>{isEs ? "Carrier *" : "Carrier *"}</label>
                  <select
                    className="ga-input"
                    required
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                  >
                    <option value="">
                      {isEs
                        ? "Selecciona un carrier"
                        : "Select a carrier"}
                    </option>
                    <option value="Amazon logistics">Amazon logistics</option>
                    <option value="UPS">UPS</option>
                    <option value="SheIn">SheIn</option>
                    <option value="FedEx">FedEx</option>
                    <option value="DHL">DHL</option>
                    <option value="USPS">USPS</option>
                  </select>
                </div>
              </div>

              <div className="ga-field-group">
                <label>{isEs ? "Tipo de Paquete" : "Package Type"}</label>

                <div className="ga-category-grid">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={
                        "ga-category-card" +
                        (selectedType === cat.id
                          ? " ga-category-card-selected"
                          : "")
                      }
                      onClick={() => setSelectedType(cat.id)}
                    >
                      {cat.icon}

                      <div className="ga-category-text">
                        <span className="ga-category-title">{cat.title}</span>
                        <span className="ga-category-subtitle">
                          {cat.subtitle}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedType && (
                <div className="ga-package-info">
                  {selectedType === "BOX"
                    ? isEs
                      ? "Caja: Cobrado según pies cúbicos usados (Largo × Ancho × Alto ÷ 1728)."
                      : "Box: Charged based on cubic feet used (Length × Width × Height ÷ 1728)."
                    : isEs
                      ? "Paquete: Cargo mínimo plano de $15.20 sin importar el tamaño."
                      : "Package: Flat minimum charge of $15.20 regardless of size."}
                </div>
              )}

              {/* Campos de remitente/destinatario removidos: ahora todo se asigna por cliente en etapas posteriores */}

              <div className="ga-form-grid">
                <div className="ga-field-group">
                  <label>{isEs ? "Contenido" : "Contents"}</label>
                  <select
                    className="ga-input"
                    value={contents}
                    onChange={(e) => setContents(e.target.value)}
                  >
                    <option value="">{isEs ? "Seleccione contenido" : "Select contents"}</option>
                    <option value="Paint">Paint</option>
                    <option value="Appliances">Appliances</option>
                    <option value="TVs">TVs</option>
                    <option value="Barrel">Barrel</option>
                    <option value="Wire">Wire</option>
                    <option value="Cable">Cable</option>
                    <option value="Bins">Bins</option>
                  </select>
                </div>
              </div>

              <div className="ga-modal-footer">
                <button
                  type="button"
                  className="ga-secondary-button"
                  onClick={handleCloseModal}
                >
                  {isEs ? "Cancelar" : "Cancel"}
                </button>
                <button type="submit" className="ga-primary-button">
                  {isEs ? "Guardar Registro" : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default StageReceived;
