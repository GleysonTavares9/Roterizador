import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useForm from './useForm';

// Validation function for the login form
const validateLogin = (values) => {
  const errors = {};
  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  
  if (!values.email?.trim()) {
    errors.email = 'E-mail é obrigatório';
  } else if (!emailRegex.test(values.email)) {
    errors.email = 'Por favor, insira um e-mail válido';
  }
  
  if (!values.password) {
    errors.password = 'Senha é obrigatória';
  } else if (values.password.length < 6) {
    errors.password = 'A senha deve ter pelo menos 6 caracteres';
  }
  
  return errors;
};

export const useLoginForm = () => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Handle form submission
  const onSubmitForm = useCallback(async (values) => {
    setIsLoading(true);
    setSubmitError('');
    
    try {
      const result = await login(values.email, values.password);
      
      if (!result.success) {
        throw new Error(result.error || 'Falha no login. Verifique suas credenciais.');
      }
      
      // O redirecionamento é tratado pelo AuthProvider
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Ocorreu um erro ao tentar fazer login. Tente novamente.';
      
      setSubmitError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [login]);
  
  // Initialize form with useForm hook
  const form = useForm(
    {
      email: '',
      password: ''
    },
    validateLogin,
    onSubmitForm
  );
  
  // Toggle password visibility
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);
  
  return {
    ...form,
    isLoading,
    submitError,
    showPassword,
    togglePasswordVisibility
  };
};

export default useLoginForm;
