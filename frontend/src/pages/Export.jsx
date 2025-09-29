import React, { useState } from 'react';
import { Card, Form, Button, Alert, Row, Col, Spinner } from 'react-bootstrap';
import PageLayout from '../components/PageLayout';
import api from '../services/api';
import { saveAs } from 'file-saver';

const Export = () => {
  const [format, setFormat] = useState('excel');
  const [dataType, setDataType] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsExporting(true);
    setExportSuccess(false);
    
    try {
      // Configura o tipo de resposta como blob para lidar com arquivos
      const response = await api.get(`/export/${dataType}`, {
        responseType: 'blob',
        params: {
          format: format
        }
      });
      
      console.log('Resposta da API recebida:', response);
      
      // Determina a extensão do arquivo com base no formato
      const extension = format === 'csv' ? 'csv' : format === 'pdf' ? 'pdf' : 'xlsx';
      
      // Cria o nome do arquivo com base no tipo de dados e data atual
      const date = new Date().toISOString().split('T')[0];
      const filename = `export_${dataType}_${date}.${extension}`;
      
      // Usa o file-saver para baixar o arquivo
      saveAs(new Blob([response.data]), filename);
      
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      alert('Erro ao exportar dados. Verifique o console para mais detalhes.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageLayout title="Exportar Dados">
      <Row className="justify-content-center">
        <Col md={8}>
          <Card>
            <Card.Body>
              <Card.Title>Exportar Dados</Card.Title>
              
              {exportSuccess && (
                <Alert variant="success" className="mt-3">
                  Dados exportados com sucesso!
                </Alert>
              )}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Formato de Exportação</Form.Label>
                  <Form.Select 
                    value={format} 
                    onChange={(e) => setFormat(e.target.value)}
                  >
                    <option value="excel">Excel (.xlsx)</option>
                    <option value="csv">CSV (.csv)</option>
                    <option value="pdf">PDF (.pdf)</option>
                  </Form.Select>
                </Form.Group>
                
                <Form.Group className="mb-4">
                  <Form.Label>Dados para Exportar</Form.Label>
                  <Form.Select 
                    value={dataType}
                    onChange={(e) => setDataType(e.target.value)}
                  >
                    <option value="all">Todos os Dados</option>
                    <option value="vehicles">Veículos</option>
                    <option value="collection-points">Pontos de Coleta</option>
                    <option value="routes">Rotas</option>
                    <option value="cubage-profiles">Perfis de Cubagem</option>
                    <option value="users">Usuários</option>

                  </Form.Select>
                </Form.Group>
                
                <div className="d-flex justify-content-end">
                  <Button 
                    type="submit" 
                    variant="primary" 
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Exportando...
                      </>
                    ) : 'Exportar'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </PageLayout>
  );
};

export default Export;
