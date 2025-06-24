import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DevicesProvider } from './components/DevicesContext';
import HomePage from './components/HomePage';
import ComponentsPage from './components/ComponentsPage';
import AccelerometerPage from './components/AccelerometerPage';
import './App.css';

function App() {
  return (
    <DevicesProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Home page route */}
            <Route path="/" element={<HomePage />} />
            
            {/* Components page route */}
            <Route path="/components" element={<ComponentsPage />} />
            
            {/* Shared accelerometer data page for all devices */}
            <Route path="/accelerometer" element={<AccelerometerPage />} />
            
            {/* Optional: Redirect any unknown routes to home */}
            <Route path="*" element={<HomePage />} />
          </Routes>
        </div>
      </Router>
    </DevicesProvider>
  );
}

export default App;