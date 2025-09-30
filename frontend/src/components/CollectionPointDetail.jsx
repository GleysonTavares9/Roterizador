import React, { useState, useEffect } from 'react';
import { Card, Button, Row, Col, Spinner, Alert, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaEdit } from 'react-icons/fa';
import collectionPointService from '../services/collectionPointService';

const CollectionPointDetail = ({ pointId }) => {
    const navigate = useNavigate();
    const [point, setPoint] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPoint = async () => {
            try {
                const data = await collectionPointService.getById(pointId);
                setPoint(data);
            } catch (err) {
                setError('Falha ao carregar os detalhes do ponto de coleta.');
            } finally {
                setLoading(false);
            }
        };
        fetchPoint();
    }, [pointId]);

    if (loading) return <Spinner animation="border" />;
    if (error) return <Alert variant="danger">{error}</Alert>;
    if (!point) return <Alert variant="warning">Ponto de coleta não encontrado.</Alert>;

    return (
        <Card>
            <Card.Header>
                <Button variant="link" onClick={() => navigate('/collection-points')} className="p-0 me-3">
                    <FaArrowLeft /> Voltar
                </Button>
                Detalhes do Ponto de Coleta
            </Card.Header>
            <Card.Body>
                <Row>
                    <Col md={6}>
                        <h5>{point.name}</h5>
                        <p><strong>Endereço:</strong> {point.address}</p>
                        <p><strong>Cidade/UF:</strong> {point.city}/{point.state}</p>
                        <p><strong>CEP:</strong> {point.zip_code}</p>
                    </Col>
                    <Col md={6}>
                        <p><strong>Status:</strong> <Badge bg={point.is_active ? 'success' : 'secondary'}>{point.is_active ? 'Ativo' : 'Inativo'}</Badge></p>
                        <p><strong>Dias de Coleta:</strong> {point.days_of_week}</p>
                    </Col>
                </Row>
                <div className="mt-3">
                    <Button variant="primary" onClick={() => navigate(`/collection-points/edit/${pointId}`)}>
                        <FaEdit /> Editar
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
};

export default CollectionPointDetail;
