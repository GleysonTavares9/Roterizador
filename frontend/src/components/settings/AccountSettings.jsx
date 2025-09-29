import React, { useState } from 'react';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import userService from '../../services/userService';

const AccountSettings = ({ initialData, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPasswordError('');

    // Validação de senha
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }

    // Se nova senha for fornecida, a senha atual é obrigatória
    if (formData.newPassword && !formData.currentPassword) {
      setError('Por favor, informe sua senha atual para alterar para uma nova senha.');
      return;
    }

    setIsSaving(true);

    try {
      // Atualiza os dados do usuário
      await userService.updateUser({
        name: formData.name,
        email: formData.email
      });

      // Se uma nova senha foi fornecida, atualiza a senha
      if (formData.newPassword) {
        await userService.changePassword(
          formData.currentPassword,
          formData.newPassword
        );
      }

      toast.success('Conta atualizada com sucesso!');
      
      // Limpa os campos de senha
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));

      // Notifica o componente pai sobre a atualização
      if (onUpdate) {
        onUpdate({
          name: formData.name,
          email: formData.email
        });
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Erro ao atualizar a conta. Verifique os dados e tente novamente.';
      setError(errorMsg);
      console.error('Erro ao atualizar conta:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4">
      <h5>Configurações da Conta</h5>
      <p className="text-muted">Atualize suas informações pessoais e senha.</p>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>Nome</Form.Label>
          <Form.Control
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </Form.Group>
        
        <Form.Group className="mb-3">
          <Form.Label>E-mail</Form.Label>
          <Form.Control
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </Form.Group>
        
        <hr className="my-4" />
        <h6>Alterar Senha</h6>
        <p className="text-muted small mb-4">Deixe em branco para manter a senha atual.</p>
        
        <Form.Group className="mb-3">
          <Form.Label>Senha Atual</Form.Label>
          <Form.Control
            type="password"
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleChange}
            placeholder="Digite sua senha atual"
          />
        </Form.Group>
        
        <Form.Group className="mb-3">
          <Form.Label>Nova Senha</Form.Label>
          <Form.Control
            type="password"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            placeholder="Digite a nova senha"
          />
        </Form.Group>
        
        <Form.Group className="mb-4">
          <Form.Label>Confirmar Nova Senha</Form.Label>
          <Form.Control
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Confirme a nova senha"
            isInvalid={!!passwordError}
          />
          {passwordError && (
            <Form.Control.Feedback type="invalid">
              {passwordError}
            </Form.Control.Feedback>
          )}
        </Form.Group>
        
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
          ) : 'Salvar Alterações'}
        </Button>
      </Form>
    </div>
  );
};

export default AccountSettings;
