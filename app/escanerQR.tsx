"use client";

import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

/**
 * CONFIGURACIÓN ESPECÍFICA PARA CARIBEX
 *
 * Aceptamos SOLO códigos generados por Caribex en alguno de estos formatos:
 *   1) JSON con al menos "id" o "tracking" (por ejemplo el QR que genera el panel admin)
 *   2) URL que contenga "/pedidos/{id}" (como los links de la web de Caribex)
 *   3) Texto plano que empiece con el prefijo "CARIBEX:"
 */

const CARIBEX_CONFIG = {
  NOMBRE: "Caribex",
  PREFIJO_TEXTO: "CARIBEX:",
};

export type CaribexPayload = {
  id?: string;
  tracking?: string;
};

const parseCaribexQr = (raw: string): CaribexPayload | null => {
  const text = raw.trim();
  if (!text) return null;

  // 1) Intentar como JSON con id/tracking (QR generado por panel admin)
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const maybeId = (parsed as any).id;
      const maybeTracking = (parsed as any).tracking;
      if (typeof maybeId === "string" || typeof maybeTracking === "string") {
        return {
          id: maybeId,
          tracking: maybeTracking,
        };
      }
    }
  } catch {
    // No es JSON, seguimos probando otros formatos
  }

  // 2) Intentar URL /pedidos/{id}
  const regex = /pedidos\/([a-f0-9-]+)/i;
  const match = text.match(regex);
  if (match && match[1]) {
    return { id: match[1] };
  }

  // 3) Intentar formato de texto plano con prefijo CARIBEX:
  if (text.startsWith(CARIBEX_CONFIG.PREFIJO_TEXTO)) {
    const id = text.substring(CARIBEX_CONFIG.PREFIJO_TEXTO.length).trim();
    if (id) {
      return { id };
    }
  }

  // Si no matchea ninguno de los formatos anteriores, lo consideramos no-Caribex
  return null;
};

interface EscanerQRCaribexProps {
  onCaribexScan?: (payload: CaribexPayload) => void;
}

const EscanerQRCaribex: React.FC<EscanerQRCaribexProps> = ({ onCaribexScan }) => {
  const [scanResult, setScanResult] = useState<CaribexPayload | null>(null);
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startScanner = () => {
    setError(null);
    setScanResult(null);
    setIsScanning(true);

    const elementId = "caribex-qr-reader";

    try {
      const html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;

      const qrConfig: any = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      };

      html5QrCode
        .start({ facingMode: "environment" }, qrConfig, onScanSuccess, onScanFailure)
        .catch(() => {
          setError("No se pudo acceder a la cámara. Verifica los permisos.");
          setIsScanning(false);
        });
    } catch (err) {
      console.error("Error inicializando Html5Qrcode", err);
      setError("No se pudo inicializar el escáner QR.");
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      const instance = scannerRef.current;
      instance
        .stop()
        .then(() => {
          try {
            instance.clear();
          } catch {
            // ignorar errores de limpieza visual
          }
        })
        .catch((err) => console.error("Error al detener", err))
        .finally(() => {
          if (scannerRef.current === instance) {
            scannerRef.current = null;
          }
          setIsScanning(false);
        });
    }
  };

  // Al desmontar el componente, asegurarnos de apagar la cámara si sigue activa.
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop?.().catch(() => {});
          scannerRef.current.clear?.();
        } catch {
          // ignorar errores al apagar en el unmount
        } finally {
          scannerRef.current = null;
        }
      }
    };
  }, []);

  const onScanSuccess = (decodedText: string) => {
    setRawContent(decodedText);

    const payload = parseCaribexQr(decodedText);

    if (!payload) {
      // Código no pertenece a Caribex
      setError(
        `Código inválido: este QR no pertenece a la plataforma de ${CARIBEX_CONFIG.NOMBRE}`,
      );
      return;
    }

    setScanResult({ ...payload });
    setError(null);

    if (onCaribexScan) {
      onCaribexScan(payload);
    }

    stopScanner();
  };

  const onScanFailure = (_error: unknown) => {
    // No mostramos errores de lectura constante para no saturar la UI
    // Solo errores críticos de hardware se manejan en el catch de start()
  };

  return (
    <div className="container">
      <style>
        {`
          .container {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 500px;
            margin: 40px auto;
            padding: 20px;
            text-align: center;
            background-color: #f8fafc;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          }

          .header {
            margin-bottom: 24px;
          }

          .header h1 {
            color: #1e293b;
            font-size: 1.5rem;
            margin-bottom: 8px;
          }

          .header p {
            color: #64748b;
            font-size: 0.9rem;
          }

          #caribex-qr-reader {
            width: 100%;
            border-radius: 12px;
            overflow: hidden;
            background: #000;
            margin-bottom: 20px;
          }

          .btn {
            padding: 12px 24px;
            font-size: 1rem;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .btn-primary {
            background-color: #2563eb;
            color: white;
          }

          .btn-primary:hover {
            background-color: #1d4ed8;
          }

          .btn-danger {
            background-color: #ef4444;
            color: white;
          }

          .status-box {
            margin-top: 20px;
            padding: 15px;
            border-radius: 8px;
            text-align: left;
          }

          .error {
            background-color: #fee2e2;
            color: #991b1b;
            border: 1px solid #f87171;
          }

          .success {
            background-color: #dcfce7;
            color: #166534;
            border: 1px solid #4ade80;
          }

          .result-data {
            font-family: monospace;
            background: rgba(255,255,255,0.5);
            padding: 8px;
            display: block;
            margin-top: 5px;
            word-break: break-all;
          }

          .badge {
            display: inline-block;
            padding: 4px 8px;
            background: #334155;
            color: white;
            border-radius: 4px;
            font-size: 0.7rem;
            margin-bottom: 10px;
          }
        `}
      </style>

      <div className="header">
        <span className="badge">SCANNER EXCLUSIVO</span>
        <h1>{CARIBEX_CONFIG.NOMBRE}</h1>
        <p>Solo se admiten códigos generados por nuestra plataforma oficial.</p>
      </div>

      <div id="caribex-qr-reader"></div>

      {!isScanning ? (
        <button className="btn btn-primary" onClick={startScanner}>
          Iniciar Escáner
        </button>
      ) : (
        <button className="btn btn-danger" onClick={stopScanner}>
          Detener Cámara
        </button>
      )}

      {error && (
        <div className="status-box error">
          <strong>Error de validación:</strong>
          <p>{error}</p>
        </div>
      )}

      {scanResult && (
        <div className="status-box success">
          <strong>✓ Código Verificado</strong>
          {scanResult.id && (
            <p>
              ID Detectado: <span className="result-data">{scanResult.id}</span>
            </p>
          )}
          {scanResult.tracking && (
            <p>
              Tracking: <span className="result-data">{scanResult.tracking}</span>
            </p>
          )}
          {rawContent && (
            <p>
              Contenido QR bruto:
              <span className="result-data">{rawContent}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default EscanerQRCaribex;