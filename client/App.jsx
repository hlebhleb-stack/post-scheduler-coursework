import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Auth from './pages/Auth.jsx';
export default function App() {
  const { session } = useAuth();
  return (
    <BrowserRouter>
      {session ? (
        <Layout />
      ) : (
        <Routes>
          <Route path="register" element={<Auth key="register" register />} />
          <Route path="login" element={<Auth key="login" />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
