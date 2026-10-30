type AuditActor = {
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
};

const ROLE_NAMES = new Set(["admin", "administrator", "administrador", "staff", "personal", "employee", "empleado"]);

export function auditActorName(actor: AuditActor): string {
  const name = String(actor.actor_name || "").trim();
  const email = String(actor.actor_email || "").trim();
  const genericName = ROLE_NAMES.has(name.toLowerCase()) || name.toLowerCase() === String(actor.actor_role || "").trim().toLowerCase();
  if (name && !genericName) return name;
  return email || "Unknown staff";
}

export function auditActorRole(value?: string | null): string {
  const role = String(value || "").trim();
  if (["admin", "administrator", "administrador"].includes(role.toLowerCase())) return "Admin";
  if (["staff", "personal", "employee", "empleado"].includes(role.toLowerCase())) return "Staff";
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Unknown role";
}
