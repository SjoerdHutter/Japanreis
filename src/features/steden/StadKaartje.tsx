import { Link } from 'react-router-dom';
import type { Stad } from '@/domein/schema';
import { Label } from '@/ui/basis';

/**
 * Een stad in de lijst onder de highlight. Minder prominent, maar wel gewoon
 * een link: elke stad blijft volledig te openen, waar je ook bent. Dat is het
 * uitgangspunt van de hele app en het is hier één regel code.
 *
 * De `min-w-0` op de link zelf is geen versiering. Het kaartje staat in een
 * grid, en een griditem is standaard minstens zo breed als zijn inhoud. De
 * beschrijving staat op één regel, dus dat was de volle lengte van de langste
 * beschrijving: het hoofdmenu werd 1685 pixels breed en schoof op een telefoon
 * zijwaarts. De `min-w-0` op de tekst daarbinnen helpt daar niet tegen; die
 * geldt binnen het kaartje, niet voor het grid eromheen.
 */
export const StadKaartje = ({ stad, offline }: { stad: Stad; offline: boolean }) => (
  <Link
    to={`/stad/${stad.id}`}
    className="flex min-w-0 items-center gap-3 rounded-xl border border-black/5 bg-white/60 px-3.5 py-3 transition hover:bg-white dark:border-white/10 dark:bg-nacht-diep/60 dark:hover:bg-nacht-diep"
  >
    <span className="text-lg" aria-hidden>
      {stad.land === 'japan' ? '🇯🇵' : '🇻🇳'}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block font-medium">{stad.naam}</span>
      <span className="block truncate text-sm text-inkt-zacht dark:text-papier/60">
        {stad.korteBeschrijving}
      </span>
    </span>
    {offline && <Label toon="gratis">offline</Label>}
  </Link>
);
