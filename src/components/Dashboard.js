import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome, {user?.username}!</h1>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>
      
      <div className="dashboard-content">
        <div className="user-info">
          <h2>User Information</h2>
          <p><strong>Username:</strong> {user?.username}</p>
          <p><strong>Email:</strong> {user?.email}</p>
        </div>

        <div className="devices-section">
          <h2>Your Devices</h2>
          <p>Device management will be added here soon...</p>
          {/* We'll add device management functionality later */}
        </div>

        <div className="websocket-section">
          <h2>Sensor Data</h2>
          <p>Accelerometer data visualization will go here...</p>
          {/* Your existing sensor/chart components will go here */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;