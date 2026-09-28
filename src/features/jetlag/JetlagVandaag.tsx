import { Link } from 'react-router-dom';
import { Kaartje, Sectiekop } from '@/ui/basis';
import { dagVanVandaag, plusDagen } from '@/domein/jetlag/protocol';
import { datumIn } from '@/domein/tijd/zones';
import { useJetlag } from './useJetlag';
import { alsDagLabel, kernregel } from './tekst';

/** Hoe lang van tevoren het hoofdmenu meldt dat het plan eraan komt. */
const VOORAANKONDIGING_DAGEN = 7;

/**
 * Eén regel jetlag in het hoofdmenu, alleen op de dagen dat het ertoe doet.
 *
 * In de week voor de voorbereiding een seintje dat die eraan komt, en daarna
 * elke dag wat je vandaag moet doen, tot je klok gelijk loopt. Daarbuiten staat
 * hier niets: een kaart die elke dag hetzelfde zegt, leest niemand meer.
 */
export const JetlagVandaag = () => {
  const { plan, geladen } = useJetlag();
  // Pas tonen als de bewaarde slaaptijden binnen zijn, anders flitst er eerst
  // een regel met de standaardtijden voorbij.
  if (!geladen || !plan) return null;

  const nu = new Date();
  const dag = dagVanVandaag(plan, nu);
  const eerste = plan.heen[0];
  const thuisVandaag = datumIn(plan.thuis, nu);

  let tekst: string | null = null;
  if (dag && !dag.aangepast) {
    tekst = kernregel(dag);
  } else if (
    eerste &&
    thuisVandaag < eerste.datum &&
    thuisVandaag >= plusDagen(eerste.datum, -VOORAANKONDIGING_DAGEN)
  ) {
    tekst = `Je jetlagplan begint op ${alsDagLabel(eerste.datum).toLowerCase()}.`;
  }
  if (!tekst) return null;

  return (
    <section className="mb-6">
      <Sectiekop
        extra={
          <Link
            to="/jetlag"
            className="text-xs font-medium text-zegel underline underline-offset-2"
          >
            het hele plan
          </Link>
        }
      >
        Jetlag
      </Sectiekop>
      <Link to="/jetlag" className="block">
        <Kaartje className="p-4 transition hover:bg-white dark:hover:bg-nacht-diep">
          <p className="text-[15px] leading-relaxed">{tekst}</p>
        </Kaartje>
      </Link>
    </section>
  );
};
