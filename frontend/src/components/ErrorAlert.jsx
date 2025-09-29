import React from 'react';
import { Alert } from 'react-bootstrap';

const ErrorAlert = ({ message, onDismiss }) => {
  if (!message) return null;
  
  return (
    <Alert 
      variant="danger" 
      onClose={onDismiss} 
      dismissible
      className="mb-4"
    >
      {message}
    </Alert>
  );
};

export default ErrorAlert;
