import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'leaflet/dist/leaflet.css';
import './styles/layout.css';
import './styles/buttons.css';
import './styles/public-layout.css';
// Sidebar removida daqui pois já está sendo usada no ProtectedLayout
import Home from './pages/Home';
import Upload from './pages/Upload';
import GeocodeUploadPage from './pages/GeocodeUploadPage';
import RoutesPage from './pages/Routes';
import Vehicles from './pages/Vehicles';
import CubageProfiles from './pages/CubageProfiles';
import CollectionPoints from './pages/CollectionPoints';
import CollectionPointsCalendar from './pages/CollectionPointsCalendar';
import CollectionPointsMapPage from './pages/CollectionPointsMapPage';
import Reports from './pages/Reports';
import Export from './pages/Export';
import Settings from './pages/Settings';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedLayout from './layouts/ProtectedLayout';

// Componente para rotas protegidas
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [initialCheck, setInitialCheck] = useState(true);
  
  console.log('ProtectedRoute - isAuthenticated:', isAuthenticated, 'loading:', loading, 'path:', location.pathname);

  // Efeito para verificar se a verificação inicial já foi feita
  useEffect(() => {
    if (!loading) {
      setInitialCheck(false);
    }
  }, [loading]);

  // Se ainda estiver verificando a autenticação, mostra um spinner
  if (loading || initialCheck) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  // Se não estiver autenticado, redireciona para a página de login com a rota de origem
  if (!isAuthenticated) {
    // Evita redirecionamento em loop verificando se já estamos na página de login
    if (location.pathname !== '/login') {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return null;
  }

  // Se estiver autenticado, renderiza o conteúdo diretamente
  // O ProtectedLayout será aplicado nas rotas protegidas
  return children;
};

// Componente para rotas públicas
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [initialCheck, setInitialCheck] = useState(true);
  const from = location.state?.from?.pathname || '/';

  // Efeito para verificar se a verificação inicial já foi feita
  useEffect(() => {
    if (!loading) {
      setInitialCheck(false);
    }
  }, [loading]);

  // Se ainda estiver verificando a autenticação, mostra um spinner
  if (loading || initialCheck) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  // Se o usuário já estiver autenticado, redireciona para a página inicial ou para a rota de origem
  if (isAuthenticated) {
    // Evita redirecionamento em loop verificando se já estamos na página de destino
    if (location.pathname === '/login' || location.pathname === '/') {
      return <Navigate to={from} replace state={{ from: location }} />;
    }
    return <Navigate to={from} replace state={{ from: location }} />;
  }
  
  // Se não estiver autenticado, renderiza o conteúdo dentro do PublicLayout
  return (
    <PublicLayout>
      {children}
    </PublicLayout>
  );
};

// Configuração dos future flags do React Router
const routerConfig = {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    v7_partialHydration: true
  }
};

// Layout component for public routes
const PublicLayout = ({ children }) => (
  <div className="public-layout">
    {children}
    <ToastContainer />
  </div>
);

// Removido o componente ProtectedLayout local, pois estamos importando do diretório layouts

// Main App Content
function AppContent() {
  // Configura o tema escuro/claro com base nas preferências do usuário
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
  }, []);

  return (
    <div className="app-container">
      <Routes>
        {/* Rotas Públicas */}
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } />
        <Route path="/forgot-password" element={
          <PublicRoute>
            <div>Recuperação de Senha</div>
          </PublicRoute>
        } />
        <Route path="/reset-password/:token" element={
          <PublicRoute>
            <div>Redefinir Senha</div>
          </PublicRoute>
        } />

        {/* Rotas Protegidas */}
        <Route element={
          <ProtectedRoute>
            <ProtectedLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Home />} />
          <Route path="/" element={<Home />} />
          
          {/* Upload e Processamento */}
          <Route path="/upload" element={<Upload />} />
          <Route path="/geocode-upload" element={<GeocodeUploadPage />} />
          
          {/* Rotas */}
          <Route path="/routes" element={<RoutesPage />} />
          
          {/* Gestão de Veículos */}
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/vehicles/new" element={<Vehicles isNew />} />
          <Route path="/vehicles/edit/:id" element={<Vehicles isEdit />} />
          
          {/* Perfis de Cubagem */}
          <Route path="/cubage-profiles" element={<CubageProfiles />} />
          <Route path="/cubage-profiles/new" element={<CubageProfiles isNew />} />
          <Route path="/cubage-profiles/edit/:id" element={<CubageProfiles isEdit />} />
          
          {/* Pontos de Coleta */}
          <Route path="/collection-points" element={<CollectionPoints />} />
          <Route path="/collection-points/calendar" element={<CollectionPointsCalendar />} />
          <Route path="/collection-points/map" element={<CollectionPointsMapPage />} />
          <Route path="/collection-points/new" element={<CollectionPoints isNew />} />
          <Route path="/collection-points/edit/:id" element={<CollectionPoints isEdit />} />
          <Route path="/collection-points/:id" element={<CollectionPoints />} />
          
          {/* Relatórios e Exportação */}
          <Route path="/reports" element={<Reports />} />
          <Route path="/export" element={<Export />} />
          
          {/* Configurações e Sobre */}
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          
          {/* Perfil do Usuário */}
          <Route path="/profile" element={<div>Perfil do Usuário</div>} />
          <Route path="/change-password" element={<div>Alterar Senha</div>} />
        </Route>
        
        {/* Rota de fallback - redireciona para a página inicial */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

// Main App component that wraps everything with Router and AuthProvider
function App() {
  return (
    <Router future={routerConfig.future}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
