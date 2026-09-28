import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { laadFeitgroepen, type Feitengroep } from '@/data/content/feiten';
import { useNagekeken, zetControles } from '@/data/controles';
import { Kaartje, Knop, Sectiekop, Terug } from '@/ui/basis';

/**
 * Controleren: alle meegeleverde feiten die je voor vertrek wilt nakijken.
 *
 * Noodnummers, adressen van ambassades, vertalingen van allergenen, laatste
 * treinen, drukte. Ze komen uit algemene kennis en zijn niet ter plaatse
 * gecontroleerd. Vink ze hier af als je ze bij de bron hebt nagekeken; het label
 * "controleren" verdwijnt dan overal in de app.
 */
export const ControlerenScherm = () => {
  const [groepen, setGroepen] = useState<Feitengroep[] | null>(null);
  const nagekeken = useNagekeken();

  useEffect(() => {
    void laadFeitgroepen().then(setGroepen);
  }, []);

  const teControleren = (groep: Feitengroep) => groep.feiten.filter((f) => !f.gecontroleerd);
  const open =
    groepen && nagekeken
      ? groepen.flatMap(teControleren).filter((f) => !nagekeken.has(f.id)).length
      : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Terug naar="/meer" />
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Controleren</h1>
      <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Deze feiten reizen met de app mee maar zijn niet ter plaatse nagekeken. Kijk ze voor vertrek
        na bij de bron, en vink ze hier af. Het label "controleren" verdwijnt dan overal.
      </p>

      {open !== null && (
        <p className="mb-5 font-medium">
          {open === 0 ? 'Alles is nagekeken.' : `Nog ${open} om na te kijken.`}
        </p>
      )}

      {groepen && nagekeken && (
        <div className="grid gap-6">
          {groepen.map((groep) => {
            const feiten = teControleren(groep);
            if (feiten.length === 0) return null;
            const klaar = feiten.filter((f) => nagekeken.has(f.id)).length;
            return (
              <section key={groep.id}>
                <Sectiekop
                  extra={
                    <span className="text-xs text-inkt-zacht dark:text-papier/55">
                      {klaar} van {feiten.length}
                    </span>
                  }
                >
                  {groep.naam}
                </Sectiekop>
                <Kaartje className="overflow-hidden">
                  <ul className="divide-y divide-black/5 dark:divide-white/10">
                    {feiten.map((feit) => (
                      <li key={feit.id}>
                        <label className="flex items-start gap-3 px-3.5 py-2.5 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={nagekeken.has(feit.id)}
                            onChange={(e) => void zetControles([feit.id], e.target.checked)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{feit.titel}</span>
                            {feit.detail && (
                              <span className="block break-words text-inkt-zacht dark:text-papier/60">
                                {feit.detail}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </Kaartje>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {klaar < feiten.length && (
                    <Knop
                      klein
                      onClick={() =>
                        void zetControles(
                          feiten.map((f) => f.id),
                          true,
                        )
                      }
                    >
                      Alles in deze groep nagekeken
                    </Knop>
                  )}
                  <Link
                    to={groep.pad}
                    className="text-xs text-zegel underline underline-offset-2 dark:text-zegel-licht"
                  >
                    bekijk in de app
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
