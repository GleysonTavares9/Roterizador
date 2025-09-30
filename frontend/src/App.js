import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import CollectionPoints from './pages/CollectionPoints';
import CollectionPointForm from './components/CollectionPointForm';
import CollectionPointDetail from './components/CollectionPointDetail';
import OptimizationPage from './pages/OptimizationPage';
import PrivateRoute from './components/PrivateRoute';

function App() {
    return (
        <Router>
            <ToastContainer autoClose={3000} hideProgressBar />
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/collection-points" element={<PrivateRoute><CollectionPoints /></PrivateRoute>} />
                <Route path="/collection-points/new" element={<PrivateRoute><CollectionPointForm /></PrivateRoute>} />
                <Route path="/collection-points/edit/:id" element={<PrivateRoute><CollectionPointForm /></PrivateRoute>} />
                <Route path="/collection-points/:id" element={<PrivateRoute><CollectionPointDetail /></PrivateRoute>} />
                <Route path="/optimization" element={<PrivateRoute><OptimizationPage /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    );
}

export default App;
