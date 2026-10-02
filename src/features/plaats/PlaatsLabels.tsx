import { REISSCHEMA } from '@/data/content';
import { plaatsFeitId } from '@/data/content/feiten';
import type { Plaats } from '@/domein/schema';
import { dagenIn } from '@/domein/highlight/verblijf';
import { sluitingTijdens } from '@/domein/openingstijden/status';
import { alsPeriode } from '@/domein/tijd/datums';
import { Label } from '@/ui/basis';
import { Controleren } from '@/ui/Controleren';

/**
 * De labels die een uitgezochte plek extra kan hebben, overal hetzelfde: in de
 * Top 20, in de lijst van de stad en op de pagina van de plek.
 *
 * "Tijdelijk gesloten" staat er alleen als de sluiting over jouw dagen in die
 * stad valt. Een museum dat in maart dicht is voor onderhoud, doet er in
 * oktober niet toe; het mausoleum dat tot en met 2 november dicht is wel.
 */
export const PlaatsLabels = ({
  plaats,
  metBron = false,
  controleren = true,
}: {
  plaats: Plaats;
  metBron?: boolean;
  /** Uit binnen een knop: het label "controleren" is zelf een knop. */
  controleren?: boolean;
}) => {
  const sluiting = sluitingTijdens(plaats, dagenIn(REISSCHEMA, plaats.stad));
  const indicatie = plaats.prijzen?.[0]?.indicatief === true;
  return (
    <>
      {plaats.onderscheiding && <Label toon="gratis">{plaats.onderscheiding}</Label>}
      {sluiting && (
        <Label toon="let-op">Tijdelijk gesloten, {alsPeriode(sluiting.van, sluiting.tot)}</Label>
      )}
      {plaats.status === 'onzeker' && <Label toon="let-op">Status onzeker</Label>}
      {indicatie && <Label>indicatie</Label>}
      {controleren && <PlaatsControleren plaats={plaats} metBron={metBron} />}
    </>
  );
};

/** Alleen het label "controleren" van een plek, met de bron en de datum. */
export const PlaatsControleren = ({
  plaats,
  metBron = false,
}: {
  plaats: Plaats;
  metBron?: boolean;
}) => (
  <Controleren
    id={plaatsFeitId(plaats.id)}
    gecontroleerd={plaats.gecontroleerd}
    bron={plaats.bronnen?.[0]}
    gecheckt={plaats.gecheckt}
    metBron={metBron}
  />
);
