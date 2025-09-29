import React from 'react';
import { Card, ListGroup, Badge } from 'react-bootstrap';
import PageLayout from '../components/PageLayout';

const About = () => {
  const appInfo = {
    name: 'Sistema de Roteirização',
    version: '1.0.0',
    description: 'Sistema para otimização de rotas de coleta de resíduos',
    technologies: [
      'React',
      'React Bootstrap',
      'Leaflet',
      'FastAPI',
      'SQLAlchemy',
      'SQLite',
    ],
    features: [
      'Otimização de rotas',
      'Gerenciamento de veículos',
      'Controle de pontos de coleta',
      'Perfis de cubagem',
      'Relatórios e exportação',
    ],
  };

  return (
    <PageLayout title="Sobre o Sistema">
      <div className="row">
        <div className="col-md-8">
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>{appInfo.name}</Card.Title>
              <Card.Subtitle className="mb-3 text-muted">
                Versão {appInfo.version}
              </Card.Subtitle>
              <Card.Text className="mb-4">
                {appInfo.description}
              </Card.Text>
              
              <h5 className="mb-3">Funcionalidades Principais</h5>
              <ul className="list-unstyled">
                {appInfo.features.map((feature, index) => (
                  <li key={index} className="mb-2">
                    <i className="bi bi-check-circle-fill text-success me-2"></i>
                    {feature}
                  </li>
                ))}
              </ul>
            </Card.Body>
          </Card>
          
          <Card className="mb-4">
            <Card.Body>
              <h5 className="mb-3">Tecnologias Utilizadas</h5>
              <div className="d-flex flex-wrap gap-2">
                {appInfo.technologies.map((tech, index) => (
                  <Badge key={index} bg="secondary" className="fs-6 p-2">
                    {tech}
                  </Badge>
                ))}
              </div>
            </Card.Body>
          </Card>
        </div>
        
        <div className="col-md-4">
          <Card>
            <Card.Body>
              <Card.Title>Suporte</Card.Title>
              <Card.Text>
                Em caso de dúvidas ou problemas, entre em contato com o suporte.
              </Card.Text>
              <ListGroup variant="flush">
                <ListGroup.Item>
                  <i className="bi bi-envelope me-2"></i>
                  suporte@empresa.com
                </ListGroup.Item>
                <ListGroup.Item>
                  <i className="bi bi-telephone me-2"></i>
                  (00) 1234-5678
                </ListGroup.Item>
                <ListGroup.Item>
                  <i className="bi bi-clock me-2"></i>
                  Seg-Sex: 9h às 18h
                </ListGroup.Item>
              </ListGroup>
            </Card.Body>
          </Card>
          
          <Card className="mt-4">
            <Card.Body>
              <Card.Title>Termos de Uso</Card.Title>
              <Card.Text className="small">
                Ao utilizar este sistema, você concorda com nossos termos de uso e política de privacidade.
              </Card.Text>
              <div className="d-flex gap-2">
                <a href="#" className="btn btn-sm btn-outline-primary">Termos de Uso</a>
                <a href="#" className="btn btn-sm btn-outline-secondary">Política de Privacidade</a>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default About;
