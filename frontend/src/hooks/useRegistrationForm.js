import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import authService from '../services/authService';
import useForm from './useForm';

const validateRegistration = (values) => {
    const errors = {};
    if (!values.name) errors.name = 'Nome é obrigatório';
    if (!values.email) {
        errors.email = 'E-mail é obrigatório';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
        errors.email = 'E-mail inválido';
    }
    if (!values.password) {
        errors.password = 'Senha é obrigatória';
    } else if (values.password.length < 6) {
        errors.password = 'A senha deve ter pelo menos 6 caracteres';
    }
    if (values.password !== values.confirmPassword) {
        errors.confirmPassword = 'As senhas não conferem';
    }
    return errors;
};

const useRegistrationForm = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    const onSubmitForm = useCallback(async (values) => {
        setIsLoading(true);
        setSubmitError(null);
        try {
            await authService.register(values);
            toast.success('Registro bem-sucedido! Você será redirecionado para o login.');
            navigate('/login');
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Erro ao registrar.';
            const newErrors = {};
            if (/email/i.test(errorMessage)) {
                newErrors.email = errorMessage;
            } else {
                newErrors.nonField = errorMessage;
            }
            setSubmitError(newErrors);
            throw new Error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    const form = useForm({ name: '', email: '', password: '', confirmPassword: '' }, validateRegistration, onSubmitForm);

    return {
        ...form,
        errors: { ...form.errors, ...submitError },
        isLoading,
    };
};

export default useRegistrationForm;
