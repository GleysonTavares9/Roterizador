import React, { useState } from 'react';
import { Form, Button, Alert, Spinner, Row, Col, InputGroup } from 'react-bootstrap';
import { toast } from 'react-toastify';
import integrationService from '../../services/integrationService';

const IntegrationSettings = ({ initialData }) => {
  const [formData, setFormData] = useState({
    google_maps_api_key: initialData?.google_maps_api_key || '',
    email_service: initialData?.email_service || 'smtp',
    smtp_server: initialData?.smtp_server || '',
    smtp_port: initialData?.smtp_port || 587,
    smtp_username: initialData?.smtp_username || '',
    smtp_password: '',
    email_notifications: initialData?.email_notifications || false,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);

    try {
      await integrationService.updateIntegrationSettings(formData);
      toast.success('Configurações de integração salvas com sucesso!');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Erro ao salvar configurações de integração. Tente novamente.';
      setError(errorMsg);
      console.error('Erro ao salvar configurações de integração:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const testEmailConnection = async () => {
    if (!formData.smtp_server || !formData.smtp_username || !formData.smtp_password) {
      setError('Preencha todos os campos do servidor SMTP para testar a conexão.');
      return;
    }

    setIsTesting(true);
    setError('');

    try {
      await integrationService.testEmailConnection({
        smtp_server: formData.smtp_server,
        smtp_port: formData.smtp_port,
        smtp_username: formData.smtp_username,
        smtp_password: formData.smtp_password
      });
      
      toast.success('Conexão com o servidor SMTP realizada com sucesso!');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Falha ao conectar ao servidor SMTP. Verifique as configurações.';
      setError(errorMsg);
      console.error('Erro ao testar conexão SMTP:', err);
    } finally {
      setIsTesting(false);
    }
  };

  const testGoogleMapsKey = async () => {
    if (!formData.google_maps_api_key) {
      setError('Informe uma chave da API do Google Maps para testar.');
      return;
    }

    setIsTesting(true);
    setError('');

    try {
      await integrationService.testGoogleMapsApiKey(formData.google_maps_api_key);
      toast.success('Chave da API do Google Maps válida!');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Falha ao validar a chave da API do Google Maps.';
      setError(errorMsg);
      console.error('Erro ao validar chave do Google Maps:', err);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="mt-4">
      <h5>Configurações de Integração</h5>
      <p className="text-muted">Configure as integrações com serviços externos.</p>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Form onSubmit={handleSubmit}>
        <div className="mb-4">
          <h6>Google Maps</h6>
          <p className="text-muted small mb-3">Configure a chave da API do Google Maps.</p>
          
          <Form.Group className="mb-3">
            <Form.Label>Chave da API do Google Maps</Form.Label>
            <InputGroup>
              <Form.Control
                type="password"
                name="google_maps_api_key"
                value={formData.google_maps_api_key}
                onChange={handleChange}
                placeholder="Insira sua chave da API do Google Maps"
              />
              <Button 
                variant="outline-secondary" 
                onClick={testGoogleMapsKey}
                disabled={isTesting || !formData.google_maps_api_key}
              >
                {isTesting ? 'Testando...' : 'Testar'}
              </Button>
            </InputGroup>
          </Form.Group>
        </div>
        
        <hr className="my-4" />
        
        <div className="mb-4">
          <h6>Configurações de E-mail</h6>
          <p className="text-muted small mb-3">Configure o servidor SMTP para envio de e-mails.</p>
          
          <Row>
            <Col md={8}>
              <Form.Group className="mb-3">
                <Form.Label>Servidor SMTP</Form.Label>
                <Form.Control
                  type="text"
                  name="smtp_server"
                  value={formData.smtp_server}
                  onChange={handleChange}
                  placeholder="smtp.exemplo.com"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Porta</Form.Label>
                <Form.Control
                  type="number"
                  name="smtp_port"
                  value={formData.smtp_port}
                  onChange={handleChange}
                  placeholder="587"
                />
              </Form.Group>
            </Col>
          </Row>
          
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Usuário</Form.Label>
                <Form.Control
                  type="text"
                  name="smtp_username"
                  value={formData.smtp_username}
                  onChange={handleChange}
                  placeholder="seu@email.com"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Senha</Form.Label>
                <Form.Control
                  type="password"
                  name="smtp_password"
                  value={formData.smtp_password}
                  onChange={handleChange}
                  placeholder="••••••••"
                />
                <Form.Text className="text-muted">
                  Deixe em branco para manter a senha atual
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>
          
          <Form.Group className="mb-4">
            <Form.Check
              type="switch"
              id="email_notifications"
              label="Ativar notificações por e-mail"
              checked={formData.email_notifications}
              onChange={handleChange}
              name="email_notifications"
            />
          </Form.Group>
          
          <div className="d-flex gap-2">
            <Button 
              variant="outline-primary" 
              onClick={testEmailConnection}
              disabled={isTesting || isSaving}
            >
              {isTesting ? 'Testando...' : 'Testar Conexão'}
            </Button>
            
            <Button 
              variant="primary" 
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Spinner as="span" size="sm" animation="border" role="status" className="me-2" />
                  Salvando...
                </>
              ) : 'Salvar Configurações'}
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
};

export default IntegrationSettings;
