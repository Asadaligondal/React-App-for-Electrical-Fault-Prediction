// src/pages/AccelerometerPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
// Removed DevicesContext dependency - using hardcoded devices
import { useSocket } from '../hooks/useSocket';
import * as Chart from 'chart.js';
import './AccelerometerPage.css';

const AccelerometerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deviceName = searchParams.get('device') || 'Unknown Device';

  // Hardcoded devices - no more dynamic device management
  const devices = [
    { id: 1, name: 'Bearing', type: 'bearing' },
    { id: 2, name: 'Belt', type: 'belt' },
    { id: 3, name: 'Flywheel', type: 'flywheel' }
  ];
  
  // Socket for real-time predictions AND chart data
  const { deviceStatuses, socket } = useSocket();

  // Charts
  const fftChartRef = useRef(null);
  const rawChartRef = useRef(null);
  const fftChartInstance = useRef(null);
  const rawChartInstance = useRef(null);
  const fftUpdateInterval = useRef(null);
  const chartUpdateCounter = useRef(0);

  // Connection status - now using Socket.IO for everything
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  
  // Keep server address for display purposes (Raspberry Pi IP)
  const [serverAddress, setServerAddress] = useState('192.168.1.35');
  const [serverPort, setServerPort] = useState('5002');

  // UI states
  const [isPaused, setIsPaused] = useState(false);
  const [aiStatus, setAiStatus] = useState('AI Ready (Real-time)');
  const [isAiEnabled, setIsAiEnabled] = useState(true); // AI enabled by default

  // Stats
  const [fftStats, setFftStats] = useState({ max: 0, min: 0 });
  const [voltageStats, setVoltageStats] = useState({ max: 0, min: 0, rms: 0 });

  // Chart data state for real-time plotting
  const [chartData, setChartData] = useState([]);
  const [fftData, setFftData] = useState([]);

  // Buffers
  const voltageBuffer = useRef([]);  // rolling window for raw plot
  const SAMPLING_FREQ = 38400;
  const RAW_WINDOW = 1000;           // show last 1000 points smoothly
  const FFT_WINDOW = 1024;           // power-of-two for FFT

  // FFT implementation (your original kept, just tidied a bit)
  const fft = (signal) => {
    const N = signal.length;
    if (N <= 1) return signal;
    const powerOf2 = Math.pow(2, Math.ceil(Math.log2(N)));
    const padded = signal.slice();
    while (padded.length < powerOf2) padded.push(0);
    return fftRecursive(padded);
  };
  const fftRecursive = (signal) => {
    const N = signal.length;
    if (N <= 1) return signal.map(x => ({ real: x, imag: 0 }));
    const even = [], odd = [];
    for (let i = 0; i < N; i++) (i % 2 === 0 ? even : odd).push(signal[i]);
    const evenFFT = fftRecursive(even);
    const oddFFT  = fftRecursive(odd);
    const result = new Array(N);
    for (let k = 0; k < N / 2; k++) {
      const angle = -2 * Math.PI * k / N;
      const tw = { real: Math.cos(angle), imag: Math.sin(angle) };
      const o = {
        real: oddFFT[k].real * tw.real - oddFFT[k].imag * tw.imag,
        imag: oddFFT[k].real * tw.imag + oddFFT[k].imag * tw.real
      };
      result[k] = { real: evenFFT[k].real + o.real, imag: evenFFT[k].imag + o.imag };
      result[k + N / 2] = { real: evenFFT[k].real - o.real, imag: evenFFT[k].imag - o.imag };
    }
    return result;
  };

  // INITIALIZE
  useEffect(() => {
    Chart.Chart.register(...Chart.registerables);
    initializeCharts();

    // Removed device details auto-fill - using hardcoded devices now
    // Removed mock AI push - using real AI predictions now

    // FFT cadence (every 200 ms)
    fftUpdateInterval.current = setInterval(() => {
      if (isPaused) return;
      if (voltageBuffer.current.length >= 8) {
        const sliceStart = Math.max(0, voltageBuffer.current.length - FFT_WINDOW);
        const fftBuffer = voltageBuffer.current.slice(sliceStart);
        if (fftBuffer.length >= 8) performFFTAnalysis(fftBuffer);
      }
    }, 200);

    return () => {
      if (fftUpdateInterval.current) clearInterval(fftUpdateInterval.current);
      if (fftChartInstance.current) fftChartInstance.current.destroy();
      if (rawChartInstance.current) rawChartInstance.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SOCKET.IO HANDLER FOR SENSOR DATA
  useEffect(() => {
    if (!socket) return;

    const handleRawSensorData = (data) => {
      console.log('📊 PLOT DEBUG - Received chart data:', {
        deviceId: data.deviceId,
        samplesReceived: data.samples?.length || 0,
        firstSample: data.samples?.[0],
        lastSample: data.samples?.[data.samples?.length - 1],
        timestamp: data.timestamp
      });

      if (data.samples && data.samples.length > 0) {
        // Add to chart data state
        const timestamp = Date.now();
        const newPoints = data.samples.map((voltage, index) => ({
            x: timestamp + (index * (1000 / 38400)),
            y: voltage
        }));
        
        setChartData(prev => {
            const combined = [...prev, ...newPoints];
            return combined.slice(-2000);
        });
        
        // ALSO update voltageBuffer for chart compatibility
        voltageBuffer.current.push(...data.samples);
        if (voltageBuffer.current.length > 2000) {
            voltageBuffer.current = voltageBuffer.current.slice(-2000);
        }
        
        // Update charts with new data
        updateRawChart();
        
        // Trigger FFT analysis if we have enough data
        if (voltageBuffer.current.length >= 8 && !isPaused) {
          const sliceStart = Math.max(0, voltageBuffer.current.length - FFT_WINDOW);
          const fftBuffer = voltageBuffer.current.slice(sliceStart);
          performFFTAnalysis(fftBuffer);
        }
        
        console.log('📈 PLOT DEBUG - Updated charts & performed FFT:', {
            newPoints: newPoints.length,
            totalChartPoints: chartData.length + newPoints.length,
            voltageBufferSize: voltageBuffer.current.length,
            sampleValues: newPoints.slice(0, 3)
        });
      } else {
        console.log('❌ PLOT DEBUG - No samples in received data');
      }
    };

    const handleConnect = () => {
      console.log('✅ Socket.IO connected for sensor data');
      setConnected(true);
      setLastError(null);
    };

    const handleDisconnect = () => {
      console.log('❌ Socket.IO disconnected');
      setConnected(false);
    };

    const handleConnectError = (error) => {
      console.error('❌ Socket.IO connection error:', error);
      setLastError('Connection failed');
      setConnected(false);
    };

    // Listen for sensor data
    socket.on('raw_sensor_data', handleRawSensorData);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Debug: Listen for all events to see what's coming through
    const originalEmit = socket.emit;
    socket.emit = function(...args) {
      console.log('Socket emit:', args[0], args[1] ? 'with data' : '');
      return originalEmit.apply(socket, args);
    };

    // Set initial connection status
    setConnected(socket.connected);

    return () => {
      socket.off('raw_sensor_data', handleRawSensorData);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket, isPaused]);

  // Debug: Monitor chart data changes
  useEffect(() => {
    if (chartData.length > 0) {
      console.log('📊 Chart data state updated:', {
        totalPoints: chartData.length,
        latestPoints: chartData.slice(-3),
        timeRange: chartData.length > 1 ? {
          start: new Date(chartData[0].x).toLocaleTimeString(),
          end: new Date(chartData[chartData.length - 1].x).toLocaleTimeString()
        } : 'Single point'
      });
    } else {
      console.log('📊 Chart data is empty');
    }
  }, [chartData]);

  // Add this debug useEffect to monitor deviceStatuses changes
  useEffect(() => {
    console.log('🔍 DEVICE STATUS DEBUG - Current deviceStatuses:', {
      deviceStatuses,
      keys: Object.keys(deviceStatuses),
      values: Object.values(deviceStatuses),
      hasStatus192: !!deviceStatuses['192.168.1.35'],
      statusFor192: deviceStatuses['192.168.1.35'],
      serverAddress,
      hasStatusForServer: !!deviceStatuses[serverAddress],
      statusForServer: deviceStatuses[serverAddress]
    });
  }, [deviceStatuses, serverAddress]);

  // CHARTS
  const initializeCharts = () => {
    // FFT
    const fftCtx = fftChartRef.current.getContext('2d');
    fftChartInstance.current = new Chart.Chart(fftCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Frequency Spectrum', data: [], backgroundColor: 'rgba(75, 192, 192, 0.2)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1, fill: true }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Magnitude', color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'rgba(255,255,255,0.7)' } },
          x: { title: { display: true, text: 'Frequency (Hz)', color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'rgba(255,255,255,0.7)' } }
        },
        plugins: { legend: { labels: { color: 'rgba(255,255,255,0.7)' } } }
      }
    });

    // RAW
    const rawCtx = rawChartRef.current.getContext('2d');
    rawChartInstance.current = new Chart.Chart(rawCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Voltage (V)', data: [], backgroundColor: 'rgba(255,206,86,0.2)', borderColor: 'rgba(255,206,86,1)', borderWidth: 1, fill: false, pointRadius: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
        scales: {
          y: { title: { display: true, text: 'Voltage (V)', color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'rgba(255,255,255,0.7)' } },
          x: { title: { display: true, text: 'Time (ms)', color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'rgba(255,255,255,0.7)' } }
        },
        plugins: { legend: { labels: { color: 'rgba(255,255,255,0.7)' } } }
      }
    });
  };

  const performFFTAnalysis = (voltageData) => {
    try {
      const fftResult = fft(voltageData);
      const magnitudes = fftResult.slice(0, fftResult.length / 2).map(c => Math.hypot(c.real, c.imag));
      const frequencies = magnitudes.map((_, i) => (i * SAMPLING_FREQ / (2 * magnitudes.length)).toFixed(1));
      updateFFTChart(frequencies, magnitudes);

      if (chartUpdateCounter.current % 30 === 0) {
        const maxMag = Math.max(...magnitudes);
        const minMag = Math.min(...magnitudes);
        setFftStats({ max: maxMag.toFixed(3), min: minMag.toFixed(3) });
      }

      // AI prediction now handled by real-time Socket.IO - no manual triggering needed
    } catch (err) {
      console.error('FFT analysis error:', err);
    }
  };

  const updateFFTChart = (frequencies, magnitudes) => {
    if (!fftChartInstance.current) return;
    fftChartInstance.current.data.labels = frequencies;
    fftChartInstance.current.data.datasets[0].data = magnitudes;
    fftChartInstance.current.update('none');
  };

  const updateRawChart = () => {
    if (!rawChartInstance.current) {
      console.warn('⚠️ Raw chart instance not available');
      return;
    }

    const voltages = voltageBuffer.current;
    console.log(`🔄 Updating raw chart with ${voltages.length} buffer points`);
    
    if (voltages.length === 0) {
      console.warn('⚠️ No voltage data in buffer for chart update');
      return;
    }

    // Use time-based labels for better visualization
    const dtMs = 1000 / SAMPLING_FREQ;
    const timeLabels = voltages.map((_, i) => (i * dtMs).toFixed(1));

    // Update chart data
    rawChartInstance.current.data.labels = timeLabels;
    rawChartInstance.current.data.datasets[0].data = voltages;
    rawChartInstance.current.update('none');

    console.log(`✅ Raw chart updated with ${voltages.length} points, range: ${Math.min(...voltages).toFixed(3)}V to ${Math.max(...voltages).toFixed(3)}V`);

    // Update stats periodically
    if (chartUpdateCounter.current % 15 === 0) {
      const maxVolt = Math.max(...voltages);
      const minVolt = Math.min(...voltages);
      const rmsVolt = Math.sqrt(voltages.reduce((s, v) => s + v * v, 0) / (voltages.length || 1));
      setVoltageStats({ max: maxVolt.toFixed(3), min: minVolt.toFixed(3), rms: rmsVolt.toFixed(3) });
    }
  };

  // Old AI prediction functions removed - now using real-time Socket.IO predictions

  // UI actions
  const handlePause = () => { setIsPaused(true); showNotification('Data stream paused', 'success'); };
  const handleResume = () => { setIsPaused(false); showNotification('Data stream resumed', 'success'); };
  const handleClear = () => {
    voltageBuffer.current = [];
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

  const handleConnect = () => {
    if (socket) {
      socket.connect();
      showNotification('Connecting to data stream...', 'info');
    }
  };
  
  const handleDisconnect = () => {
    if (socket) {
      socket.disconnect();
      showNotification('Disconnected from stream', 'success');
    }
  };

  const handleAddressChange = () => {
    // Note: IP address is now just for display - data comes via Socket.IO from localhost
    showNotification('Note: Data streams via UDP to localhost automatically', 'info');
  };

  const toggleAI = () => {
    const newState = !isAiEnabled;
    setIsAiEnabled(newState);
    
    // Send command to server to enable/disable AI predictions
    if (socket) {
      if (newState) {
        console.log('🤖 Sending enable_ai command to server');
        socket.emit('enable_ai');
        showNotification('AI predictions enabled', 'success');
      } else {
        console.log('🚫 Sending disable_ai command to server');
        socket.emit('disable_ai');
        showNotification('AI predictions disabled', 'success');
      }
    } else {
      console.warn('⚠️ Socket not connected, cannot toggle AI');
      showNotification('Socket not connected', 'error');
    }
  };

  const showNotification = (message, type) => {
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  // Removed handleBackToComponents - routing directly to home

  // Helper functions for status display
  const getStatusColor = (deviceId, specificStatus = null) => {
    const status = specificStatus || deviceStatuses[deviceId]?.status;
    switch(status) {
      case 'healthy': return '#10B981'; // green
      case 'bearing': return '#EF4444'; // red
      case 'belt': return '#F59E0B'; // orange
      case 'flywheel': return '#EF4444'; // red
      case 'unknown': return '#9333EA'; // purple
      default: return '#6B7280'; // gray
    }
  };

  const getStatusText = (status) => {
    if (!status) return 'No Signal';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="accelerometer-page">
      {/* Header */}
      <div className="header">
        <button
          onClick={() => {
            // Test charts with sample data
            console.log('🧪 Testing charts with sample data');
            const testSamples = Array.from({length: 100}, (_, i) => Math.sin(i * 0.1) + 1.8);
            
            // Test buffer update
            voltageBuffer.current = testSamples;
            console.log('📊 Updated voltage buffer with', testSamples.length, 'test samples');
            
            // Test chart data state update
            const testChartData = testSamples.map((voltage, index) => ({
              x: Date.now() + index * 10,
              y: voltage
            }));
            setChartData(testChartData);
            console.log('📊 Updated chart data state with', testChartData.length, 'test points');
            
            // Update chart
            updateRawChart();
            console.log('✅ Chart test completed - check if chart shows test data');
          }}
          className="test-ai-btn"
        >
          Test Charts
        </button>

        <button onClick={() => navigate('/')} className="back-btn">
          <i className="fas fa-arrow-left"></i><span>Back to Home</span>
        </button>

        <h1 className="page-title">MOTOR COMPONENT HEALTH MONITORING</h1>
        <div className="spacer"></div>
      </div>

      {/* Main */}
      <div className="main-content">
        {/* Connection Status */}
        <div className="connection-status">
          <div className="status-info">
            <div className="status-item">
              <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></div>
              <span>UDP Stream: {connected ? 'Connected' : 'Disconnected'}</span>
            </div>

            {/* Removed device details display - using hardcoded devices now */}
            <div className="device-info">
              <span>Device: Motor System (192.168.1.35)</span>
            </div>

            <div className="status-item">
              <div className={`status-dot ${
                aiStatus === 'AI Model Ready' ? 'connected' :
                aiStatus.includes('Loading') ? 'warning' : 'disconnected'
              }`}></div>
              <span>AI: {aiStatus}</span>
            </div>

            <button onClick={toggleAI} className={`ai-toggle ${isAiEnabled ? 'enabled' : 'disabled'}`}>
              {isAiEnabled ? 'AI ON' : 'AI OFF'}
            </button>
          </div>

          <div className="connection-controls">
            <div className="ip-controls">
              <label>Server IP:</label>
              <input
                type="text"
                value={serverAddress}
                onChange={(e) => { setServerAddress(e.target.value); handleAddressChange(); }}
                placeholder="192.168.1.25"
                className="ip-input"
              />
              <label>Port:</label>
              <input
                type="text"
                value={serverPort}
                onChange={(e) => { setServerPort(e.target.value); handleAddressChange(); }}
                placeholder="5002"
                className="port-input"
              />
            </div>

            <div className="connection-buttons">
              {!connected ? (
                <button onClick={handleConnect} className="connect-btn">
                  <i className="fas fa-plug"></i> Connect
                </button>
              ) : (
                <button onClick={handleDisconnect} className="disconnect-btn">
                  <i className="fas fa-unplug"></i> Disconnect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {lastError && (
          <div className="error-display">
            <span>Error: {lastError}</span>
            <button onClick={() => window.location.reload()} className="error-close">
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        {/* Real-time Component Status */}
        {isAiEnabled && (
          <div className="component-status-section">
            <h2>Real-time Component Health Status</h2>
            
            <div className="device-grid">
              {devices.map(device => {
                // Get global system prediction (no device ID needed)
                const globalPrediction = deviceStatuses.globalPrediction;
                
                // Map AI prediction to component-specific status
                const getComponentStatus = () => {
                  if (!globalPrediction?.status) {
                    return null; // No prediction yet
                  }
                  
                  const prediction = globalPrediction.status.toLowerCase();
                  const deviceName = device.name.toLowerCase();
                  
                  // Handle different prediction cases
                  if (prediction === 'healthy') {
                    return { ...globalPrediction, status: 'healthy' };
                  } else if (deviceName.includes(prediction)) {
                    // Component-specific fault detected
                    return { ...globalPrediction, status: prediction };
                  } else {
                    // Different component fault detected, show as healthy
                    return { ...globalPrediction, status: 'healthy' };
                  }
                };
                
                const componentStatus = getComponentStatus();
                
                return (
                  <div key={device.id} className="status-card">
                    <div className="status-card-header">
                      <h4>{device.name}</h4>
                      <small>Motor System Component</small>
                    </div>
                    <div 
                      className="status-indicator"
                      style={{ 
                        backgroundColor: getStatusColor(null, componentStatus?.status),
                        padding: '15px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}
                    >
                      {getStatusText(componentStatus?.status)}
                    </div>
                    <div className="status-details">
                      {componentStatus?.timestamp && (
                        <small>
                          Last Update: {new Date(componentStatus.timestamp).toLocaleTimeString()}
                        </small>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Removed no devices message - we have hardcoded 3 devices */}
          </div>
        )}

        {/* Charts */}
        <div className="charts-container">
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

        {/* Controls */}
        <div className="controls">
          <button onClick={handlePause} disabled={isPaused} className="control-btn pause-btn">
            <i className="fas fa-pause"></i><span>Pause</span>
          </button>

          <button onClick={handleResume} disabled={!isPaused} className="control-btn resume-btn">
            <i className="fas fa-play"></i><span>Resume</span>
          </button>

          <button onClick={handleClear} className="control-btn clear-btn">
            <i className="fas fa-trash"></i><span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccelerometerPage;
