import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDevices } from './DevicesContext';
import { useModbus } from '../hooks/useModbus';
import aiModelService from './AIModelService';
import * as Chart from 'chart.js';
import './AccelerometerPage.css';

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
  const fftChartRef = useRef(null);
  const rawChartRef = useRef(null);
  const fftChartInstance = useRef(null);
  const rawChartInstance = useRef(null);
  const pollingInterval = useRef(null);
  
  // State for controls and connection
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [isConnected, setIsConnected] = useState(false);
  const [serverAddress, setServerAddress] = useState(deviceDetails?.ipAddress || '192.168.1.100');
  const [serverPort, setServerPort] = useState('502');
  const [aiStatus, setAiStatus] = useState('Loading...');
  const [isAiEnabled, setIsAiEnabled] = useState(true);

  // Data statistics
  const [fftStats, setFftStats] = useState({ max: 0, min: 0 });
  const [voltageStats, setVoltageStats] = useState({ max: 0, min: 0, rms: 0 });

  // Data buffers
  const voltageBuffer = useRef([]);
  const timeBuffer = useRef([]);
  const SAMPLING_FREQ = 35000; // 35kHz
  const BUFFER_SIZE = 50; // For FFT
  
  // Simple FFT implementation
  const fft = (signal) => {
    const N = signal.length;
    if (N <= 1) return signal;
    
    // Ensure N is power of 2
    const powerOf2 = Math.pow(2, Math.ceil(Math.log2(N)));
    const paddedSignal = [...signal];
    while (paddedSignal.length < powerOf2) {
      paddedSignal.push(0);
    }
    
    return fftRecursive(paddedSignal);
  };

  const fftRecursive = (signal) => {
    const N = signal.length;
    if (N <= 1) return signal.map(x => ({ real: x, imag: 0 }));
    
    const even = [];
    const odd = [];
    
    for (let i = 0; i < N; i++) {
      if (i % 2 === 0) {
        even.push(signal[i]);
      } else {
        odd.push(signal[i]);
      }
    }
    
    const evenFFT = fftRecursive(even);
    const oddFFT = fftRecursive(odd);
    
    const result = new Array(N);
    
    for (let k = 0; k < N / 2; k++) {
      const angle = -2 * Math.PI * k / N;
      const twiddle = {
        real: Math.cos(angle),
        imag: Math.sin(angle)
      };
      
      const oddTerm = {
        real: oddFFT[k].real * twiddle.real - oddFFT[k].imag * twiddle.imag,
        imag: oddFFT[k].real * twiddle.imag + oddFFT[k].imag * twiddle.real
      };
      
      result[k] = {
        real: evenFFT[k].real + oddTerm.real,
        imag: evenFFT[k].imag + oddTerm.imag
      };
      
      result[k + N / 2] = {
        real: evenFFT[k].real - oddTerm.real,
        imag: evenFFT[k].imag - oddTerm.imag
      };
    }
    
    return result;
  };

  // Mock data generation functions
 

  useEffect(() => {
    // Register Chart.js components
    Chart.Chart.register(...Chart.registerables);
    
    // Initialize charts
    initializeCharts();
    
    // Don't auto-initialize AI - let user control it
    setAiStatus('AI Model Not Loaded');
    setIsAiEnabled(false);
    
    // Update server address if device details are available
    if (deviceDetails?.ipAddress) {
      setServerAddress(deviceDetails.ipAddress);
    }
    
    // Don't auto-connect - let user do it manually
    setConnectionStatus('Disconnected');
    setIsConnected(false);
    
    // Cleanup on unmount
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      if (fftChartInstance.current) {
        fftChartInstance.current.destroy();
      }
      if (rawChartInstance.current) {
        rawChartInstance.current.destroy();
      }
    };
  }, [deviceDetails]);



  // Monitor Modbus data changes - simplified
  useEffect(() => {
    if (deviceDetails && data[deviceDetails.id]) {
      const deviceData = data[deviceDetails.id];
      
      if (deviceData.connected) {
        setIsConnected(true);
        setConnectionStatus('Connected');
      } else {
        setIsConnected(false);
        setConnectionStatus(deviceData.error || 'Disconnected');
      }
    }
  }, [data, deviceDetails]);

  const initializeAI = async () => {
    try {
      setAiStatus('Loading AI Model...');
      const success = await aiModelService.initializeModel();
      
      if (success) {
        setAiStatus('AI Model Ready');
        setIsAiEnabled(true);
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

  const initializeCharts = () => {
    // Initialize FFT Chart
    const fftCtx = fftChartRef.current.getContext('2d');
    fftChartInstance.current = new Chart.Chart(fftCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Frequency Spectrum',
          data: [],
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
          fill: true
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
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: 'rgba(255, 255, 255, 0.7)' }
          },
          x: {
            title: {
              display: true,
              text: 'Frequency (Hz)',
              color: 'rgba(255, 255, 255, 0.7)'
            },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: 'rgba(255, 255, 255, 0.7)' }
          }
        },
        plugins: {
          legend: { labels: { color: 'rgba(255, 255, 255, 0.7)' } }
        }
      }
    });

    // Initialize Raw Voltage Chart
    const rawCtx = rawChartRef.current.getContext('2d');
    rawChartInstance.current = new Chart.Chart(rawCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Voltage (V)',
          data: [],
          backgroundColor: 'rgba(255, 206, 86, 0.2)',
          borderColor: 'rgba(255, 206, 86, 1)',
          borderWidth: 1,
          fill: false,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        scales: {
          y: {
            title: {
              display: true,
              text: 'Voltage (V)',
              color: 'rgba(255, 255, 255, 0.7)'
            },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: 'rgba(255, 255, 255, 0.7)' }
          },
          x: {
            title: {
              display: true,
              text: 'Time (ms)',
              color: 'rgba(255, 255, 255, 0.7)'
            },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: 'rgba(255, 255, 255, 0.7)' }
          }
        },
        plugins: {
          legend: { labels: { color: 'rgba(255, 255, 255, 0.7)' } }
        }
      }
    });
  };

  const startDataPolling = () => {
  if (pollingInterval.current) {
    clearInterval(pollingInterval.current);
  }

  if (!deviceDetails?.id) {
    return;
  }

  pollingInterval.current = setInterval(async () => {
    if (!isPaused && isConnected) {
      try {
        // Read real voltage data from device
        const deviceData = await readDeviceData(deviceDetails.id);
        
        if (deviceData && deviceData.connected && deviceData.voltage !== undefined) {
          // Add real voltage to buffer
          voltageBuffer.current.push(deviceData.voltage);
          timeBuffer.current.push(Date.now());
          
          // Keep buffer size manageable
          if (voltageBuffer.current.length > BUFFER_SIZE) {
            voltageBuffer.current.shift();
            timeBuffer.current.shift();
          }
          
          // Update voltage statistics
          const currentVoltage = deviceData.voltage;
          setVoltageStats(prev => ({
            max: Math.max(prev.max, currentVoltage),
            min: Math.min(prev.min, currentVoltage),
            rms: Math.sqrt(voltageBuffer.current.reduce((sum, v) => sum + v * v, 0) / voltageBuffer.current.length)
          }));
          
          // Update charts with real data
          updateCharts(currentVoltage);
        }
      } catch (error) {
        console.error('Error reading device data:', error);
      }
    }
  }, 100); // 100ms polling for real-time voltage monitoring
};



  const updateCharts = (voltage) => {
  // Update raw voltage chart
  if (rawChartInstance.current) {
    const chart = rawChartInstance.current;
    const now = new Date();
    
    // Add new data point
    chart.data.labels.push(now.toLocaleTimeString());
    chart.data.datasets[0].data.push(voltage);
    
    // Keep only last 50 points for performance
    if (chart.data.labels.length > 50) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    
    chart.update('none'); // No animation for real-time performance
  }
  
  // Update FFT chart when we have enough data
  if (voltageBuffer.current.length >= BUFFER_SIZE) {
    updateFFTChart();
  }
};

  const updateFFTChart = () => {
  if (fftChartInstance.current && voltageBuffer.current.length >= BUFFER_SIZE) {
    // Use real voltage data for FFT
    const fftResult = fft([...voltageBuffer.current]);
    const magnitudes = fftResult.map(complex => 
      Math.sqrt(complex.real * complex.real + complex.imag * complex.imag)
    );
    
    // Create frequency labels
    const freqLabels = magnitudes.slice(0, magnitudes.length / 2).map((_, i) => 
      ((i * SAMPLING_FREQ) / magnitudes.length).toFixed(0) + ' Hz'
    );
    
    // Update FFT chart
    const chart = fftChartInstance.current;
    chart.data.labels = freqLabels;
    chart.data.datasets[0].data = magnitudes.slice(0, magnitudes.length / 2);
    
    // Update FFT statistics
    const maxMagnitude = Math.max(...magnitudes);
    const minMagnitude = Math.min(...magnitudes);
    setFftStats({ max: maxMagnitude, min: minMagnitude });
    
    chart.update('none');
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
    voltageBuffer.current = [];
    timeBuffer.current = [];
    
    if (fftChartInstance.current) {
      fftChartInstance.current.data.labels = [];
      fftChartInstance.current.data.datasets[0].data = [];
      fftChartInstance.current.update();
    }
    
    if (rawChartInstance.current) {
      rawChartInstance.current.data.labels = [];
      rawChartInstance.current.data.datasets[0].data = [];
      rawChartInstance.current.update();
    }
    
    showNotification('Chart data cleared', 'success');
  };

  const connectToModbusDevice = async () => {
    if (!deviceDetails) {
      setConnectionStatus('Device not found');
      return;
    }

    setConnectionStatus('Connecting...');
    
    try {
      const testResult = await testConnection(serverAddress, parseInt(serverPort));
      
      if (testResult && testResult.connected) {
        setIsConnected(true);
        setConnectionStatus('Connected');
        showNotification('Connected to Modbus device', 'success');
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

  const disconnectFromModbus = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    setIsConnected(false);
    setConnectionStatus('Disconnected');
    showNotification('Disconnected from Modbus device', 'success');
  };

  const handleReconnect = () => {
    setConnectionStatus('Reconnecting...');
    clearError();
    connectToModbusDevice();
  };

  const handleAddressChange = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    setIsConnected(false);
    setConnectionStatus('Disconnected');
  };

  const toggleAI = () => {
    if (aiStatus === 'AI Model Not Loaded') {
      // Load AI model first
      initializeAI();
    } else {
      // Toggle AI on/off
      setIsAiEnabled(!isAiEnabled);
      showNotification(
        isAiEnabled ? 'AI predictions disabled' : 'AI predictions enabled', 
        'success'
      );
    }
  };

  const showNotification = (message, type) => {
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const handleBackToComponents = () => {
    navigate('/components');
  };

  return (
    <div className="accelerometer-page">
      {/* Header with back button */}
      <div className="header">
        <button
          onClick={handleBackToComponents}
          className="back-btn"
        >
          <i className="fas fa-arrow-left"></i>
          <span>Back to Components</span>
        </button>
        
        <h1 className="page-title">
          {deviceName.toUpperCase()} - VOLTAGE ANALYSIS
        </h1>
        
        <div className="spacer"></div>
      </div>

      {/* Main content area */}
      <div className="main-content">
        {/* Connection Status */}
        <div className="connection-status">
          <div className="status-info">
            <div className="status-item">
              <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
              <span>Modbus: {connectionStatus}</span>
            </div>
            
            {deviceDetails && (
              <div className="device-info">
                <span>Device: {deviceDetails.name}</span>
                <span className="ip-address">({deviceDetails.ipAddress})</span>
              </div>
            )}
            
            <div className="status-item">
              <div className={`status-dot ${
                aiStatus === 'AI Model Ready' ? 'connected' : 
                aiStatus.includes('Loading') ? 'warning' : 'disconnected'
              }`}></div>
              <span>AI: {aiStatus}</span>
            </div>
            
            <button
              onClick={toggleAI}
              className={`ai-toggle ${isAiEnabled ? 'enabled' : 'disabled'}`}
            >
              {aiStatus === 'AI Model Not Loaded' ? 'Load AI' : 
               isAiEnabled ? 'AI ON' : 'AI OFF'}
            </button>
          </div>
          
          <div className="connection-controls">
            <div className="ip-controls">
              <label>IP:</label>
              <input
                type="text"
                value={serverAddress}
                onChange={(e) => {
                  setServerAddress(e.target.value);
                  handleAddressChange();
                }}
                placeholder="192.168.1.100"
                className="ip-input"
              />
              <label>Port:</label>
              <input
                type="text"
                value={serverPort}
                onChange={(e) => {
                  setServerPort(e.target.value);
                  handleAddressChange();
                }}
                placeholder="502"
                className="port-input"
              />
            </div>
            
            {/* Manual connection buttons */}
            <div className="connection-buttons">
              {!isConnected ? (
                <button
                  onClick={connectToModbusDevice}
                  disabled={loading}
                  className="connect-btn"
                >
                  <i className="fas fa-plug"></i>
                  {loading ? 'Connecting...' : 'Connect'}
                </button>
              ) : (
                <button
                  onClick={disconnectFromModbus}
                  className="disconnect-btn"
                >
                  <i className="fas fa-unplug"></i>
                  Disconnect
                </button>
              )}
              
              {isConnected && (
                <button
                  onClick={handleReconnect}
                  disabled={loading}
                  className="reconnect-btn"
                >
                  <i className="fas fa-sync-alt"></i>
                  Reconnect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-display">
            <span>Error: {error}</span>
            <button onClick={clearError} className="error-close">
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        {/* Charts Container */}
        <div className="charts-container">
          {/* FFT Chart */}
          <div className="chart-section">
            <div className="chart-header">
              <h2>Frequency Spectrum (FFT)</h2>
              <div className="chart-stats">
                <span className="stat-item">Max: {fftStats.max}</span>
                <span className="stat-item">Min: {fftStats.min}</span>
              </div>
            </div>
            <div className="chart-canvas">
              <canvas ref={fftChartRef}></canvas>
            </div>
          </div>

          {/* Raw Voltage Chart */}
          <div className="chart-section">
            <div className="chart-header">
              <h2>Raw Voltage Data</h2>
              <div className="chart-stats">
                <span className="stat-item">Max: {voltageStats.max}V</span>
                <span className="stat-item">Min: {voltageStats.min}V</span>
                <span className="stat-item">RMS: {voltageStats.rms}V</span>
              </div>
            </div>
            <div className="chart-canvas">
              <canvas ref={rawChartRef}></canvas>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="controls">
          <button
            onClick={handlePause}
            disabled={isPaused}
            className="control-btn pause-btn"
          >
            <i className="fas fa-pause"></i>
            <span>Pause</span>
          </button>
          
          <button
            onClick={handleResume}
            disabled={!isPaused}
            className="control-btn resume-btn"
          >
            <i className="fas fa-play"></i>
            <span>Resume</span>
          </button>
          
          <button
            onClick={handleClear}
            className="control-btn clear-btn"
          >
            <i className="fas fa-trash"></i>
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccelerometerPage;