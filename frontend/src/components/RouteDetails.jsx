import React from 'react';
import { Card, ListGroup, Badge, Alert } from 'react-bootstrap';
import { FaTruck } from 'react-icons/fa';

const RouteDetails = ({ route, color }) => {
    if (!route) {
        return (
            <Alert variant="info">
                Selecione uma rota para ver os detalhes.
            </Alert>
        );
    }

    const formatDistance = (meters) => {
        if (!meters && meters !== 0) return '0m';
        if (meters < 1000) return `${Math.round(meters)}m`;
        return `${(meters / 1000).toFixed(1)} km`;
    };

    return (
        <Card>
            <Card.Header 
                className="d-flex justify-content-between align-items-center"
                style={{ backgroundColor: color, color: 'white' }}
            >
                <div><FaTruck className="me-2" />{route.vehicle || 'Rota'}</div>
                <div>
                    <Badge bg="light" text="dark" className="me-2">{formatDistance(route.distance || 0)}</Badge>
                    <Badge bg="light" text="dark">{route.stops?.length - 1 || 0} paradas</Badge>
                </div>
            </Card.Header>
            <Card.Body>
                <ListGroup variant="flush">
                    {route.stops?.map((stop, idx) => (
                        <ListGroup.Item key={idx}>
                            <div className="d-flex w-100 justify-content-between">
                                <h6 className="mb-1">{stop.name || (idx === 0 ? 'Depósito' : `Parada ${idx}`)}</h6>
                                <small>{stop.time || ''}</small>
                            </div>
                            <p className="mb-1">{stop.address || ''}</p>
                            <small className="text-muted">{stop.city} {stop.state ? `- ${stop.state}` : ''}</small>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            </Card.Body>
        </Card>
    );
};

export default RouteDetails;
