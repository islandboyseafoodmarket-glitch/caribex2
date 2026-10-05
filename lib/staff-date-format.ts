export const CENTRAL_AMERICA_TIME_ZONE = "America/Tegucigalpa";

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
    timeZone: CENTRAL_AMERICA_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function centralAmericaDateParts(value: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_AMERICA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}
