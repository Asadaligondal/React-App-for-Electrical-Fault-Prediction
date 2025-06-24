import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDevices } from './DevicesContext';
import aiModelService from './AIModelService';
import * as Chart from 'chart.js';

const AccelerometerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deviceName = searchParams.get('device') || 'Unknown Device';
  
  // Get device details from context
  const { getDeviceByName, updateDevicesFromAI, deviceCount } = useDevices();
  const deviceDetails = getDeviceByName(deviceName);

  // Chart and WebSocket refs
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const wsRef = useRef(null);
  
  // State for controls and connection
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [isConnected, setIsConnected] = useState(false);
  const [serverAddress, setServerAddress] = useState('ws://192.168.1.100:8080');
  const [aiStatus, setAiStatus] = useState('Loading...');
  const [isAiEnabled, setIsAiEnabled] = useState(true);

  // Component frequencies for reference lines
  const componentFrequencies = {
    motor: 60,
    pulley: 30,
    belt: 15,
    bearing: 120,
    gear: 45
  };

  useEffect(() => {
    // Register Chart.js components
    Chart.Chart.register(...Chart.registerables);
    
    // Initialize chart
    initializeChart();
    
    // Initialize AI model
    initializeAI();
    
    // Connect to WebSocket
    connectToWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, []);

  const initializeAI = async () => {
    try {
      setAiStatus('Loading AI Model...');
      const success = await aiModelService.initializeModel();
      
      if (success) {
        setAiStatus('AI Model Ready');
        showNotification('AI model loaded successfully', 'success');
      } else {
        setAiStatus('AI Model Failed');
        setIsAiEnabled(false);
        showNotification('Failed to load AI model', 'error');
      }
    } catch (error) {
      console.error('AI initialization error:', error);
      setAiStatus('AI Model Error');
      setIsAiEnabled(false);
    }
  };

  const initializeChart = () => {
    const ctx = chartRef.current.getContext('2d');
    
    chartInstance.current = new Chart.Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Frequency Spectrum',
          data: [],
          backgroundColor: 'rgba(75, 192, 192, 0.7)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Magnitude',
              color: 'rgba(255, 255, 255, 0.7)'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Frequency (Hz)',
              color: 'rgba(255, 255, 255, 0.7)'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              maxTicksLimit: 20
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          },
          tooltip: {
            callbacks: {
              title: function(tooltipItems) {
                return `Frequency: ${tooltipItems[0].label} Hz`;
              }
            }
          }
        }
      }
    });
  };

  const connectToWebSocket = () => {
    try {
      const ws = new WebSocket(serverAddress);
      
      ws.onopen = () => {
        console.log(`Connected to accelerometer WebSocket server at ${serverAddress}`);
        setConnectionStatus('Connected');
        setIsConnected(true);
        showNotification('Connected to sensor', 'success');
      };
      
      ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
        setConnectionStatus('Disconnected');
        setIsConnected(false);
        showNotification('Disconnected from sensor', 'error');
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Connection Error');
        setIsConnected(false);
        showNotification('Connection error', 'error');
      };
      
      ws.onmessage = (event) => {
        if (isPaused) return;
        
        try {
          const data = JSON.parse(event.data);
          updateChart(data.frequencies, data.magnitudes);
        } catch (error) {
          console.error('Error parsing WebSocket data:', error);
        }
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setConnectionStatus('Failed to Connect');
      showNotification('Failed to connect to sensor', 'error');
    }
  };

  const updateChart = async (frequencies, magnitudes) => {
    if (!chartInstance.current) return;
    
    // Limit to frequencies under 200Hz for better visualization
    const maxFreqIndex = frequencies.findIndex(freq => parseFloat(freq) > 200);
    const limitIndex = maxFreqIndex > 0 ? maxFreqIndex : Math.min(frequencies.length, 50);
    
    chartInstance.current.data.labels = frequencies.slice(0, limitIndex);
    chartInstance.current.data.datasets[0].data = magnitudes.slice(0, limitIndex).map(m => parseFloat(m));
    
    chartInstance.current.update('none');

    // Run AI predictions on the data
    if (isAiEnabled && !isPaused) {
      await runAIPrediction(frequencies, magnitudes);
    }
  };

  const runAIPrediction = async (frequencies, magnitudes) => {
    try {
      const predictions = await aiModelService.predictComponentHealth(frequencies, magnitudes);
      
      if (predictions) {
        const statuses = aiModelService.convertToStatuses(predictions);
        if (statuses) {
          // Update all device statuses via context
          updateDevicesFromAI(statuses);
          console.log('AI Predictions applied:', statuses);
        }
      }
    } catch (error) {
      console.error('AI prediction error:', error);
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    showNotification('Data stream paused', 'success');
  };

  const handleResume = () => {
    setIsPaused(false);
    showNotification('Data stream resumed', 'success');
  };

  const handleClear = () => {
    if (chartInstance.current) {
      chartInstance.current.data.labels = [];
      chartInstance.current.data.datasets[0].data = [];
      chartInstance.current.update();
      showNotification('Chart data cleared', 'success');
    }
  };

  const handleReconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setConnectionStatus('Reconnecting...');
    setTimeout(() => {
      connectToWebSocket();
    }, 1000);
  };

  const toggleAI = () => {
    setIsAiEnabled(!isAiEnabled);
    showNotification(
      isAiEnabled ? 'AI predictions disabled' : 'AI predictions enabled', 
      'success'
    );
  };

  const showNotification = (message, type) => {
    // Simple notification - you could enhance this
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const handleBackToComponents = () => {
    navigate('/components');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 font-inter">
      {/* Header with back button */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={handleBackToComponents}
          className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors duration-200"
        >
          <i className="fas fa-arrow-left"></i>
          <span>Back to Components</span>
        </button>
        
        <h1 className="text-4xl font-bold text-center">
          {deviceName.toUpperCase()} - ACCELEROMETER DATA
        </h1>
        
        <div className="w-32"></div> {/* Spacer for centering */}
      </div>

      {/* Main content area with accelerometer chart */}
      <div className="max-w-7xl mx-auto">
        {/* Connection Status */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              {/* WebSocket Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-sm font-semibold">WebSocket: {connectionStatus}</span>
              </div>
              
              {/* AI Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  aiStatus === 'AI Model Ready' ? 'bg-green-400' : 
                  aiStatus.includes('Loading') ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
                <span className="text-sm font-semibold">AI: {aiStatus}</span>
              </div>
              
              {/* AI Toggle */}
              <button
                onClick={toggleAI}
                disabled={aiStatus !== 'AI Model Ready'}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors duration-200 ${
                  isAiEnabled 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                } disabled:bg-gray-600 disabled:cursor-not-allowed`}
              >
                AI {isAiEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Server Address Input */}
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-300">Server:</label>
                <input
                  type="text"
                  value={serverAddress}
                  onChange={(e) => setServerAddress(e.target.value)}
                  placeholder="ws://192.168.1.100:8080"
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-1 w-48 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleReconnect}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors duration-200"
              >
                <i className="fas fa-sync-alt mr-2"></i>
                Connect
              </button>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">
              {deviceName} - Frequency Spectrum Analysis
            </h2>
            
            {/* Control Buttons */}
            <div className="flex space-x-2">
              <button
                onClick={handlePause}
                disabled={isPaused}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
              >
                <i className="fas fa-pause"></i>
                <span>Pause</span>
              </button>
              
              <button
                onClick={handleResume}
                disabled={!isPaused}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
              >
                <i className="fas fa-play"></i>
                <span>Resume</span>
              </button>
              
              <button
                onClick={handleClear}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
              >
                <i className="fas fa-trash"></i>
                <span>Clear</span>
              </button>
            </div>
          </div>
          
          {/* Chart Canvas */}
          <div className="bg-gray-900 rounded-lg p-4" style={{ height: '500px' }}>
            <canvas ref={chartRef} id="accelChart"></canvas>
          </div>
          
          {/* Component Frequency Reference */}
          <div className="mt-4 p-4 bg-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Component Reference Frequencies:</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Motor: 60Hz</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Pulley: 30Hz</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>Belt: 15Hz</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span>Bearing: 120Hz</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span>Gear: 45Hz</span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Sensor Status</h3>
            <p className="text-green-400">🟢 Active</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Sample Rate</h3>
            <p className="text-blue-400">1000 Hz</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Data Points</h3>
            <p className="text-purple-400">Live Stream</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccelerometerPage;