import React from 'react';
import { Modal, Button, Spinner, Alert } from 'react-bootstrap';

const DeleteConfirmationModal = ({ 
    show, 
    onHide, 
    onConfirm, 
    isLoading, 
    error, 
    itemName = 'item' 
}) => {
    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>Confirmar Exclusão</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <p>Tem certeza que deseja excluir este {itemName}?</p>
                <p>Esta ação não pode ser desfeita.</p>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={isLoading}>
                    Cancelar
                </Button>
                <Button variant="danger" onClick={onConfirm} disabled={isLoading}>
                    {isLoading ? (
                        <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Excluindo...</>
                    ) : 'Excluir'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default DeleteConfirmationModal;
