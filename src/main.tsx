import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { registerServiceWorker } from './pwa';
import './styles/index.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';

/**
 * HashRouter en niet BrowserRouter: op GitHub Pages staat er geen server die
 * een diepe link naar index.html kan terugsturen. Met een hash gebeurt de
 * routering volledig in de browser en werkt een gedeelde link naar een stad ook
 * bij de allereerste opening, voordat de service worker er is.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);

registerServiceWorker();
