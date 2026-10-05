export type InvoiceApprovalEvidence = {
  notas?: unknown;
  problema_notas?: unknown;
  notas_imagenes?: unknown;
};

export function hasInvoiceReviewEvidence(input: InvoiceApprovalEvidence) {
  const hasNote = [input.notas, input.problema_notas].some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  const hasPhoto =
    Array.isArray(input.notas_imagenes) &&
    input.notas_imagenes.some(
      (value) => typeof value === "string" && value.trim().length > 0,
    );

  return hasNote || hasPhoto;
}

export function invoiceApprovalStatus(input: InvoiceApprovalEvidence) {
  return hasInvoiceReviewEvidence(input) ? "PENDING" : "APPROVED";
}
