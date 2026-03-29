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
];
export function isSupportedPreferredLanguage(value) {
    return typeof value === 'string' && SUPPORTED_PREFERRED_LANGUAGES.includes(value);
}
