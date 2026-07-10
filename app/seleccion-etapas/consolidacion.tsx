"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type PackageCategoryId = "BOX" | "PACKAGE";

type PackageRow = {
  id: string;
  tracking: string;
  nombre_paqueteria: string | null;
  tipo_paquete: PackageCategoryId;
};

type ClientRow = {
  id: string;
  numero_cliente: number;
  nombre: string;
};

type ChildState = {
  clientId: string;
  height: string;
  width: string;
  length: string;
  weight: string;
  hasProblem: boolean;
  problemNotes: string;
  imageUrls: string[];
};

const DEFAULT_CHILD: ChildState = {
  clientId: "",
  height: "",
  width: "",
  length: "",
  weight: "",
  hasProblem: false,
  problemNotes: "",
  imageUrls: [],
};

type ConsolidacionProps = {
  // Cuando se pasa boxTracking, el componente se usa en modo inline
  // dentro del modal de Check-In y no muestra el selector de caja.
  boxTracking?: string;
  // Callback opcional para que el padre (GestionAlmacen) reciba
  // la lista de paquetes hijos seleccionados y su estado detallado.
  onChangeConsolidation?: (
    children: PackageRow[],
    childState: Record<string, ChildState>,
  ) => void;
};

const ConsolidacionPlayground: React.FC<ConsolidacionProps> = ({
  boxTracking,
  onChangeConsolidation,
}) => {
  const [boxes, setBoxes] = useState<PackageRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);

  const [selectedBoxId, setSelectedBoxId] = useState<string>(boxTracking || "");
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [children, setChildren] = useState<PackageRow[]>([]);
  const [childState, setChildState] = useState<Record<string, ChildState>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ data: pkgData }, { data: clientData }] = await Promise.all([
          supabase
            .from("paquetes_registro")
            .select("id, tracking, nombre_paqueteria, tipo_paquete, estado"),
          supabase
            .from("numero_cliente")
            .select("id, numero_cliente, nombre"),
        ]);

        const rows = (pkgData || []) as any[];
        const boxRows = rows.filter((r) => r.tipo_paquete === "BOX");
        // Solo permitir como hijos los paquetes tipo PACKAGE que sigan en estado 'Recibido'
        const pkgRows = rows.filter(
          (r) => r.tipo_paquete === "PACKAGE" && r.estado === "Recibido",
        );

        setBoxes(
          boxRows.map((r) => ({
            id: r.id as string,
            tracking: r.tracking,
            nombre_paqueteria: r.nombre_paqueteria,
            tipo_paquete: r.tipo_paquete,
          })),
        );

        setPackages(
          pkgRows.map((r) => ({
            id: r.id as string,
            tracking: r.tracking,
            nombre_paqueteria: r.nombre_paqueteria,
            tipo_paquete: r.tipo_paquete,
          })),
        );

        setClients(
          ((clientData || []) as any[]).map((c) => ({
            id: c.id as string,
            numero_cliente: c.numero_cliente as number,
            nombre: c.nombre as string,
          })),
        );
      } catch {
        setError("Error cargando datos de consolidación");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Notificar al componente padre cada vez que cambian los hijos
  // seleccionados o su estado detallado.
  useEffect(() => {
    if (onChangeConsolidation) {
      onChangeConsolidation(children, childState);
    }
  }, [children, childState, onChangeConsolidation]);

  const availableChildren = packages.filter(
    (p) => !children.some((c) => c.id === p.id),
  );

  const addChild = (id: string) => {
    const pkg = packages.find((p) => p.id === id);
    if (!pkg) return;
    setChildren((prev) => [...prev, pkg]);
    setChildState((prev) => ({
      ...prev,
      [id]: prev[id] || { ...DEFAULT_CHILD },
    }));
  };

  const removeChild = (id: string) => {
    setChildren((prev) => prev.filter((c) => c.id !== id));
    setChildState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateChildField = (
    id: string,
    field: keyof ChildState,
    value: string | boolean,
  ) => {
    setChildState((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { ...DEFAULT_CHILD }),
        [field]: value,
      },
    }));
  };

  const handleChildImagesChange = async (
    id: string,
    tracking: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const basePath = `notas-imagenes/${tracking || id}`;
    const uploadedUrls: string[] = [];

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
        // Si falla una subida, simplemente dejamos de procesar más archivos.
        break;
      }

      const { data } = supabase.storage
        .from("notas-imagenes")
        .getPublicUrl(filePath);

      if (data?.publicUrl) {
        uploadedUrls.push(data.publicUrl);
      }
    }

    if (uploadedUrls.length > 0) {
      setChildState((prev) => {
        const current = prev[id] || { ...DEFAULT_CHILD };
        return {
          ...prev,
          [id]: {
            ...current,
            imageUrls: [...(current.imageUrls || []), ...uploadedUrls],
          },
        };
      });
    }

    if (event.target) {
      event.target.value = "";
    }
  };

  const isInline = !!boxTracking;

  const handleSaveInline = async () => {
    if (isInline) {
      // En modo inline (dentro del modal de Check-In) no escribimos en la BD aquí,
      // solo indicamos al usuario que los datos se aplicarán al guardar el Check In.
      setSaveStatus(
        "Los datos de consolidación se aplicarán cuando guardes el Check In principal.",
      );
      return;
    }

    // En el playground aislado, por ahora solo mostramos un mensaje de confirmación
    // sin realizar escrituras en la base de datos.
    setSaveStatus("Consolidación guardada en modo de prueba.");
  };

  return (
    <div
      style={
        isInline
          ? { padding: 0 }
          : { padding: "1.5rem", maxWidth: 960, margin: "0 auto" }
      }
    >
      {!isInline && (
        <>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>
            Consolidación (playground aislado)
          </h1>

          {loading && <p>Cargando...</p>}
          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

          <div className="ga-field-group">
            <label>Caja principal (BOX)</label>
            <select
              className="ga-input"
              value={selectedBoxId}
              onChange={(e) => setSelectedBoxId(e.target.value)}
            >
              <option value="">Selecciona una caja</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.tracking} · {b.nombre_paqueteria || "-"}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {(isInline || selectedBoxId) && (
        <>
          <div className="ga-field-group" style={{ marginTop: "1rem" }}>
            <label>Paquetes dentro de la caja</label>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <select
                className="ga-input"
                style={{ flex: 1, minWidth: 0 }}
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
              >
                <option value="">Selecciona un paquete</option>
                {availableChildren.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.tracking} · {p.nombre_paqueteria || "-"}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="ga-secondary-button"
                onClick={() => {
                  if (!selectedChildId) return;
                  addChild(selectedChildId);
                  setSelectedChildId("");
                }}
              >
                Agregar paquete
              </button>
            </div>
          </div>

          {children.length === 0 ? (
            <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
              No hay paquetes agregados todavía.
            </p>
          ) : (
            <div
              style={{
                marginTop: "0.75rem",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {children.map((c) => {
                const state = childState[c.id] || DEFAULT_CHILD;
                return (
                  <div
                    key={c.id}
                    style={{
                      borderBottom: "1px solid #e5e7eb",
                      paddingBottom: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <div style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                        {c.tracking} · {c.nombre_paqueteria || "-"}
                      </div>
                      <button
                        type="button"
                        className="ga-icon-button ga-icon-button-light"
                        onClick={() => removeChild(c.id)}
                      >
                        <i className="fas fa-times" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="ga-field-group" style={{ marginBottom: "0.25rem" }}>
                      <button
                        type="button"
                        className="ga-secondary-button"
                        onClick={() => removeChild(c.id)}
                      >
                        Quitar este paquete de la consolidación
                      </button>
                    </div>

                    {isInline ? (
                      <div className="ga-field-group">
                        <label>Cliente</label>
                        <div
                          className="ga-input"
                          style={{ border: "none", paddingLeft: 0 }}
                        >
                          Este paquete heredará el mismo cliente que la caja principal.
                        </div>
                      </div>
                    ) : (
                      <div className="ga-field-group">
                        <label>Cliente</label>
                        <select
                          className="ga-input"
                          value={state.clientId}
                          onChange={(e) =>
                            updateChildField(c.id, "clientId", e.target.value)
                          }
                        >
                          <option value="">Seleccione un cliente</option>
                          {clients.map((cl) => (
                            <option key={cl.id} value={cl.id}>
                              {cl.numero_cliente} - {cl.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {c.tipo_paquete === "BOX" && (
                      <div className="ga-form-grid">
                        {(["height", "width", "length", "weight"] as const).map(
                          (field) => (
                            <div key={field} className="ga-field-group">
                              <label>
                                {field === "height" && "Height (in)"}
                                {field === "width" && "Width (in)"}
                                {field === "length" && "Length (in)"}
                                {field === "weight" && "Real weight (lb)"}
                              </label>
                              <input
                                type="number"
                                className="ga-input"
                                value={state[field]}
                                onChange={(e) =>
                                  updateChildField(c.id, field, e.target.value)
                                }
                              />
                            </div>
                          ),
                        )}
                      </div>
                    )}

                    <div className="ga-field-group">
                      <label className="ga-checkbox-row">
                        <input
                          type="checkbox"
                          checked={state.hasProblem}
                          onChange={(e) =>
                            updateChildField(c.id, "hasProblem", e.target.checked)
                          }
                        />
                        <span>
                          This package has an issue/damage
                        </span>
                      </label>
                    </div>

                    {state.hasProblem && (
                      <div className="ga-field-group">
                        <label>Problem description</label>
                        <textarea
                          className="ga-input"
                          rows={2}
                          value={state.problemNotes}
                          onChange={(e) =>
                            updateChildField(c.id, "problemNotes", e.target.value)
                          }
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
                          <label className="ga-secondary-button" style={{ cursor: "pointer" }}>
                            Add note photo
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              style={{ display: "none" }}
                              onChange={(e) => handleChildImagesChange(c.id, c.tracking, e)}
                            />
                          </label>
                        </div>

                        {state.imageUrls?.length > 0 && (
                          <div
                            style={{
                              marginTop: "0.5rem",
                              display: "flex",
                              gap: "0.25rem",
                              flexWrap: "wrap",
                            }}
                          >
                            {state.imageUrls.map((url) => (
                              <img
                                key={url}
                                src={url}
                                alt="Damage photo"
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isInline && children.length > 0 && (
            <div className="ga-field-group" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="ga-primary-button"
                onClick={handleSaveInline}
             >
                Guardar consolidación
              </button>
              {saveStatus && (
                <p style={{ marginTop: "0.25rem", fontSize: "0.85rem", color: "#374151" }}>
                  {saveStatus}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ConsolidacionPlayground;

