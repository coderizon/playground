import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/main.css';
import { ensureTfLoaded } from './utils/loadTf.js';

// Ensure TF is loaded before mounting
ensureTfLoaded().then(() => {
  ReactDOM.createRoot(document.getElementById('new-app-root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
