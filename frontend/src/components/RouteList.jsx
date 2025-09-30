import React from 'react';
import { ListGroup, Badge } from 'react-bootstrap';

const RouteList = ({ routes, selectedRoute, onSelectRoute, getRouteColor }) => {
    const formatDistance = (meters) => {
        if (!meters && meters !== 0) return '0m';
        if (meters < 1000) return `${Math.round(meters)}m`;
        return `${(meters / 1000).toFixed(1)} km`;
    };

    return (
        <ListGroup className="mb-4">
            {routes.map((route, index) => (
                <ListGroup.Item 
                    key={route.id || index}
                    action
                    active={selectedRoute?.id === route.id}
                    onClick={() => onSelectRoute(route)}
                    className="d-flex justify-content-between align-items-start"
                >
                    <div className="ms-2 me-auto">
                        <div className="fw-bold">{route.vehicle || `Rota ${index + 1}`}</div>
                        <small>
                            {route.stops?.length - 1} paradas • {formatDistance(route.distance || 0)}
                        </small>
                    </div>
                    <Badge bg={getRouteColor(index)} pill>
                        {index + 1}
                    </Badge>
                </ListGroup.Item>
            ))}
        </ListGroup>
    );
};

export default RouteList;
