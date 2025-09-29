import React from 'react';
import { Spinner } from 'react-bootstrap';

const LoadingSpinner = ({ message = 'Carregando...' }) => {
  return (
    <div className="text-center my-5">
      <Spinner animation="border" role="status">
        <span className="visually-hidden">Carregando...</span>
      </Spinner>
      {message && <p className="mt-2">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
