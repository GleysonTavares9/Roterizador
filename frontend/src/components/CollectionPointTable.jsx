import React from 'react';
import { Table, Button, Spinner, Badge } from 'react-bootstrap';
import { FaEye, FaEdit, FaTrash } from 'react-icons/fa';

const CollectionPointTable = ({ 
    points, 
    onView, 
    onEdit, 
    onDelete, 
    deleteLoading 
}) => {
    // Função para formatar dias da semana
    const formatWeekDays = (days) => {
        if (!days) return '-';
        const dayMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return days.split(',').map(d => dayMap[parseInt(d)] || d).join(', ');
    };

    return (
        <div className="table-responsive">
            <Table striped hover className="align-middle">
                <thead className="table-light">
                    <tr>
                        <th>ID Externo</th>
                        <th>Nome</th>
                        <th>Endereço</th>
                        <th>Cidade/UF</th>
                        <th>Dias da Semana</th>
                        <th className="text-center">Status</th>
                        <th className="text-center">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {points.map((point) => (
                        <tr key={point.id}>
                            <td><Badge bg="light" text="dark">{point.external_id || 'N/A'}</Badge></td>
                            <td>{point.name}</td>
                            <td>{point.address}</td>
                            <td>{point.city}{point.state ? `/${point.state}` : ''}</td>
                            <td>{formatWeekDays(point.days_of_week)}</td>
                            <td className="text-center">
                                <Badge bg={point.is_active ? 'success' : 'secondary'}>
                                    {point.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                            </td>
                            <td className="text-center">
                                <Button variant="link" size="sm" onClick={() => onView(point.id)}><FaEye /></Button>
                                <Button variant="link" size="sm" onClick={() => onEdit(point.id)} className="text-warning"><FaEdit /></Button>
                                <Button variant="link" size="sm" onClick={() => onDelete(point.id)} className="text-danger" disabled={deleteLoading[point.id]}>
                                    {deleteLoading[point.id] ? <Spinner as="span" animation="border" size="sm" /> : <FaTrash />}
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </div>
    );
};

export default CollectionPointTable;
