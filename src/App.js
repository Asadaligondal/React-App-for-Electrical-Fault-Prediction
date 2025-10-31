import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DevicesProvider } from './components/DevicesContext';
import HomePage from './components/HomePage';
// Removed ComponentsPage import - using hardcoded devices now
import AccelerometerPage from './components/AccelerometerPage';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import ProtectedRoute from './components/ProtectedRoute';

// Component to handle redirects for authenticated users
const AuthRedirect = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  return isAuthenticated ? <Navigate to="/" /> : children;
};

function App() {
  return (
    <AuthProvider>
      <DevicesProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Auth routes - redirect to home if already logged in */}
              <Route 
                path="/login" 
                element={
                  <AuthRedirect>
                    <Login />
                  </AuthRedirect>
                } 
              />
              <Route 
                path="/signup" 
                element={
                  <AuthRedirect>
                    <Signup />
                  </AuthRedirect>
                } 
              />

              {/* Protected routes - your existing app */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Removed /components route - using hardcoded devices now */}
              
              <Route 
                path="/accelerometer" 
                element={
                  <ProtectedRoute>
                    <AccelerometerPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Redirect unknown routes to home (which will redirect to login if not authenticated) */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </Router>
      </DevicesProvider>
    </AuthProvider>
  );
}

export default App;