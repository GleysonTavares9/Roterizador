import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Spinner, Alert, Button, Row, Col, Tab, Tabs } from 'react-bootstrap';
import { FaRoute, FaPlus } from 'react-icons/fa';

import PageLayout from '../components/PageLayout';
import RouteMap from '../components/RouteMap';
import RouteFilter from '../components/RouteFilter';
import RouteList from '../components/RouteList';
import RouteDetails from '../components/RouteDetails';

import routeService from '../services/routeService';
import collectionPointService from '../services/collectionPointService';
import { toast } from 'react-toastify';

const RoutesPage = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [routes, setRoutes] = useState([]);
    const [activePoints, setActivePoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedRoute, setSelectedRoute] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [showActivePoints, setShowActivePoints] = useState(true);
    const [activeTab, setActiveTab] = useState('map');

    const loadInitialData = useCallback(async () => {
        try {
            setLoading(true);
            const points = await collectionPointService.getAll({ status: 'active', include_details: true });
            setActivePoints(formatPoints(points));

            const requestId = new URLSearchParams(location.search).get('request_id');
            if (requestId) {
                const status = await routeService.getOptimizationStatus(requestId);
                if (status.status === 'completed' && status.result) {
                    setRoutes(status.result.routes || []);
                }
            } else if (location.state?.optimizedRoute) {
                setRoutes(location.state.optimizedRoute.routes || []);
                navigate(location.pathname, { replace: true });
            }
        } catch (err) {
            setError('Falha ao carregar dados iniciais.');
            toast.error('Erro ao carregar dados.');
        } finally {
            setLoading(false);
        }
    }, [location, navigate]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    const formatPoints = (points) => {
        return points.filter(p => p.latitude && p.longitude).map(p => ({ ...p, lat: p.latitude, lng: p.longitude }));
    };

    const filteredActivePoints = useMemo(() => {
        if (!showActivePoints) return [];
        return activePoints.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.address.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [activePoints, searchTerm, showActivePoints]);

    const { markers, polylines } = useMemo(() => {
        const routeData = processRoutesForMap(routes);
        const pointMarkers = filteredActivePoints.map(p => ({ position: [p.lat, p.lng], popup: { title: p.name } }));
        return { markers: [...routeData.markers, ...pointMarkers], polylines: routeData.polylines };
    }, [routes, filteredActivePoints]);

    const processRoutesForMap = (routes) => {
        const markers = [], polylines = [];
        routes.forEach((route, index) => {
            const color = getRouteColor(index);
            const routePoints = route.stops.map(s => [s.lat, s.lng]);
            polylines.push({ positions: routePoints, color });
            route.stops.forEach((stop, stopIndex) => {
                markers.push({ position: [stop.lat, stop.lng], popup: { title: stop.name }, markerConfig: { color, sequence: stopIndex + 1 } });
            });
        });
        return { markers, polylines };
    };

    const getRouteColor = (index) => {
        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#e67e22'];
        return colors[index % colors.length];
    };

    const handleFilter = async () => {
        try {
            setLoading(true);
            const points = await collectionPointService.getAll({ status: 'active', include_details: true });
            setActivePoints(formatPoints(points));
        } catch (err) {
            toast.error('Erro ao atualizar pontos.');
        } finally {
            setLoading(false);
        }
    };

    if (error) return <Alert variant="danger">{error}</Alert>;

    return (
        <PageLayout title="Rotas de Coleta">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0"><FaRoute className="me-2" />Rotas de Coleta</h2>
                <Button variant="primary" onClick={() => navigate('/collection-points')}><FaPlus className="me-1" /> Nova Rota</Button>
            </div>

            {loading && !routes.length ? (
                <div className="text-center"><Spinner animation="border" /> <p>Carregando...</p></div>
            ) : (
                <>
                    <RouteFilter 
                        searchTerm={searchTerm} 
                        onSearchTermChange={(e) => setSearchTerm(e.target.value)} 
                        onFilter={handleFilter}
                        loading={loading}
                        pointCount={filteredActivePoints.length}
                        onTogglePoints={() => setShowActivePoints(!showActivePoints)}
                        showPoints={showActivePoints}
                    />
                    <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
                        <Tab eventKey="map" title="Mapa">
                            <Card style={{ height: '600px', width: '100%' }}>
                                <RouteMap markers={markers} polylines={polylines} center={[-23.5505, -46.6333]} zoom={12} />
                            </Card>
                        </Tab>
                        <Tab eventKey="list" title={`Lista de Rotas (${routes.length})`}>
                            <Row>
                                <Col md={4}>
                                    <RouteList 
                                        routes={routes} 
                                        selectedRoute={selectedRoute}
                                        onSelectRoute={setSelectedRoute}
                                        getRouteColor={getRouteColor}
                                    />
                                </Col>
                                <Col md={8}>
                                    <RouteDetails 
                                        route={selectedRoute} 
                                        color={getRouteColor(routes.findIndex(r => r.id === selectedRoute?.id))}
                                    />
                                </Col>
                            </Row>
                        </Tab>
                    </Tabs>
                </>
            )}
        </PageLayout>
    );
};

export default RoutesPage;
