export const REFERRAL_SOURCE_VALUES = [
  "facebook",
  "instagram",
  "tiktok",
  "google_search",
  "friend_family",
  "referred_customer",
  "other",
] as const;

export type ReferralSource = (typeof REFERRAL_SOURCE_VALUES)[number];

export const REFERRAL_SOURCE_LABELS: Record<ReferralSource, { en: string; es: string }> = {
  facebook: { en: "Facebook", es: "Facebook" },
  instagram: { en: "Instagram", es: "Instagram" },
  tiktok: { en: "TikTok", es: "TikTok" },
  google_search: { en: "Google/search", es: "Google/búsqueda" },
  friend_family: { en: "Friend/family", es: "Amigo/familia" },
  referred_customer: { en: "Referred customer", es: "Cliente referido" },
  other: { en: "Other", es: "Otro" },
};

export function isReferralSource(value: string): value is ReferralSource {
  return (REFERRAL_SOURCE_VALUES as readonly string[]).includes(value);
}

export function referralSourceNeedsDetails(value: string): boolean {
  return value === "friend_family" || value === "referred_customer" || value === "other";
}
