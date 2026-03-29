export const SUPPORTED_PREFERRED_LANGUAGES = [
  'en-GB',
  'en-US',
  'fr-FR',
  'de-DE',
  'es-ES',
  'it-IT',
  'nl-NL',
  'pt-PT',
  'ja-JP',
  'ko-KR',
  'zh-CN',
  'ar-SA'
] as const;

export type SupportedPreferredLanguage = typeof SUPPORTED_PREFERRED_LANGUAGES[number];

export function isSupportedPreferredLanguage(value: unknown): value is SupportedPreferredLanguage {
  return typeof value === 'string' && SUPPORTED_PREFERRED_LANGUAGES.includes(value as SupportedPreferredLanguage);
}
