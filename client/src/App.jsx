import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Entradas from './pages/Entradas';
import GastosOwner from './pages/GastosOwner';
import DividasOwner from './pages/DividasOwner';
import Assinaturas from './pages/Assinaturas';
import WhatsApp from './pages/WhatsApp';
import UploadFatura from './pages/UploadFatura';
import Configuracoes from './pages/Configuracoes';
import { getToken, clearToken } from './api';

function PrivateRoute({ children, isAuth }) {
  return isAuth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [isAuth, setIsAuth] = useState(() => !!getToken());

  const handleLogin  = () => setIsAuth(true);
  const handleLogout = () => { clearToken(); setIsAuth(false); };

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota de login — redireciona para / se já autenticado */}
        <Route
          path="/login"
          element={isAuth ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />}
        />

        {/* Todas as outras rotas precisam de autenticação */}
        <Route
          path="/*"
          element={
            <PrivateRoute isAuth={isAuth}>
              <Layout onLogout={handleLogout}>
                <Routes>
                  <Route path="/"                   element={<Overview />} />
                  <Route path="/entradas/luan"       element={<Entradas owner="luan" />} />
                  <Route path="/entradas/barbara"    element={<Entradas owner="barbara" />} />
                  <Route path="/gastos/luan"         element={<GastosOwner owner="luan" />} />
                  <Route path="/gastos/barbara"      element={<GastosOwner owner="barbara" />} />
                  <Route path="/dividas/luan"        element={<DividasOwner owner="luan" />} />
                  <Route path="/dividas/barbara"     element={<DividasOwner owner="barbara" />} />
                  <Route path="/assinaturas"         element={<Assinaturas />} />
                  <Route path="/whatsapp"            element={<WhatsApp />} />
                  <Route path="/upload"              element={<UploadFatura />} />
                  <Route path="/configuracoes"       element={<Configuracoes />} />
                  <Route path="/lancamentos"         element={<Navigate to="/" replace />} />
                  <Route path="/gastos"              element={<Navigate to="/gastos/luan" replace />} />
                  <Route path="/dividas"             element={<Navigate to="/dividas/luan" replace />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
