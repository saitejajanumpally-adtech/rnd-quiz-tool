import React from 'react';
import { createRoot } from 'react-dom/client';
import './lib/theme.js';
import './styles.css';
import App from './App.jsx';
createRoot(document.getElementById('root')).render(<App />);
