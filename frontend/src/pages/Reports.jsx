import React, { useState } from 'react';
import { Card, Button, Row, Col, Form, Spinner, Alert, Modal } from 'react-bootstrap';
import { FaFilePdf, FaFileExcel, FaFileCsv, FaCalendarAlt } from 'react-icons/fa';
import PageLayout from '../components/PageLayout';
import reportService from '../services/reportService';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const Reports = () => {
  const [showModal, setShowModal] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [format, setFormat] = useState('excel');

  const reportConfigs = {
    routes: {
      title: 'Relatório de Rotas',
      description: 'Visualize relatórios detalhados sobre as rotas otimizadas.',
      icon: <FaFileExcel className="me-2" />,
      generate: reportService.generateRouteReport
    },
    vehicles: {
      title: 'Desempenho de Veículos',
      description: 'Acompanhe o desempenho e a utilização dos veículos.',
      icon: <FaFilePdf className="me-2" />,
      generate: reportService.generateVehiclePerformanceReport
    },
    collections: {
      title: 'Histórico de Coletas',
      description: 'Consulte o histórico de coletas por período.',
      icon: <FaFileCsv className="me-2" />,
      generate: reportService.generateCollectionHistoryReport
    }
  };

  const handleOpenModal = (reportType) => {
    setCurrentReport(reportType);
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCurrentReport(null);
    setDateRange([null, null]);
    setError('');
    setSuccess('');
  };

  const handleGenerateReport = async () => {
    if (!currentReport) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      console.log('Iniciando geração de relatório:', {
        type: currentReport,
        format,
        startDate,
        endDate: endDate || new Date()
      });
      
      const result = await reportConfigs[currentReport].generate(
        format,
        startDate,
        endDate || new Date()
      );
      
      console.log('Relatório gerado com sucesso:', result);
      
      if (format === 'json') {
        setSuccess('Dados do relatório carregados com sucesso!');
        // Aqui você pode adicionar lógica para exibir os dados JSON, se necessário
      } else {
        setSuccess(`Relatório baixado com sucesso!`);
      }
      
      setTimeout(() => {
        handleCloseModal();
      }, 2000);
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      const errorMessage = err.message || 'Erro ao gerar o relatório. Por favor, tente novamente.';
      setError(errorMessage);
      
      // Se for um erro de rede, sugerir verificar a conexão
      if (err.message && err.message.includes('Network Error')) {
        setError('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout title="Relatórios">
      {error && (
        <Alert 
          variant="danger" 
          onClose={() => setError('')} 
          dismissible
          className="mb-4"
        >
          <strong>Erro:</strong> {error}
        </Alert>
      )}
      {success && (
        <Alert 
          variant="success" 
          onClose={() => setSuccess('')} 
          dismissible
          className="mb-4"
        >
          {success}
        </Alert>
      )}
      
      <Row className="g-4">
        {Object.entries(reportConfigs).map(([key, config]) => (
          <Col key={key} md={6} lg={4}>
            <Card className="h-100">
              <Card.Body className="d-flex flex-column">
                <Card.Title>{config.title}</Card.Title>
                <Card.Text className="flex-grow-1">
                  {config.description}
                </Card.Text>
                <div className="d-grid">
                  <Button 
                    variant="primary" 
                    onClick={() => handleOpenModal(key)}
                    disabled={loading}
                  >
                    {loading && currentReport === key ? (
                      <>
                        <Spinner as="span" size="sm" animation="border" role="status" aria-hidden="true" className="me-2" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        {config.icon}
                        Gerar Relatório
                      </>
                    )}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Modal de Configuração do Relatório */}
      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>
            {currentReport && reportConfigs[currentReport]?.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Período</Form.Label>
              <div className="d-flex align-items-center">
                <FaCalendarAlt className="me-2" />
                <DatePicker
                  selectsRange={true}
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(update) => setDateRange(update)}
                  isClearable={true}
                  className="form-control"
                  placeholderText="Selecione um período"
                  dateFormat="dd/MM/yyyy"
                />
              </div>
              <Form.Text className="text-muted">
                Deixe em branco para todo o período disponível.
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Formato</Form.Label>
              <div className="d-flex gap-3">
                <Form.Check
                  type="radio"
                  id="excel-format"
                  label={
                    <span className="d-flex align-items-center">
                      <FaFileExcel className="me-2 text-success" />
                      Excel (.xlsx)
                    </span>
                  }
                  name="format"
                  value="excel"
                  checked={format === 'excel'}
                  onChange={() => setFormat('excel')}
                />
                <Form.Check
                  type="radio"
                  id="csv-format"
                  label={
                    <span className="d-flex align-items-center">
                      <FaFileCsv className="me-2 text-primary" />
                      CSV (.csv)
                    </span>
                  }
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                />
              </div>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleGenerateReport}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner as="span" size="sm" animation="border" role="status" aria-hidden="true" className="me-2" />
                Gerando...
              </>
            ) : 'Gerar Relatório'}
          </Button>
        </Modal.Footer>
      </Modal>
    </PageLayout>
  );
};

export default Reports;
