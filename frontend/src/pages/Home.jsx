import { Card, Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="text-center">
      <h1 className="mb-4">Bem-vindo ao Sistema de Roteirização</h1>
      <p className="lead mb-5">
        Sistema para otimização de rotas de coleta de resíduos
      </p>
      
      <div className="d-flex justify-content-center gap-4">
        <Card style={{ width: '18rem' }} className="mb-4">
          <Card.Body>
            <Card.Title>Carregar Dados</Card.Title>
            <Card.Text>
              Faça upload dos arquivos de pontos de coleta e veículos.
            </Card.Text>
            <Button as={Link} to="/upload" variant="primary">
              Acessar
            </Button>
          </Card.Body>
        </Card>

        <Card style={{ width: '18rem' }} className="mb-4">
          <Card.Body>
            <Card.Title>Visualizar Rotas</Card.Title>
            <Card.Text>
              Visualize as rotas otimizadas no mapa interativo.
            </Card.Text>
            <Button as={Link} to="/routes" variant="success">
              Visualizar
            </Button>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
};

export default Home;
