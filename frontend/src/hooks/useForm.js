import { useState, useCallback } from 'react';
import { extractErrorMessage } from '../utils/apiErrorHandler';

/**
 * Custom hook for form handling with validation
 * @param {Object} initialValues - Initial form values
 * @param {Function} validate - Validation function that returns errors object
 * @param {Function} onSubmit - Form submission handler
 * @returns {Object} Form state and handlers
 */
const useForm = (initialValues, validate, onSubmit) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [touched, setTouched] = useState({});

  // Handle input change
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    
    // Handle different input types
    const inputValue = type === 'checkbox' ? checked : value;
    
    setValues(prevValues => ({
      ...prevValues,
      [name]: inputValue
    }));

    // Clear error for the field being edited
    if (errors[name]) {
      setErrors(prevErrors => ({
        ...prevErrors,
        [name]: ''
      }));
    }

    // Clear submit error when user starts typing
    if (submitError) {
      setSubmitError('');
    }
  }, [errors, submitError]);

  // Handle input blur
  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    
    // Mark field as touched
    setTouched(prevTouched => ({
      ...prevTouched,
      [name]: true
    }));

    // Validate the field
    if (validate) {
      const validationErrors = validate(values);
      if (validationErrors[name]) {
        setErrors(prevErrors => ({
          ...prevErrors,
          [name]: validationErrors[name]
        }));
      }
    }
  }, [validate, values]);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    
    // Run validation if provided
    let formIsValid = true;
    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
      formIsValid = Object.keys(validationErrors).length === 0;
    }
    
    // Mark all fields as touched for error display
    const touchedFields = {};
    Object.keys(values).forEach(key => {
      touchedFields[key] = true;
    });
    setTouched(touchedFields);
    
    if (formIsValid) {
      setIsSubmitting(true);
      setSubmitError('');
      
      try {
        await onSubmit(values);
      } catch (error) {
        console.error('Form submission error:', error);
        const errorMessage = extractErrorMessage(error);
        setSubmitError(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [onSubmit, validate, values]);

  // Reset form to initial values
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setSubmitError('');
  }, [initialValues]);

  // Set field value manually
  const setFieldValue = useCallback((name, value) => {
    setValues(prevValues => ({
      ...prevValues,
      [name]: value
    }));
  }, []);

  // Set field error manually
  const setFieldError = useCallback((name, error) => {
    setErrors(prevErrors => ({
      ...prevErrors,
      [name]: error
    }));
  }, []);

  // Check if a field has an error and has been touched
  const getFieldError = useCallback((name) => {
    return touched[name] && errors[name] ? errors[name] : '';
  }, [errors, touched]);

  // Check if the form is valid
  const isValid = Object.keys(errors).length === 0 || 
    Object.values(errors).every(error => !error);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    submitError,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldError,
    getFieldError,
    setValues,
    setErrors,
    setTouched,
    isValid
  };
};

export default useForm;
