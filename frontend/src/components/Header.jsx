import { Navbar, Nav, Container, NavDropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/">Sistema de Roteirização</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">Início</Nav.Link>
            <Nav.Link as={Link} to="/upload">Carregar Dados</Nav.Link>
            <Nav.Link as={Link} to="/routes">Visualizar Rotas</Nav.Link>
            
            <NavDropdown title="Cadastros" id="basic-nav-dropdown">
              <NavDropdown.Item as={Link} to="/vehicles">Veículos</NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/cubage-profiles">Perfis de Cubagem</NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/collection-points">Pontos de Coleta</NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item as={Link} to="/reports">Relatórios</NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/export">Exportar Dados</NavDropdown.Item>
            </NavDropdown>

            <NavDropdown title="Configurações" id="settings-nav-dropdown">
              <NavDropdown.Item as={Link} to="/settings">Configurações</NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/about">Sobre</NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

// Helper function to get page title based on path
const getPageTitle = (pathname) => {
  const path = pathname.split('/')[1];
  const titles = {
    '': 'Dashboard',
    'upload': 'Carregar Dados',
    'geocode-upload': 'Geocodificar Dados',
    'routes': 'Visualizar Rotas',
    'vehicles': 'Veículos',
    'cubage-profiles': 'Perfis de Cubagem',
    'collection-points': 'Pontos de Coleta',
    'reports': 'Relatórios',
    'export': 'Exportar Dados',
    'settings': 'Configurações',
    'about': 'Sobre',
    'profile': 'Meu Perfil'
  };

  return titles[path] || 'Dashboard';
};

export default Header;
