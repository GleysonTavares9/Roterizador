import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-light mt-5 py-3 border-top">
      <Container>
        <Row>
          <Col md={6} className="text-center text-md-start">
            <p className="mb-0">
              &copy; {currentYear} Sistema de Roteirização de Coleta
            </p>
          </Col>
          <Col md={6} className="text-center text-md-end">
            <p className="mb-0">
              Desenvolvido com React e Python
            </p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;
