"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_PHONE_COUNTRY,
  formatPhoneValue,
  getPhoneCountry,
  parsePhoneValue,
  PHONE_COUNTRIES,
  type PhoneCountryValue,
} from "../lib/phone-countries";

export type PhoneCountryFieldProps = {
  name: string;
  label: string;
  value?: string;
  defaultCountry?: PhoneCountryValue;
  onChange?: (value: string) => void;
  required?: boolean;
  isEn?: boolean;
  localPlaceholder?: string;
  autoComplete?: string;
  wrapperStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  selectStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
};

export default function PhoneCountryField({
  name,
  label,
  value,
  defaultCountry = DEFAULT_PHONE_COUNTRY,
  onChange,
  required = false,
  isEn = false,
  localPlaceholder,
  autoComplete = "tel-national",
  wrapperStyle,
  labelStyle,
  selectStyle,
  inputStyle,
}: PhoneCountryFieldProps) {
  const ids = useId();
  const localId = `${ids}-phone-local`;
  const countryId = `${ids}-phone-country`;
  const initial = parsePhoneValue(value, defaultCountry);
  const [countryValue, setCountryValue] = useState<PhoneCountryValue>(initial.countryValue);
  const [localValue, setLocalValue] = useState(initial.localValue);
  const lastSerializedValue = useRef(value);

  useEffect(() => {
    if (value === undefined || value === lastSerializedValue.current) return;
    const parsed = parsePhoneValue(value, defaultCountry);
    setCountryValue(parsed.countryValue);
    setLocalValue(parsed.localValue);
    lastSerializedValue.current = value;
  }, [defaultCountry, value]);

  const serialize = (nextCountry: PhoneCountryValue, nextLocal: string) => {
    const nextValue = formatPhoneValue(nextCountry, nextLocal);
    lastSerializedValue.current = nextValue;
    onChange?.(nextValue);
  };

  const handleCountryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCountry = event.target.value as PhoneCountryValue;
    setCountryValue(nextCountry);
    serialize(nextCountry, localValue);
  };

  const handleLocalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parsePhoneValue(event.target.value, countryValue);
    setCountryValue(parsed.countryValue);
    setLocalValue(parsed.localValue);
    serialize(parsed.countryValue, parsed.localValue);
  };

  const countryLabel = isEn ? "Country code" : "Código de país";
  const localLabel = isEn ? "Local phone number" : "Número local";
  const placeholder = localPlaceholder || (isEn ? "555 123 4567" : "555 123 4567");
  const selectedCountry = getPhoneCountry(countryValue);
  const serializedValue = formatPhoneValue(countryValue, localValue);

  return (
    <div style={{ minWidth: 0, ...wrapperStyle }}>
      <label htmlFor={localId} style={labelStyle}>
        {label}
        {required ? " *" : ""}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: "0.5rem",
          width: "100%",
          minWidth: 0,
        }}
      >
        <label htmlFor={countryId} style={{ display: "block", position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
          {countryLabel}
        </label>
        <select
          id={countryId}
          value={countryValue}
          onChange={handleCountryChange}
          aria-label={countryLabel}
          style={{
            flex: "0 1 clamp(7.5rem, 35vw, 11rem)",
            minWidth: 0,
            ...selectStyle,
          }}
        >
          {PHONE_COUNTRIES.map((country) => (
            <option key={country.value} value={country.value}>
              {isEn ? country.nameEn : country.nameEs} (+{country.dialCode})
            </option>
          ))}
        </select>
        <label htmlFor={localId} style={{ display: "block", position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
          {localLabel}
        </label>
        <input
          id={localId}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          value={localValue}
          onChange={handleLocalChange}
          required={required}
          placeholder={placeholder}
          aria-label={localLabel}
          style={{ flex: "1 1 10rem", minWidth: 0, ...inputStyle }}
        />
      </div>
      <input type="hidden" name={name} value={serializedValue} readOnly aria-hidden="true" />
      <span aria-live="polite" style={{ display: "block", position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
        {serializedValue ? `${selectedCountry.nameEn} +${selectedCountry.dialCode}` : ""}
      </span>
    </div>
  );
}
