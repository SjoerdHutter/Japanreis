import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from '@/state/AppProvider';
import { Hoofdmenu } from '@/features/steden/Hoofdmenu';
import { StadScherm } from '@/features/stad/StadScherm';
import { ImportScherm } from '@/features/import/ImportScherm';
import { StadGeschiedenisScherm, TijdlijnScherm } from '@/features/geschiedenis/TijdlijnScherm';
import { FotokaartScherm } from '@/features/fotos/FotokaartScherm';
import { StempelboekScherm } from '@/features/stempels/StempelboekScherm';
import { AppgidsScherm } from '@/features/praktisch/AppgidsScherm';
import { TipsScherm } from '@/features/praktisch/TipsScherm';
import { VervoerScherm } from '@/features/praktisch/VervoerScherm';
import { BudgetScherm } from '@/features/praktisch/BudgetScherm';
import { DagplannerScherm } from '@/features/planning/DagplannerScherm';
import { OverstapScherm } from '@/features/planning/OverstapScherm';
import { ContextScherm } from '@/features/praktisch/ContextScherm';
import { JetlagScherm } from '@/features/jetlag/JetlagScherm';
import { MeerScherm } from '@/features/navigatie/MeerScherm';
import { Tabbalk } from '@/features/navigatie/Tabbalk';
import { ReisdagenScherm } from '@/features/reizen/ReisdagenScherm';
import { StationScherm } from '@/features/reizen/StationScherm';
import { StationsScherm } from '@/features/reizen/StationsScherm';
import { GegevensScherm } from '@/features/gegevens/GegevensScherm';
import { BackupScherm } from '@/features/backup/BackupScherm';
import { NoodScherm } from '@/features/nood/NoodScherm';
import { ControlerenScherm } from '@/features/controleren/ControlerenScherm';

const App = () => (
  <AppProvider>
    {/* Ruimte onder elk scherm voor de balk onderaan, zodat die nooit het
        laatste stuk van een pagina afdekt. */}
    <div className="pb-14">
      <Routes>
        <Route path="/" element={<Hoofdmenu />} />
        <Route path="/stad/:stadId" element={<StadScherm />} />
        <Route path="/import" element={<ImportScherm />} />
        <Route path="/fotos" element={<FotokaartScherm />} />
        <Route path="/stempels" element={<StempelboekScherm />} />
        <Route path="/apps" element={<AppgidsScherm />} />
        <Route path="/tips" element={<TipsScherm />} />
        <Route path="/vervoer" element={<VervoerScherm />} />
        <Route path="/budget" element={<BudgetScherm />} />
        <Route path="/dagplanner" element={<DagplannerScherm />} />
        <Route path="/overstap" element={<OverstapScherm />} />
        <Route path="/context" element={<ContextScherm />} />
        <Route path="/jetlag" element={<JetlagScherm />} />
        <Route path="/meer" element={<MeerScherm />} />
        <Route path="/reisdagen" element={<ReisdagenScherm />} />
        <Route path="/stations" element={<StationsScherm />} />
        <Route path="/station/:stationId" element={<StationScherm />} />
        <Route path="/gegevens" element={<GegevensScherm />} />
        <Route path="/backup" element={<BackupScherm />} />
        <Route path="/nood" element={<NoodScherm />} />
        <Route path="/controleren" element={<ControlerenScherm />} />
        <Route path="/tijdlijn/:tijdlijnId" element={<TijdlijnScherm />} />
        <Route path="/geschiedenis/:stadId" element={<StadGeschiedenisScherm />} />
        {/* Onbekend pad hoort niet op een lege pagina uit te komen; terug naar
          het overzicht is altijd een bruikbaar antwoord. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
    <Tabbalk />
  </AppProvider>
);

export default App;
