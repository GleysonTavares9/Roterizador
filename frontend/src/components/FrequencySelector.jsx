import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Modal, ListGroup, InputGroup, FormControl, Row, Col } from 'react-bootstrap';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { groupOptionsByType, interpretFrequency } from '../utils/frequencyParser';

const FrequencySelector = ({ onSelect, value, disabled = false }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('TODOS');
  const [selectedFrequency, setSelectedFrequency] = useState(null);
  
  // Agrupa as opções por tipo
  const groupedOptions = groupOptionsByType();
  const allTypes = ['TODOS', ...Object.keys(groupedOptions)];
  
  // Filtra as opções com base no termo de busca e tipo selecionado
  const filteredOptions = Object.entries(groupedOptions).reduce((acc, [type, options]) => {
    if (selectedType !== 'TODOS' && selectedType !== type) return acc;
    
    const filtered = options.filter(opt => 
      opt.original.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (filtered.length > 0) {
      acc[type] = filtered;
    }
    
    return acc;
  }, {});
  
  // Atualiza a frequência selecionada quando o valor muda
  useEffect(() => {
    if (value) {
      // Se o valor for uma string, interpreta como uma linha de frequência
      if (typeof value === 'string') {
        const interpreted = interpretFrequency(value);
        setSelectedFrequency({
          ...interpreted,
          original: value
        });
      } 
      // Se for um objeto, assume que já está no formato correto
      else if (value.original) {
        setSelectedFrequency(value);
      }
    } else {
      setSelectedFrequency(null);
    }
  }, [value]);
  
  const handleSelect = useCallback((frequency) => {
    setSelectedFrequency(frequency);
    onSelect(frequency);
    setShowModal(false);
  }, [onSelect]);
  
  const handleClear = useCallback(() => {
    setSelectedFrequency(null);
    onSelect(null);
  }, [onSelect]);
  
  return (
    <>
      <InputGroup>
        <FormControl
          type="text"
          value={selectedFrequency ? selectedFrequency.original : ''}
          placeholder="Selecione a frequência"
          readOnly
          disabled={disabled}
        />
        {selectedFrequency && !disabled && (
          <Button
            variant="outline-secondary"
            onClick={handleClear}
            disabled={disabled}
          >
            <FaTimes />
          </Button>
        )}
        <Button
          variant="outline-primary"
          onClick={() => setShowModal(true)}
          disabled={disabled}
        >
          Selecionar
        </Button>
      </InputGroup>
      
      <Modal 
        show={showModal} 
        onHide={() => setShowModal(false)}
        size="lg"
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>Selecionar Frequência</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ minHeight: '400px' }}>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Filtrar por tipo:</Form.Label>
                <Form.Select 
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  {allTypes.map(type => (
                    <option key={type} value={type}>
                      {type === 'TODOS' ? 'Todos os Tipos' : type}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Buscar:</Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <FormControl
                    type="text"
                    placeholder="Digite para buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <Button 
                      variant="outline-secondary" 
                      onClick={() => setSearchTerm('')}
                    >
                      <FaTimes />
                    </Button>
                  )}
                </InputGroup>
              </Form.Group>
            </Col>
          </Row>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {Object.entries(filteredOptions).map(([type, options]) => (
              <div key={type} className="mb-4">
                <h5 className="border-bottom pb-1">{type}</h5>
                <ListGroup variant="flush">
                  {options.map((opt) => (
                    <ListGroup.Item 
                      key={opt.original}
                      action
                      active={selectedFrequency?.original === opt.original}
                      onClick={() => handleSelect(opt)}
                      className="d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <strong>{opt.code}</strong> - {opt.description}
                        <div className="small text-muted">
                          {opt.weekDays.length > 0 && (
                            <span>Dias: {opt.weekDays.join(', ')}</span>
                          )}
                          {opt.weekOfMonth.length > 0 && (
                            <span className="ms-2">Semanas: {opt.weekOfMonth.map(w => w === 'U' ? 'Última' : `${w}ª`).join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            ))}
            
            {Object.keys(filteredOptions).length === 0 && (
              <div className="text-center text-muted py-4">
                Nenhuma frequência encontrada com os filtros atuais.
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default FrequencySelector;
