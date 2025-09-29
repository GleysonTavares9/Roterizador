import React, { useState, useEffect } from 'react';
import { Card, Alert, Tabs, Tab, Spinner, Form, Button } from 'react-bootstrap';
import PageLayout from '../components/PageLayout';
import settingsService from '../services/settingsService';
import userService from '../services/userService';
import integrationService from '../services/integrationService';
import { toast } from 'react-toastify';
import AccountSettings from '../components/settings/AccountSettings';
import IntegrationSettings from '../components/settings/IntegrationSettings';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState({
    company_name: '',
    email: '',
    language: 'pt-BR',
    theme: 'light',
    notifications: true,
  });
  const [userData, setUserData] = useState(null);
  const [integrationData, setIntegrationData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Carrega as configurações ao montar o componente
  useEffect(() => {
    const loadAllSettings = async () => {
      console.log('Iniciando carregamento das configurações...');
      try {
        // Carrega configurações gerais
        console.log('Fazendo requisições para API...');
        const [settings, user, integrations] = await Promise.all([
          settingsService.getSettings().catch(err => {
            console.error('Erro ao buscar configurações:', err);
            return {};
          }),
          userService.getCurrentUser().catch(err => {
            console.error('Erro ao buscar usuário:', err);
            return null;
          }),
          integrationService.getIntegrationSettings().catch(err => {
            console.error('Erro ao buscar integrações:', err);
            return null;
          })
        ]);

        console.log('Dados recebidos:', { settings, user, integrations });

        setFormData({
          company_name: settings?.company_name || '',
          email: settings?.email || '',
          language: settings?.language || 'pt-BR',
          theme: settings?.theme || 'light',
          notifications: settings?.notifications !== undefined ? settings.notifications : true,
        });

        setUserData(user || {});
        setIntegrationData(integrations || {});
      } catch (err) {
        const errorMsg = err.response?.data?.detail || 'Erro ao carregar configurações. Tente novamente mais tarde.';
        setError(errorMsg);
        console.error('Erro ao carregar configurações:', err);
      } finally {
        console.log('Finalizando carregamento...');
        setIsLoading(false);
      }
    };

    loadAllSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    
    try {
      await settingsService.updateSettings(formData);
      toast.success('Configurações salvas com sucesso!');
    } catch (err) {
      setError('Erro ao salvar configurações. Tente novamente.');
      console.error('Erro ao salvar configurações:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageLayout title="Configurações">
      <Card>
        <Card.Body>
          {isLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Carregando...</span>
              </Spinner>
              <p className="mt-2">Carregando configurações...</p>
            </div>
          ) : (
            <>
              {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
              
              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k)}
                className="mb-4"
              >
                <Tab eventKey="general" title="Geral">
                  <div className="mt-4">
                
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome da Empresa</Form.Label>
                    <Form.Control
                      type="text"
                      name="company_name"
                      value={formData.company_name}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>E-mail</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Idioma</Form.Label>
                    <Form.Select
                      name="language"
                      value={formData.language}
                      onChange={handleInputChange}
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en-US">English (US)</option>
                      <option value="es-ES">Español</option>
                    </Form.Select>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Tema</Form.Label>
                    <Form.Select
                      name="theme"
                      value={formData.theme}
                      onChange={handleInputChange}
                    >
                      <option value="light">Claro</option>
                      <option value="dark">Escuro</option>
                      <option value="system">Sistema</option>
                    </Form.Select>
                  </Form.Group>
                  
                  <Form.Group className="mb-4">
                    <Form.Check
                      type="switch"
                      id="notifications"
                      label="Ativar notificações"
                      checked={formData.notifications}
                      onChange={handleInputChange}
                      name="notifications"
                    />
                  </Form.Group>
                  
                  <Button 
                    type="submit" 
                    variant="primary" 
                    disabled={isSaving}
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Configurações'}
                  </Button>
                </Form>
              </div>
                </Tab>
                
                <Tab eventKey="account" title="Conta">
                  <div className="mt-4">
                    {userData ? (
                      <AccountSettings 
                        initialData={userData} 
                        onUpdate={(updatedData) => {
                          setUserData(prev => ({ ...prev, ...updatedData }));
                        }}
                      />
                    ) : (
                      <Spinner animation="border" size="sm" />
                    )}
                  </div>
                </Tab>
                
                <Tab eventKey="integrations" title="Integrações">
                  <div className="mt-4">
                    {integrationData !== null ? (
                      <IntegrationSettings 
                        initialData={integrationData}
                      />
                    ) : (
                      <Spinner animation="border" size="sm" />
                    )}
                  </div>
                </Tab>
              </Tabs>
            </>
          )}
        </Card.Body>
      </Card>
    </PageLayout>
  );
};

export default Settings;
