"use client";

import { supabase } from "./supabaseClient";

export type CaribexManualLabel = {
  id: string;
  tracking: string;
  boxCode: string;
  createdAt: string;
  accountNumber: string | null;
  destinationPort: string | null;
};

type ApiLabel = { id: string; tracking: string; created_at: string; account_number?: string | null; destination_port?: string | null };

async function requestManualLabels(method: "GET" | "POST", options?: { count?: number; accountNumber?: string | null; destinationPort?: string | null }): Promise<CaribexManualLabel[]> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  const response = await fetch("/api/caribex/manual-labels", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(options || {}) } : {}),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Unable to load Caribex labels.");
  const labels = Array.isArray(payload?.labels) ? payload.labels as ApiLabel[] : [];
  return labels.map((label) => ({
    id: label.id,
    tracking: label.tracking,
    boxCode: label.tracking,
    createdAt: label.created_at,
    accountNumber: label.account_number ?? null,
    destinationPort: label.destination_port ?? null,
  }));
}

export function listAvailableCaribexManualLabels() {
  return requestManualLabels("GET");
}

export function createCaribexManualLabels(count: number, accountNumber?: string | null, destinationPort?: string | null) {
  return requestManualLabels("POST", { count, accountNumber, destinationPort });
}
