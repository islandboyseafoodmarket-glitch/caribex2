export type PhoneCountryValue =
  | "HN"
  | "US"
  | "CA"
  | "MX"
  | "GT"
  | "SV"
  | "NI"
  | "CR"
  | "PA"
  | "BZ"
  | "DO"
  | "CO"
  | "ES"
  | "GB"
  | "BR";

export type PhoneCountry = {
  value: PhoneCountryValue;
  dialCode: string;
  nameEn: string;
  nameEs: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { value: "HN", dialCode: "504", nameEn: "Honduras", nameEs: "Honduras" },
  { value: "US", dialCode: "1", nameEn: "United States", nameEs: "Estados Unidos" },
  { value: "CA", dialCode: "1", nameEn: "Canada", nameEs: "Canadá" },
  { value: "MX", dialCode: "52", nameEn: "Mexico", nameEs: "México" },
  { value: "GT", dialCode: "502", nameEn: "Guatemala", nameEs: "Guatemala" },
  { value: "SV", dialCode: "503", nameEn: "El Salvador", nameEs: "El Salvador" },
  { value: "NI", dialCode: "505", nameEn: "Nicaragua", nameEs: "Nicaragua" },
  { value: "CR", dialCode: "506", nameEn: "Costa Rica", nameEs: "Costa Rica" },
  { value: "PA", dialCode: "507", nameEn: "Panama", nameEs: "Panamá" },
  { value: "BZ", dialCode: "501", nameEn: "Belize", nameEs: "Belice" },
  { value: "DO", dialCode: "1", nameEn: "Dominican Republic", nameEs: "República Dominicana" },
  { value: "CO", dialCode: "57", nameEn: "Colombia", nameEs: "Colombia" },
  { value: "ES", dialCode: "34", nameEn: "Spain", nameEs: "España" },
  { value: "GB", dialCode: "44", nameEn: "United Kingdom", nameEs: "Reino Unido" },
  { value: "BR", dialCode: "55", nameEn: "Brazil", nameEs: "Brasil" },
];

export const DEFAULT_PHONE_COUNTRY: PhoneCountryValue = "HN";

export function getPhoneCountry(value: PhoneCountryValue): PhoneCountry {
  return PHONE_COUNTRIES.find((country) => country.value === value) || PHONE_COUNTRIES[0];
}

export function getPhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatPhoneValue(countryValue: PhoneCountryValue, localValue: string): string {
  const localDigits = getPhoneDigits(localValue);
  if (!localDigits) return "";
  return `+${getPhoneCountry(countryValue).dialCode} ${localDigits}`;
}

export function parsePhoneValue(
  value: string | null | undefined,
  fallbackCountry: PhoneCountryValue = DEFAULT_PHONE_COUNTRY,
): { countryValue: PhoneCountryValue; localValue: string } {
  const rawValue = String(value || "").trim();
  if (!rawValue) return { countryValue: fallbackCountry, localValue: "" };

  const digits = getPhoneDigits(rawValue);
  const hasInternationalPrefix = /^\s*(?:\+|00)/.test(rawValue);
  if (!hasInternationalPrefix) {
    return { countryValue: fallbackCountry, localValue: digits };
  }

  const internationalDigits = rawValue.replace(/^\s*\+/, "").replace(/^00/, "");
  const matchingCountries = PHONE_COUNTRIES.filter((country) =>
    internationalDigits.startsWith(country.dialCode),
  );
  if (matchingCountries.length === 0) {
    return { countryValue: fallbackCountry, localValue: digits };
  }

  const fallback = getPhoneCountry(fallbackCountry);
  const country =
    matchingCountries.find((candidate) => candidate.value === fallback.value) || matchingCountries[0];
  return {
    countryValue: country.value,
    localValue: internationalDigits.slice(country.dialCode.length),
  };
}
