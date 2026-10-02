import type { ReactNode } from 'react';
import { Volscherm } from './Volscherm';

/**
 * Een zin over het hele scherm, om aan iemand te laten zien: in een ziekenhuis,
 * aan een ober, aan een taxichauffeur. Het schrift zo groot als het kan, met de
 * Nederlandse betekenis klein eronder zodat jij weet wat je laat zien.
 *
 * `taal` zet het lang-attribuut, zodat de telefoon de Japanse vorm van een
 * teken kiest en niet de Chinese. `onderaan` komt na de betekenis, zoals de
 * antwoorden die de ander kan aanwijzen.
 */
export const Toonscherm = ({
  titel,
  taal,
  lokaal,
  nederlands,
  children,
  onderaan,
  onSluit,
}: {
  titel: string;
  taal: 'ja' | 'vi';
  lokaal: ReactNode;
  nederlands?: ReactNode;
  children?: ReactNode;
  onderaan?: ReactNode;
  onSluit: () => void;
}) => (
  <Volscherm
    titel={titel}
    helder
    tip="Zet je scherm op maximale helderheid, dan is het goed te lezen."
    onSluit={onSluit}
  >
    <div
      lang={taal}
      className="pt-4 text-[2.1rem] leading-snug font-semibold break-words text-black"
    >
      {lokaal}
    </div>
    {children}
    {nederlands && <div className="mt-6 text-base leading-relaxed text-black/60">{nederlands}</div>}
    {onderaan}
  </Volscherm>
);
