import type { Stad } from '@/domein/schema';
import { Knop } from '@/ui/basis';

/**
 * De keuzebalk uit hoofdstuk 1.5: GPS en reisschema zijn het oneens, dus vraagt
 * de app het met één tik.
 *
 * Het klassieke geval is een dagtrip naar Nara terwijl je in Kyoto slaapt.
 * Beide antwoorden zijn goed, dus de app kiest niet zelf maar legt het voor,
 * met de derde optie erbij voor een reisdag waarop je ze allebei wilt zien.
 */
export const Keuzebalk = ({
  gps,
  schema,
  onKies,
}: {
  gps: Stad;
  schema: Stad;
  onKies: (stadId: string, opties?: { tweedeStadId?: string }) => void;
}) => (
  <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/40">
    <p className="mb-2.5 text-sm text-amber-950 dark:text-amber-100">
      Je bent in <strong>{gps.naam}</strong>, maar volgens het reisschema is{' '}
      <strong>{schema.naam}</strong> vandaag aan de beurt. Welke wil je bovenaan?
    </p>
    <div className="flex flex-wrap gap-2">
      <Knop klein soort="nadruk" onClick={() => onKies(gps.id)}>
        {gps.naam}
      </Knop>
      <Knop klein onClick={() => onKies(schema.id)}>
        {schema.naam}
      </Knop>
      <Knop klein soort="stil" onClick={() => onKies(gps.id, { tweedeStadId: schema.id })}>
        Allebei tonen
      </Knop>
    </div>
  </div>
);
