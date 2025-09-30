import React from 'react';
import { Row, Col, Form, Button, InputGroup, Spinner, Badge } from 'react-bootstrap';
import { FaSearch, FaFilter, FaSync, FaMapMarkerAlt } from 'react-icons/fa';

const RouteFilter = ({ 
    searchTerm, 
    onSearchTermChange, 
    onFilter, 
    loading, 
    pointCount, 
    onTogglePoints, 
    showPoints 
}) => {
    return (
        <Card className="mb-3">
            <Card.Body className="p-3">
                <Row className="align-items-center">
                    <Col xs={12} md={6}>
                        <InputGroup>
                            <InputGroup.Text><FaSearch /></InputGroup.Text>
                            <Form.Control
                                type="text"
                                placeholder="Buscar por nome, endereço..."
                                value={searchTerm}
                                onChange={onSearchTermChange}
                                disabled={loading}
                            />
                            <Button variant="outline-secondary" onClick={onFilter} disabled={loading}>
                                <FaFilter className="me-1" />
                                Filtrar
                            </Button>
                        </InputGroup>
                    </Col>
                    <Col xs={12} md={6} className="mt-2 mt-md-0 d-flex justify-content-md-end align-items-center">
                        <Form.Check
                            type="switch"
                            id="toggle-points"
                            label={showPoints ? 'Ocultar Pontos' : 'Mostrar Pontos'}
                            checked={showPoints}
                            onChange={onTogglePoints}
                            className="me-3"
                        />
                        <Button variant="outline-primary" onClick={onFilter} disabled={loading} className="me-2">
                            <FaSync /> Atualizar
                        </Button>
                        <Badge bg="success" className="px-3 py-2">
                            {loading ? <Spinner animation="border" size="sm" /> : <FaMapMarkerAlt className="me-1" />}
                            {pointCount} {pointCount === 1 ? 'ponto' : 'pontos'}
                        </Badge>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
};

export default RouteFilter;
