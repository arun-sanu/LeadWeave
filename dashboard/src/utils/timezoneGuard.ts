/**
 * Country Code & Time Zone mapping heuristics for WhatsApp E.164 phone numbers.
 * Provides "Safe Dispatch Window" (8:00 AM - 8:00 PM recipient local time) validation.
 */

export interface PhoneCountryInfo {
  countryCode: string;
  isoCountry: string;
  countryName: string;
  approximateUtcOffset: number; // in hours (e.g. +5.5 for IN, -5 for US EST)
}

const COUNTRY_DIAL_MAP: Record<string, { iso: string; name: string; offset: number }> = {
  '1': { iso: 'US/CA', name: 'USA / Canada', offset: -5 },
  '44': { iso: 'GB', name: 'United Kingdom', offset: 0 },
  '91': { iso: 'IN', name: 'India', offset: 5.5 },
  '62': { iso: 'ID', name: 'Indonesia', offset: 7 },
  '49': { iso: 'DE', name: 'Germany', offset: 1 },
  '33': { iso: 'FR', name: 'France', offset: 1 },
  '34': { iso: 'ES', name: 'Spain', offset: 1 },
  '39': { iso: 'IT', name: 'Italy', offset: 1 },
  '55': { iso: 'BR', name: 'Brazil', offset: -3 },
  '61': { iso: 'AU', name: 'Australia', offset: 10 },
  '81': { iso: 'JP', name: 'Japan', offset: 9 },
  '82': { iso: 'KR', name: 'South Korea', offset: 9 },
  '86': { iso: 'CN', name: 'China', offset: 8 },
  '971': { iso: 'AE', name: 'United Arab Emirates', offset: 4 },
  '966': { iso: 'SA', name: 'Saudi Arabia', offset: 3 },
  '234': { iso: 'NG', name: 'Nigeria', offset: 1 },
  '27': { iso: 'ZA', name: 'South Africa', offset: 2 },
  '90': { iso: 'TR', name: 'Turkey', offset: 3 },
  '7': { iso: 'RU/KZ', name: 'Russia / Kazakhstan', offset: 3 },
};

/**
 * Detect country code and estimated UTC offset from a normalized phone number.
 */
export function detectPhoneCountry(phoneOrDigits: string): PhoneCountryInfo {
  const digits = phoneOrDigits.replace(/\D/g, '');

  // Match 3-digit prefixes first, then 2-digit, then 1-digit
  for (const prefixLen of [3, 2, 1]) {
    const prefix = digits.slice(0, prefixLen);
    if (COUNTRY_DIAL_MAP[prefix]) {
      const info = COUNTRY_DIAL_MAP[prefix];
      return {
        countryCode: prefix,
        isoCountry: info.iso,
        countryName: info.name,
        approximateUtcOffset: info.offset,
      };
    }
  }

  return {
    countryCode: '',
    isoCountry: 'UNKNOWN',
    countryName: 'International / Unknown',
    approximateUtcOffset: 0,
  };
}

/**
 * Check if the current time in the recipient's approximate local timezone is within
 * the safe dispatch window (default 8:00 AM - 8:00 PM / 08:00 - 20:00).
 */
export function isWithinSafeWindow(
  phoneOrDigits: string,
  startHour: number = 8,
  endHour: number = 20,
  nowUtc: Date = new Date()
): { isSafe: boolean; recipientLocalHour: number; recipientLocalTimeStr: string; countryName: string } {
  const country = detectPhoneCountry(phoneOrDigits);
  const utcHours = nowUtc.getUTCHours() + nowUtc.getUTCMinutes() / 60;
  const localHour = (utcHours + country.approximateUtcOffset + 24) % 24;

  const hourInt = Math.floor(localHour);
  const minInt = Math.floor((localHour - hourInt) * 60);
  const timeStr = `${String(hourInt).padStart(2, '0')}:${String(minInt).padStart(2, '0')}`;

  const isSafe = localHour >= startHour && localHour < endHour;

  return {
    isSafe,
    recipientLocalHour: localHour,
    recipientLocalTimeStr: timeStr,
    countryName: country.countryName,
  };
}
