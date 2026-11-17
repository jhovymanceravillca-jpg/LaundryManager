import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles.css';
import './theme.css';
import './enhancements.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root en index.html');

ReactDOM.createRoot(root).render(
  <React.StrictMode><App /></React.StrictMode>
);
