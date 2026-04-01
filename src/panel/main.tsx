import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { hydrateTheme, hydrateRoute } from './store/settingsStore';

const root = document.getElementById('root')!;

// Load persisted theme and route BEFORE first paint
Promise.all([hydrateTheme(), hydrateRoute()]).then(([_, initialRoute]) => {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App initialRoute={initialRoute} />
    </React.StrictMode>
  );
});
