import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from '@/state/AppProvider';
import { Hoofdmenu } from '@/features/steden/Hoofdmenu';
import { StadScherm } from '@/features/stad/StadScherm';
import { ImportScherm } from '@/features/import/ImportScherm';
import { StadGeschiedenisScherm, TijdlijnScherm } from '@/features/geschiedenis/TijdlijnScherm';

const App = () => (
  <AppProvider>
    <Routes>
      <Route path="/" element={<Hoofdmenu />} />
      <Route path="/stad/:stadId" element={<StadScherm />} />
      <Route path="/import" element={<ImportScherm />} />
      <Route path="/tijdlijn/:tijdlijnId" element={<TijdlijnScherm />} />
      <Route path="/geschiedenis/:stadId" element={<StadGeschiedenisScherm />} />
      {/* Onbekend pad hoort niet op een lege pagina uit te komen; terug naar
          het overzicht is altijd een bruikbaar antwoord. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </AppProvider>
);

export default App;
