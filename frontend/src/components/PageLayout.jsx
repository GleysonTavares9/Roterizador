import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

const PageLayout = ({ title, children, className = '', headerActions }) => {
  return (
    <Container className={`py-4 ${className}`}>
      <Row className="mb-4">
        <Col>
          {typeof title === 'string' ? <h1 className="mb-0">{title}</h1> : title}
        </Col>
        {headerActions && (
          <Col xs="auto">
            {headerActions}
          </Col>
        )}
      </Row>
      {children}
    </Container>
  );
};

export default PageLayout;
