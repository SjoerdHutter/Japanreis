/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** De commit waarop deze build draait; gezet in vite.config.ts. */
declare const __APP_VERSIE__: string;
/** Wanneer deze build gemaakt is, als ISO-moment. */
declare const __APP_GEBOUWD_OP__: string;

/**
 * De reiscontent staat in YAML en wordt tijdens de build naar JSON omgezet.
 * Wat er precies in zit valideert het Zod-schema, dus hier is `unknown` genoeg
 * en tegelijk het eerlijkste type.
 */
declare module '*.yaml' {
  const inhoud: unknown;
  export default inhoud;
}
