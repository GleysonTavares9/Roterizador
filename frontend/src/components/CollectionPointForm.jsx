import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import collectionPointService from '../services/collectionPointService';
import { toast } from 'react-toastify';

const CollectionPointForm = ({ pointId }) => {
    const navigate = useNavigate();
    const isEditing = !!pointId;

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        latitude: '',
        longitude: '',
        days_of_week: '',
        is_active: true
    });
    const [loading, setLoading] = useState(isEditing);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [formErrors, setFormErrors] = useState({});

    useEffect(() => {
        if (isEditing) {
            const fetchPoint = async () => {
                try {
                    const data = await collectionPointService.getById(pointId);
                    setFormData(data);
                } catch (err) {
                    setError('Falha ao carregar os dados do ponto de coleta.');
                    toast.error('Erro ao carregar dados.');
                } finally {
                    setLoading(false);
                }
            };
            fetchPoint();
        }
    }, [pointId, isEditing]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.name) errors.name = 'Nome é obrigatório';
        if (!formData.address) errors.address = 'Endereço é obrigatório';
        if (!formData.city) errors.city = 'Cidade é obrigatória';
        if (!formData.state) errors.state = 'Estado é obrigatório';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setSubmitting(true);
            if (isEditing) {
                await collectionPointService.update(pointId, formData);
                toast.success('Ponto de coleta atualizado com sucesso!');
            } else {
                await collectionPointService.create(formData);
                toast.success('Ponto de coleta criado com sucesso!');
            }
            navigate('/collection-points');
        } catch (err) {
            toast.error('Erro ao salvar ponto de coleta.');
        } finally {
            setSubmitting(false);
        }
    };
    
    if (loading) return <Spinner animation="border" />;
    if (error) return <Alert variant="danger">{error}</Alert>;

    return (
        <Form onSubmit={handleSubmit}>
            {/* Adicione os campos do formulário aqui, similar ao que estava em CollectionPoints.jsx */}
            <Row>
                <Col md={6}><Form.Group className="mb-3"><Form.Label>Nome</Form.Label><Form.Control type="text" name="name" value={formData.name} onChange={handleInputChange} isInvalid={!!formErrors.name} /></Form.Group></Col>
                <Col md={6}><Form.Group className="mb-3"><Form.Label>Endereço</Form.Label><Form.Control type="text" name="address" value={formData.address} onChange={handleInputChange} isInvalid={!!formErrors.address} /></Form.Group></Col>
                <Col md={6}><Form.Group className="mb-3"><Form.Label>Cidade</Form.Label><Form.Control type="text" name="city" value={formData.city} onChange={handleInputChange} isInvalid={!!formErrors.city} /></Form.Group></Col>
                <Col md={6}><Form.Group className="mb-3"><Form.Label>Estado</Form.Label><Form.Control type="text" name="state" value={formData.state} onChange={handleInputChange} isInvalid={!!formErrors.state} /></Form.Group></Col>
                 <Col md={6}><Form.Group className="mb-3"><Form.Label>CEP</Form.Label><Form.Control type="text" name="zip_code" value={formData.zip_code} onChange={handleInputChange} /></Form.Group></Col>
                <Col md={6}><Form.Group className="mb-3"><Form.Label>Latitude</Form.Label><Form.Control type="text" name="latitude" value={formData.latitude} onChange={handleInputChange} /></Form.Group></Col>
                 <Col md={6}><Form.Group className="mb-3"><Form.Label>Longitude</Form.Label><Form.Control type="text" name="longitude" value={formData.longitude} onChange={handleInputChange} /></Form.Group></Col>
                 <Col md={6}><Form.Group className="mb-3"><Form.Label>Dias da Semana</Form.Label><Form.Control type="text" name="days_of_week" value={formData.days_of_week} onChange={handleInputChange} /></Form.Group></Col>
                 <Col md={12}><Form.Check type="switch" id="is_active" label="Ativo" name="is_active" checked={formData.is_active} onChange={handleInputChange} /></Col>
            </Row>
            <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? <Spinner as="span" size="sm" /> : 'Salvar'}
            </Button>
        </Form>
    );
};

export default CollectionPointForm;
