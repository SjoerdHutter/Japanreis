import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import type { z } from 'zod';

/**
 * Formuliervelden in de huisstijl.
 *
 * Dezelfde klassen stonden al in elk scherm met een formulier opnieuw
 * uitgeschreven. Mijn gegevens heeft er tientallen, dus hier staan ze één keer.
 * De tekst blijft 16 pixels: kleiner, en iOS zoomt bij elke tik in op het veld.
 */

export const INVOER_KLASSE =
  'w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht';

export const Veld = ({
  label,
  fout,
  uitleg,
  children,
}: {
  label: ReactNode;
  fout?: string;
  uitleg?: ReactNode;
  children: ReactNode;
}) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium">{label}</span>
    {children}
    {uitleg && (
      <span className="mt-1 block text-xs leading-relaxed text-inkt-zacht dark:text-papier/55">
        {uitleg}
      </span>
    )}
    {fout && (
      <span role="alert" className="mt-1 block text-xs text-zegel dark:text-zegel-licht">
        {fout}
      </span>
    )}
  </label>
);

export const Invoer = ({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...rest} className={`${INVOER_KLASSE} ${className}`} />
);

export const Tekstvak = ({
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={3} {...rest} className={`${INVOER_KLASSE} ${className}`} />
);

export const Keuze = ({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...rest} className={`${INVOER_KLASSE} ${className}`} />
);

/** Voor codes als een boekingsnummer: geen autocorrectie, hoofdletters. */
export const CODE_INVOER = {
  autoCapitalize: 'characters',
  autoCorrect: 'off',
  spellCheck: false,
} as const;

/**
 * De fouten van Zod per veld, met het pad als sleutel: "vertrek.tijd". Eén
 * melding per veld, de eerste, want drie meldingen onder één vakje leest niemand.
 */
export const foutenPerVeld = (fout: z.ZodError | undefined): Record<string, string> => {
  const uit: Record<string, string> = {};
  for (const probleem of fout?.issues ?? []) {
    const pad = probleem.path.map(String).join('.');
    uit[pad] ??= probleem.message;
  }
  return uit;
};
