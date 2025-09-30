import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useForm from './useForm';

const validateLogin = (values) => {
    const errors = {};
    if (!values.email?.trim()) {
        errors.email = 'E-mail é obrigatório';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
        errors.email = 'E-mail inválido';
    }
    if (!values.password) {
        errors.password = 'Senha é obrigatória';
    }
    return errors;
};

export const useLoginForm = () => {
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState(null); // Agora pode ser um objeto
    const [showPassword, setShowPassword] = useState(false);

    const onSubmitForm = useCallback(async (values) => {
        setIsLoading(true);
        setSubmitError(null);
        try {
            await login(values.email, values.password);
            // O redirecionamento é tratado pelo AuthProvider
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Erro no login.';
            const newErrors = {};
            if (/email|usuário/i.test(errorMessage)) {
                newErrors.email = errorMessage;
            } else if (/senha|credenciais/i.test(errorMessage)) {
                newErrors.password = errorMessage;
            } else {
                newErrors.nonField = errorMessage;
            }
            setSubmitError(newErrors);
            throw new Error(errorMessage); // Propaga o erro para o useForm
        } finally {
            setIsLoading(false);
        }
    }, [login]);

    const form = useForm({ email: '', password: '' }, validateLogin, onSubmitForm);

    const togglePasswordVisibility = useCallback(() => {
        setShowPassword(prev => !prev);
    }, []);

    return {
        ...form,
        values: form.values,
        errors: { ...form.errors, ...submitError }, // Combina erros de validação com os de submissão
        isLoading,
        showPassword,
        togglePasswordVisibility,
        handleSubmit: form.handleSubmit,
    };
};

export default useLoginForm;
