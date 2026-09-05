import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from '@/state/AppProvider';
import { Hoofdmenu } from '@/features/steden/Hoofdmenu';
import { StadScherm } from '@/features/stad/StadScherm';
import { ImportScherm } from '@/features/import/ImportScherm';
import { StadGeschiedenisScherm, TijdlijnScherm } from '@/features/geschiedenis/TijdlijnScherm';
import { FotokaartScherm } from '@/features/fotos/FotokaartScherm';
import { StempelboekScherm } from '@/features/stempels/StempelboekScherm';
import { AppgidsScherm } from '@/features/praktisch/AppgidsScherm';
import { VervoerScherm } from '@/features/praktisch/VervoerScherm';
import { BudgetScherm } from '@/features/praktisch/BudgetScherm';
import { DagplannerScherm } from '@/features/planning/DagplannerScherm';
import { OverstapScherm } from '@/features/planning/OverstapScherm';
import { ContextScherm } from '@/features/praktisch/ContextScherm';

const App = () => (
  <AppProvider>
    <Routes>
      <Route path="/" element={<Hoofdmenu />} />
      <Route path="/stad/:stadId" element={<StadScherm />} />
      <Route path="/import" element={<ImportScherm />} />
      <Route path="/fotos" element={<FotokaartScherm />} />
      <Route path="/stempels" element={<StempelboekScherm />} />
      <Route path="/apps" element={<AppgidsScherm />} />
      <Route path="/vervoer" element={<VervoerScherm />} />
      <Route path="/budget" element={<BudgetScherm />} />
      <Route path="/dagplanner" element={<DagplannerScherm />} />
      <Route path="/overstap" element={<OverstapScherm />} />
      <Route path="/context" element={<ContextScherm />} />
      <Route path="/tijdlijn/:tijdlijnId" element={<TijdlijnScherm />} />
      <Route path="/geschiedenis/:stadId" element={<StadGeschiedenisScherm />} />
      {/* Onbekend pad hoort niet op een lege pagina uit te komen; terug naar
          het overzicht is altijd een bruikbaar antwoord. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </AppProvider>
);

export default App;
