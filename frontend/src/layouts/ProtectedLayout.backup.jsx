import React, { useState, useEffect } from 'react';
import { Container, Offcanvas } from 'react-bootstrap';
import { useLocation, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaBars, FaTimes } from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import '../styles/protected-layout.css';

const ProtectedLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isMobile = window.innerWidth < 992; // Bootstrap's lg breakpoint

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Toggle sidebar
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="protected-layout d-flex">
      {/* Desktop Sidebar - Always visible on large screens */}
      <div className="d-none d-lg-block sidebar-container">
        <Sidebar />
      </div>

      {/* Mobile Offcanvas Sidebar */}
      <Offcanvas 
        show={sidebarOpen} 
        onHide={() => setSidebarOpen(false)}
        className="d-lg-none"
        responsive="lg"
        placement="start"
      >
        <Offcanvas.Header closeButton closeVariant="white" className="bg-primary text-white">
          <Offcanvas.Title>Menu</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          <Sidebar />
        </Offcanvas.Body>
      </Offcanvas>

      {/* Main Content Area */}
      <div className="main-content flex-grow-1 d-flex flex-column">
        {/* Header with mobile menu toggle */}
        <header className="bg-white border-bottom">
          <div className="d-flex align-items-center px-3 py-2">
            <button 
              className="btn btn-link text-dark d-lg-none me-2 p-2"
              onClick={toggleSidebar}
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
            </button>
            <Header />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-grow-1 p-3 p-md-4 overflow-auto">
          <Container fluid className="h-100">
            <Outlet />
          </Container>
        </main>

        {/* Footer */}
        <footer className="bg-light border-top py-3">
          <Container fluid className="text-center text-muted small">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center">
              <div className="mb-2 mb-md-0">
                Sistema de Roteirização &copy; {new Date().getFullYear()}
              </div>
              <div className="d-flex">
                <span className="d-none d-md-inline me-3">v{process.env.REACT_APP_VERSION || '1.0.0'}</span>
                <a href="#" className="text-muted text-decoration-none me-3">Ajuda</a>
                <a href="#" className="text-muted text-decoration-none">Suporte</a>
              </div>
            </div>
          </Container>
        </footer>
      </div>

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
