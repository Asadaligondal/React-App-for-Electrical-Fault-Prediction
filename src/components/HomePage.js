import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './HomePage.css'; // Import the CSS file

const HomePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleGetStarted = () => {
    navigate('/accelerometer');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-inter">
      {/* User Navigation Bar */}
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">ElectriSense</h2>
            <span className="text-gray-300">|</span>
            <span className="text-gray-300">Welcome, {user?.username}!</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <header className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 animate-fade-in">
            AI-Powered Maintenance
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto mb-8 animate-fade-in-delay-1">
            Real-time diagnostics of your electrical system using vibration data and machine learning.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 max-w-4xl w-full">
          <div className="flex items-center space-x-4 bg-gray-800 p-6 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 animate-fade-in-delay-2">
            <i className="fas fa-wrench text-4xl text-blue-400"></i>
            <p className="text-lg">Predictive maintenance of 5 critical components</p>
          </div>
          <div className="flex items-center space-x-4 bg-gray-800 p-6 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 animate-fade-in-delay-3">
            <i className="fas fa-chart-line text-4xl text-green-400"></i>
            <p className="text-lg">Live accelerometer data tracking</p>
          </div>
          <div className="flex items-center space-x-4 bg-gray-800 p-6 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 animate-fade-in-delay-4">
            <i className="fas fa-robot text-4xl text-purple-400"></i>
            <p className="text-lg">AI health & fault detection model</p>
          </div>
        </section>

        <button
          onClick={handleGetStarted}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-10 py-4 rounded-full text-xl font-semibold shadow-xl hover:shadow-2xl transform transition duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-75 animate-bounce-once"
        >
          Get Started
        </button>

        <footer className="mt-20 text-gray-400 text-sm text-center w-full">
          <div className="flex justify-center space-x-6 mb-2">
            <a href="javascript:void(0)" className="hover:text-white transition duration-200">Home</a>
            <a href="javascript:void(0)" className="hover:text-white transition duration-200">About</a>
            <a href="javascript:void(0)" className="hover:text-white transition duration-200">Contact Us</a>
            <a href="javascript:void(0)" className="hover:text-white transition duration-200">Our team</a>
          </div>
          <p>&copy; 2025, My Company</p>
        </footer>
      </div>
    </div>
  );
};

export default HomePage;