import React, { useState, useEffect } from 'react';
import { Offcanvas } from 'react-bootstrap';
import { useLocation, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaBars } from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import '../styles/protected-layout.css';
import '../styles/page-styles.css';

const ProtectedLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isMobile = window.innerWidth < 992;

  // Fecha a sidebar quando a rota muda em dispositivos móveis
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Alterna a visibilidade da sidebar
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  // Efeito para adicionar/remover a classe no body quando a sidebar está aberta
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
    
    return () => {
      document.body.classList.remove('sidebar-open');
    };
  }, [sidebarOpen]);

  // Verifica se a rota atual é a de geolocalização
  const isGeocodePage = location.pathname.includes('geocode');

  return (
    <div className="protected-layout">
      {/* Botão de menu móvel */}
      <button 
        className="mobile-menu-button d-lg-none"
        onClick={toggleSidebar}
        aria-label="Abrir menu"
      >
        <FaBars size={20} />
      </button>

      {/* Sidebar */}
      <Offcanvas 
        show={sidebarOpen} 
        onHide={() => setSidebarOpen(false)}
        className="sidebar-offcanvas"
        responsive="lg"
        placement="start"
        backdrop={true}
        scroll={true}
      >
        <Offcanvas.Body className="p-0">
          <Sidebar />
        </Offcanvas.Body>
      </Offcanvas>

      {/* Área de Conteúdo Principal */}
      <main className="main-content">
        <div className={`content-container ${isGeocodePage ? 'geocode-page' : ''}`}>
          <Outlet />
        </div>
      </main>

      {/* Toast Notifications */}
      <ToastContainer 
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export default ProtectedLayout;
