"use client";

import React, { useState } from "react";
import { Box, Package as PackageIcon, PackageOpen, ClipboardList, Truck, HandCoins, FileText, ArrowRight } from "lucide-react";

type StageId = "RECIBIDO_FLORIDA" | "REGISTRO" | "EN_TRANSITO" | "DESCARGADO_ROATAN" | "PASTILLA" | "FACTURAS";

type Stage = {
  id: StageId;
  label: string;
  icon: React.ReactNode;
  description: string;
};

const STAGES: Stage[] = [
  {
    id: "RECIBIDO_FLORIDA",
    label: "Recibido (Florida)",
    icon: <Box size={24} />,
    description: "Paquete recibido en nuestro almacén de Florida"
  },
  {
    id: "REGISTRO",
    label: "Registro",
    icon: <ClipboardList size={24} />,
    description: "Paquete registrado en nuestro sistema"
  },
  {
    id: "EN_TRANSITO",
    label: "En tránsito",
    icon: <Truck size={24} />,
    description: "Paquete en camino a su destino"
  },
  {
    id: "DESCARGADO_ROATAN",
    label: "Descargado (Roatán)",
    icon: <PackageOpen size={24} />,
    description: "Paquete descargado en nuestro almacén de Roatán"
  },
  {
    id: "PASTILLA",
    label: "Pastilla",
    icon: <HandCoins size={24} />,
    description: "Paquete listo para recoger"
  },
  {
    id: "FACTURAS",
    label: "Facturas",
    icon: <FileText size={24} />,
    description: "Factura generada y lista para pago"
  }
];

export default function SeleccionEtapas() {
  const [selectedStage, setSelectedStage] = useState<StageId | null>(null);

  const handleStageSelect = (stageId: StageId) => {
    setSelectedStage(stageId);
  };

  const handleContinue = () => {
    if (selectedStage) {
      // Aquí puedes redirigir o hacer algo con la etapa seleccionada
      console.log("Etapa seleccionada:", selectedStage);
      // Ejemplo: router.push(`/gestion-almacen?stage=${selectedStage}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Seleccionar Etapa del Paquete
          </h1>
          <p className="text-lg text-gray-600">
            Elige la etapa actual de tu paquete para actualizar su estado
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {STAGES.map((stage) => (
            <button
              key={stage.id}
              onClick={() => handleStageSelect(stage.id)}
              className={`p-6 rounded-lg border-2 transition-all duration-200 ${
                selectedStage === stage.id
                  ? "border-blue-500 bg-blue-50 shadow-lg"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
              }`}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`p-3 rounded-full ${
                  selectedStage === stage.id ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"
                }`}>
                  {stage.icon}
                </div>
                <h3 className="font-semibold text-lg text-gray-900">
                  {stage.label}
                </h3>
                <p className="text-sm text-gray-600">
                  {stage.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {selectedStage && (
          <div className="text-center">
            <button
              onClick={handleContinue}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Continuar
              <ArrowRight size={20} className="ml-2" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
