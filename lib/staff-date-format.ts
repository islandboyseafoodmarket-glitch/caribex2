export function formatStaffDateTime(value: string | Date | null | undefined, locale = "en-US") {
  if (!value) return "-";
  if (typeof value === "string") {
    const timeOnly = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeOnly) {
      const hours = Number(timeOnly[1]);
      const minutes = Number(timeOnly[2]);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const suffix = hours >= 12 ? "PM" : "AM";
        const displayHour = hours % 12 || 12;
        return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
      }
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(locale, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
