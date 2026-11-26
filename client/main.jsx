import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { Toaster } from './components/ui/Toast.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles/index.css';
createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
    <Toaster visibleToasts={3} duration={4500} offset={20} mobileOffset={16} />
  </AuthProvider>,
);
