import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Alert, Row, Col, Spinner, Form } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa';
import PageLayout from '../components/PageLayout';
import CollectionPointTable from '../components/CollectionPointTable';
import Pagination from '../components/Pagination';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import collectionPointService from '../services/collectionPointService';
import { toast } from 'react-toastify';

const CollectionPoints = () => {
    const navigate = useNavigate();
    const [points, setPoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    const loadPoints = useCallback(async () => {
        try {
            setLoading(true);
            const response = await collectionPointService.getAll({ compatibilidade: true });
            const items = Array.isArray(response) ? response : (response.items || []);
            setPoints(items);
        } catch (err) {
            setError('Não foi possível carregar os pontos de coleta. Tente novamente mais tarde.');
            toast.error('Erro ao carregar pontos de coleta.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPoints();
    }, [loadPoints]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredPoints = points.filter(point =>
        (point.name && point.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (point.address && point.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (point.city && point.city.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const paginatedPoints = filteredPoints.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredPoints.length / itemsPerPage);

    const handleDeleteClick = (id) => {
        setDeleteId(id);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        try {
            setDeleteLoading(true);
            setDeleteError(null);
            await collectionPointService.delete(deleteId);
            toast.success('Ponto de coleta excluído com sucesso!');
            setShowDeleteModal(false);
            loadPoints(); // Recarrega a lista
        } catch (err) {
            setDeleteError('Erro ao excluir o ponto de coleta.');
            toast.error('Erro ao excluir o ponto de coleta.');
        } finally {
            setDeleteLoading(false);
        }
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="text-center my-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2">Carregando...</p>
                </div>
            );
        }

        if (error) {
            return <Alert variant="danger">{error}</Alert>;
        }

        if (points.length === 0) {
            return (
                <Alert variant="info">
                    Nenhum ponto de coleta cadastrado ainda. <Link to="/collection-points/new">Crie o primeiro!</Link>
                </Alert>
            );
        }

        if (filteredPoints.length === 0) {
            return <Alert variant="info">Nenhum ponto de coleta encontrado para a busca realizada.</Alert>;
        }

        return (
            <>
                <CollectionPointTable 
                    points={paginatedPoints}
                    onView={(id) => navigate(`/collection-points/${id}`)}
                    onEdit={(id) => navigate(`/collection-points/edit/${id}`)}
                    onDelete={handleDeleteClick}
                    deleteLoading={{[deleteId]: deleteLoading}}
                />
                <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </>
        );
    };

    return (
        <PageLayout title="Pontos de Coleta">
            <Card>
                <Card.Body>
                    <Row className="mb-3">
                        <Col md={8}>
                            <Form.Control
                                type="text"
                                placeholder="Buscar por nome, endereço ou cidade..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                            />
                        </Col>
                        <Col md={4} className="text-end">
                            <Button as={Link} to="/collection-points/new" variant="primary">
                                <FaPlus className="me-1" /> Adicionar Ponto
                            </Button>
                        </Col>
                    </Row>
                    {renderContent()}
                </Card.Body>
            </Card>

            <DeleteConfirmationModal 
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleConfirmDelete}
                isLoading={deleteLoading}
                error={deleteError}
                itemName="ponto de coleta"
            />
        </PageLayout>
    );
};

export default CollectionPoints;
