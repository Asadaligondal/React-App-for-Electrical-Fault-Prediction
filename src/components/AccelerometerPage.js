import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDevices } from './DevicesContext';
import { useModbus } from '../hooks/useModbus';
import aiModelService from './AIModelService';
import * as Chart from 'chart.js';

const AccelerometerPage = () => {

  

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deviceName = searchParams.get('device') || 'Unknown Device';
  
  // Get device details from context
  const { getDeviceByName, updateDevicesFromAI, deviceCount } = useDevices();
  const deviceDetails = getDeviceByName(deviceName);

  // Modbus hook for data communication
  const { data, loading, error, readDeviceData, testConnection, clearError } = useModbus();

  // Chart refs and polling
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const pollingInterval = useRef(null);
  
  // State for controls and connection
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [isConnected, setIsConnected] = useState(false);
  const [serverAddress, setServerAddress] = useState(deviceDetails?.ipAddress || '192.168.1.100');
  const [serverPort, setServerPort] = useState('502');
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
    
    // Update server address if device details are available
    if (deviceDetails?.ipAddress) {
      setServerAddress(deviceDetails.ipAddress);
    }
    
    // Start Modbus connection
    connectToModbusDevice();
    
    // Cleanup on unmount
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [deviceDetails]);
useEffect(() => {
  if (deviceDetails && updateDevicesFromAI) {
    console.log("🚀 AUTO-TESTING: Sending mock predictions for", deviceDetails.name);
    setTimeout(() => {
      const mockAiPredictions = {
        motor: { status: "Faulty", confidence: 0.95 },
        pulley: { status: "Warning", confidence: 0.80 },
        belt: { status: "Normal", confidence: 0.90 },
        bearing: { status: "Warning", confidence: 0.75 },
        gear: { status: "Faulty", confidence: 0.85 }
      };
      updateDevicesFromAI(mockAiPredictions);
      console.log("✅ AUTO-TEST: AI predictions applied automatically");
    }, 2000); // Wait 2 seconds after page load
  }
}, [deviceDetails, updateDevicesFromAI]);
  // Monitor Modbus data changes
useEffect(() => {
  console.log("useEffect triggered - deviceDetails:", deviceDetails?.name, "data exists:", !!data[deviceDetails?.id]);
  if (deviceDetails && data[deviceDetails.id]) {
    const deviceData = data[deviceDetails.id];
    
    if (deviceData.connected) {
      setIsConnected(true);
      setConnectionStatus('Connected');
      
      // Process the accelerometer data
      if (!isPaused) {
        processModbusData(deviceData);
        // Update AI predictions if available
        if (deviceData.aiPredictions) { 
          updateDevicesFromAI(deviceData.aiPredictions);
        }
      }
    } else {
      setIsConnected(false);
  setConnectionStatus(deviceData.error || 'Disconnected');
  
  // Test AI with mock data when Modbus fails
  const mockAiPredictions = {
    motor: { status: "Warning", confidence: 0.85 },
    pulley: { status: "Normal", confidence: 0.92 },
    belt: { status: "Faulty", confidence: 0.78 },
    bearing: { status: "Normal", confidence: 0.88 },
    gear: { status: "Warning", confidence: 0.71 }
  };
  
  console.log("About to call updateDevicesFromAI with:", mockAiPredictions);
  updateDevicesFromAI(mockAiPredictions);
  console.log("updateDevicesFromAI called successfully");
    }
  }
}, [data, deviceDetails, isPaused]);

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

  const connectToModbusDevice = async () => {
    if (!deviceDetails) {
      setConnectionStatus('Device not found');
      return;
    }

    setConnectionStatus('Connecting...');
    
    try {
      // Test the connection first
      const testResult = await testConnection(serverAddress, parseInt(serverPort));
      
      if (testResult && testResult.connected) {
        setIsConnected(true);
        setConnectionStatus('Connected');
        showNotification('Connected to Modbus device', 'success');
        
        // Start polling for data
        startDataPolling();
      } else {
        setIsConnected(false);
        setConnectionStatus(testResult?.error || 'Connection Failed');
        showNotification('Failed to connect to Modbus device', 'error');
      }
    } catch (error) {
      console.error('Modbus connection error:', error);
      setConnectionStatus('Connection Error');
      setIsConnected(false);
      showNotification('Connection error', 'error');
    }
  };

  const startDataPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }

    pollingInterval.current = setInterval(async () => {
      if (!isPaused && deviceDetails) {
        try {
          await readDeviceData(deviceDetails.id);
        } catch (error) {
          console.error('Error reading device data:', error);
        }
      }
    }, 1000); // Poll every 1 second
  };

  const processModbusData = async (deviceData) => {
    // Convert raw accelerometer data to frequency spectrum
    // This is a simplified example - you'll need to implement proper FFT
    const frequencies = generateFrequencySpectrum(deviceData.x, deviceData.y, deviceData.z);
    
    updateChart(frequencies.labels, frequencies.magnitudes);
  };

  const generateFrequencySpectrum = (x, y, z) => {
    // Simplified frequency spectrum generation
    // In a real implementation, you'd use FFT on time-series data
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    
    // Generate mock frequency spectrum based on accelerometer magnitude
    const labels = [];
    const magnitudes = [];
    
    for (let freq = 0; freq < 200; freq += 5) {
      labels.push(freq.toString());
      
      // Create realistic-looking spectrum with some peaks at component frequencies
      let mag = Math.random() * 0.1; // Base noise
      
      // Add peaks at component frequencies
      Object.values(componentFrequencies).forEach(compFreq => {
        if (Math.abs(freq - compFreq) < 3) {
          mag += magnitude * 0.1 * Math.exp(-Math.pow(freq - compFreq, 2) / 10);
        }
      });
      
      magnitudes.push(mag);
    }
    
    return { labels, magnitudes };
  };

  const updateChart = async (frequencies, magnitudes) => {
    if (!chartInstance.current) return;
    
    chartInstance.current.data.labels = frequencies;
    chartInstance.current.data.datasets[0].data = magnitudes;
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
    setConnectionStatus('Reconnecting...');
    clearError();
    setTimeout(() => {
      connectToModbusDevice();
    }, 1000);
  };

  const handleAddressChange = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    setIsConnected(false);
    setConnectionStatus('Disconnected');
  };

  const toggleAI = () => {
    setIsAiEnabled(!isAiEnabled);
    showNotification(
      isAiEnabled ? 'AI predictions disabled' : 'AI predictions enabled', 
      'success'
    );
  };

  const showNotification = (message, type) => {
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
  onClick={() => {
    const mockAiPredictions = {
      motor: { status: "Warning", confidence: 0.85 },
      pulley: { status: "Normal", confidence: 0.92 },
      belt: { status: "Faulty", confidence: 0.78 },
      bearing: { status: "Normal", confidence: 0.88 },
      gear: { status: "Warning", confidence: 0.71 }
    };
    updateDevicesFromAI(mockAiPredictions);
    console.log("MANUALLY applied AI predictions");
  }}
  className="bg-purple-600 px-4 py-2 rounded"
>
  Test AI Predictions
</button>
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
        
        <div className="w-32"></div>
      </div>

      {/* Main content area */}
      <div className="max-w-7xl mx-auto">
        {/* Connection Status */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              {/* Modbus Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-sm font-semibold">Modbus: {connectionStatus}</span>
              </div>
              
              {/* Device Info */}
              {deviceDetails && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-300">Device: {deviceDetails.name}</span>
                  <span className="text-sm text-gray-400">({deviceDetails.ipAddress})</span>
                </div>
              )}
              
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
                <label className="text-sm text-gray-300">IP:</label>
                <input
                  type="text"
                  value={serverAddress}
                  onChange={(e) => {
                    setServerAddress(e.target.value);
                    handleAddressChange();
                  }}
                  placeholder="192.168.1.100"
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-1 w-32 focus:ring-blue-500 focus:border-blue-500"
                />
                <label className="text-sm text-gray-300">Port:</label>
                <input
                  type="text"
                  value={serverPort}
                  onChange={(e) => {
                    setServerPort(e.target.value);
                    handleAddressChange();
                  }}
                  placeholder="502"
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-1 w-16 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleReconnect}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition-colors duration-200"
              >
                <i className="fas fa-sync-alt mr-2"></i>
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-800 border border-red-600 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-red-200">Error: {error}</span>
              <button
                onClick={clearError}
                className="text-red-200 hover:text-white"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        )}

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
            <p className={isConnected ? "text-green-400" : "text-red-400"}>
              {isConnected ? "🟢 Active" : "🔴 Inactive"}
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Protocol</h3>
            <p className="text-blue-400">Modbus TCP</p>
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