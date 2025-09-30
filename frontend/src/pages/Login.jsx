import React, { useRef, useEffect } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Form, 
  Button, 
  Alert, 
  Spinner 
} from 'react-bootstrap';
import { 
  FaSignInAlt, 
  FaEnvelope, 
  FaLock, 
  FaEye, 
  FaEyeSlash, 
  FaExclamationCircle 
} from 'react-icons/fa';
import { Link } from 'react-router-dom';
import useLoginForm from '../hooks/useLoginForm';
import './Login.css';

const Login = () => {
  const emailInputRef = useRef(null);
  
  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isLoading,
    showPassword,
    togglePasswordVisibility
  } = useLoginForm();
  
  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);
  
  const onSubmit = (e) => {
    e.preventDefault();
    handleSubmit(e);
  };

  return (
    <div className="login-page bg-light">
      <Container className="h-100">
        <Row className="justify-content-center align-items-center min-vh-100 py-5">
          <Col xs={12} md={8} lg={6} xl={5}>
            <Card className="shadow-sm border-0 rounded-3 overflow-hidden">
              <div className="bg-primary text-white p-4 text-center">
                <h1 className="h4 mb-0 fw-bold">Sistema de Roteirização</h1>
                <p className="mb-0 small">Faça login para acessar o painel</p>
              </div>
              
              <Card.Body className="p-4 p-md-5">
                {errors.nonField && (
                  <Alert variant="danger" className="d-flex align-items-center py-2 mb-4">
                    <FaExclamationCircle className="me-2 flex-shrink-0" />
                    <span>{errors.nonField}</span>
                  </Alert>
                )}

                <Form onSubmit={onSubmit} noValidate>
                  <Form.Group className="mb-3">
                    <Form.Label className="form-label">E-mail</Form.Label>
                    <div className="input-group">
                      <span className="input-group-text bg-light"><FaEnvelope className="text-muted" /></span>
                      <Form.Control
                        type="email"
                        name="email"
                        value={values.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="seu@email.com"
                        isInvalid={touched.email && !!errors.email}
                        disabled={isLoading}
                        ref={emailInputRef}
                        autoComplete="username"
                      />
                    </div>
                    {touched.email && errors.email && (
                      <div className="invalid-feedback d-block">{errors.email}</div>
                    )}
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <Form.Label className="form-label mb-0">Senha</Form.Label>
                      <Link to="/forgot-password" className="small text-decoration-none" tabIndex={-1}>Esqueceu a senha?</Link>
                    </div>
                    <div className="input-group">
                      <span className="input-group-text bg-light"><FaLock className="text-muted" /></span>
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={values.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="••••••"
                        isInvalid={touched.password && !!errors.password}
                        disabled={isLoading}
                        autoComplete="current-password"
                      />
                      <button type="button" className="btn btn-outline-secondary password-toggle-btn" onClick={togglePasswordVisibility} tabIndex={-1} disabled={isLoading}>
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    {touched.password && errors.password && (
                      <div className="invalid-feedback d-block">{errors.password}</div>
                    )}
                  </Form.Group>

                  <Button type="submit" variant="primary" className="w-100 py-2 fw-medium mb-3" disabled={isLoading}>
                    {isLoading ? (
                      <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />Autenticando...</>
                    ) : (
                      <><FaSignInAlt className="me-2" />Entrar</>
                    )}
                  </Button>

                  <div className="text-center">
                    <p className="mb-2 small text-muted">Ainda não tem uma conta?</p>
                    <Link to="/register" className="btn btn-outline-primary btn-sm" tabIndex={-1}>Criar conta</Link>
                  </div>
                </Form>
              </Card.Body>
              
              <Card.Footer className="bg-light text-center py-3">
                <p className="small text-muted mb-0">{new Date().getFullYear()} Sistema de Roteirização. Todos os direitos reservados.</p>
              </Card.Footer>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Login;
