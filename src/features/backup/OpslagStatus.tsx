import { useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { leesOpslagstand, vraagBlijvendeOpslag, type Opslagstand } from '@/data/opslagruimte';
import { alsGrootte } from '@/domein/fotos/miniatuur';
import { Kaartje, Knop } from '@/ui/basis';

/**
 * Hoeveel ruimte de app gebruikt, en of de browser belooft die niet op te
 * ruimen. Dat laatste is het verschil tussen "mijn foto's staan veilig" en
 * "mijn foto's staan er tot de telefoon ruimte nodig heeft".
 */
export const OpslagStatus = () => {
  const [stand, setStand] = useState<Opslagstand | null>(null);

  useEffect(() => {
    void leesOpslagstand().then(setStand);
  }, []);

  if (!stand) return null;

  const vraag = async () => {
    await vraagBlijvendeOpslag();
    setStand(await leesOpslagstand());
  };

  return (
    <Kaartje className="p-4 text-sm leading-relaxed">
      <p className="flex items-center gap-2 font-medium">
        <HardDrive className="size-4 text-zegel dark:text-zegel-licht" aria-hidden />
        Opslag op dit toestel
      </p>
      {stand.gebruikt !== undefined && (
        <p className="mt-1.5">
          In gebruik: {alsGrootte(stand.gebruikt)}
          {stand.beschikbaar !== undefined && ` van ruwweg ${alsGrootte(stand.beschikbaar)}`}.
        </p>
      )}
      <p className="mt-1.5">
        {stand.blijvend === true &&
          'De browser heeft beloofd je gegevens niet zomaar op te ruimen.'}
        {stand.blijvend === false &&
          'De browser heeft niet beloofd je gegevens te bewaren. Bij ruimtegebrek kan hij ze opruimen; een backup is dan je vangnet.'}
        {stand.blijvend === null && 'Deze browser zegt niet of hij je gegevens bewaart.'}
      </p>
      {stand.blijvend === false && (
        <div className="mt-2">
          <Knop klein onClick={() => void vraag()}>
            Opnieuw vragen
          </Knop>
        </div>
      )}
    </Kaartje>
  );
};
