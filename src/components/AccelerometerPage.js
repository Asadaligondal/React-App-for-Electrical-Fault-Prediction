// src/pages/AccelerometerPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDevices } from './DevicesContext';
import aiModelService from './AIModelService';
import { useStream } from '../hooks/useStream';
import * as Chart from 'chart.js';
import './AccelerometerPage.css';

const AccelerometerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deviceName = searchParams.get('device') || 'Unknown Device';

  // Device metadata (unchanged)
  const { getDeviceByName, updateDevicesFromAI } = useDevices();
  const deviceDetails = getDeviceByName(deviceName);

  // Charts
  const fftChartRef = useRef(null);
  const rawChartRef = useRef(null);
  const fftChartInstance = useRef(null);
  const rawChartInstance = useRef(null);
  const fftUpdateInterval = useRef(null);
  const chartUpdateCounter = useRef(0);

  // Stream connection (Socket.IO server IP:port)
  const [serverAddress, setServerAddress] = useState(deviceDetails?.ipAddress || '192.168.1.25'); // HTTP server IP
  const [serverPort, setServerPort] = useState('5002'); // Socket.IO HTTP port
  const serverUrl = `http://${serverAddress}:${serverPort}`;

  const { connected: streamConnected, lastError, connect, disconnect, onBatch } = useStream({ serverUrl });

  // UI states
  const [isPaused, setIsPaused] = useState(false);
  const [aiStatus, setAiStatus] = useState('AI Model Not Loaded');
  const [isAiEnabled, setIsAiEnabled] = useState(false);

  // Stats
  const [fftStats, setFftStats] = useState({ max: 0, min: 0 });
  const [voltageStats, setVoltageStats] = useState({ max: 0, min: 0, rms: 0 });

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

    // Auto-fill address from device details if available
    if (deviceDetails?.ipAddress) setServerAddress(deviceDetails.ipAddress);

    // Mock AI push (kept)
    if (deviceDetails && updateDevicesFromAI) {
      setTimeout(() => {
        const mockAiPredictions = {
          motor: { status: "Faulty", confidence: 0.95 },
          pulley: { status: "Warning", confidence: 0.80 },
          belt: { status: "Normal", confidence: 0.90 },
          bearing: { status: "Warning", confidence: 0.75 },
          gear: { status: "Faulty", confidence: 0.85 }
        };
        updateDevicesFromAI(mockAiPredictions);
      }, 2000);
    }

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

  // STREAM HANDLER
  useEffect(() => {
    onBatch((payload) => {
      if (isPaused) return;
      const { samples /* Float32Array */, sampleRate } = payload;

      // append to rolling raw window (decimate for plot if you like)
      const arr = Array.from(samples); // keep simple; could keep typed array too
      voltageBuffer.current.push(...arr);
      if (voltageBuffer.current.length > RAW_WINDOW) {
        voltageBuffer.current.splice(0, voltageBuffer.current.length - RAW_WINDOW);
      }

      // update raw chart (throttled)
      chartUpdateCounter.current++;
      if (chartUpdateCounter.current % 3 === 0) updateRawChart();

      // make sure our sampling rate is in sync (optional, we trust 38.4k)
      void sampleRate; // placeholder; keeping your constant SAMPLING_FREQ
    });
  }, [onBatch, isPaused]);

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

      if (isAiEnabled && !isPaused) runAIPrediction(frequencies, magnitudes);
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
    if (!rawChartInstance.current) return;
    const voltages = voltageBuffer.current;
    const dtMs = 1000 / SAMPLING_FREQ;
    const timeLabels = voltages.map((_, i) => (i * dtMs).toFixed(0));

    const maxVolt = Math.max(...voltages);
    const minVolt = Math.min(...voltages);
    const rmsVolt = Math.sqrt(voltages.reduce((s, v) => s + v * v, 0) / (voltages.length || 1));

    rawChartInstance.current.data.labels = timeLabels;
    rawChartInstance.current.data.datasets[0].data = voltages;
    rawChartInstance.current.update('none');

    if (chartUpdateCounter.current % 15 === 0) {
      setVoltageStats({ max: maxVolt.toFixed(3), min: minVolt.toFixed(3), rms: rmsVolt.toFixed(3) });
    }
  };

  const runAIPrediction = async (frequencies, magnitudes) => {
    try {
      const predictions = await aiModelService.predictComponentHealth(frequencies, magnitudes);
      if (predictions) {
        const statuses = aiModelService.convertToStatuses(predictions);
        if (statuses) updateDevicesFromAI(statuses);
      }
    } catch (error) {
      console.error('AI prediction error:', error);
    }
  };

  // AI controls (unchanged)
  const initializeAI = async () => {
    try {
      setAiStatus('Loading AI Model...');
      const ok = await aiModelService.initializeModel();
      if (ok) {
        setAiStatus('AI Model Ready');
        setIsAiEnabled(true);
        showNotification('AI model loaded', 'success');
      } else {
        setAiStatus('AI Model Failed');
        setIsAiEnabled(false);
      }
    } catch (e) {
      console.error(e);
      setAiStatus('AI Model Error');
      setIsAiEnabled(false);
    }
  };

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

  const handleConnect = () => connect();
  const handleDisconnect = () => {
    disconnect();
    showNotification('Disconnected from stream', 'success');
  };

  const handleAddressChange = () => {
    // If user edits IP/port, force a clean reconnect
    disconnect();
  };

  const toggleAI = () => {
    if (aiStatus === 'AI Model Not Loaded') {
      initializeAI();
    } else {
      setIsAiEnabled(!isAiEnabled);
      showNotification(isAiEnabled ? 'AI disabled' : 'AI enabled', 'success');
    }
  };

  const showNotification = (message, type) => {
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const handleBackToComponents = () => navigate('/components');

  return (
    <div className="accelerometer-page">
      {/* Header */}
      <div className="header">
        <button
          onClick={() => {
            const mockAiPredictions = {
              motor: { status: "Warning", confidence: 0.85 },
              pulley: { status: "Normal",  confidence: 0.92 },
              belt:   { status: "Faulty",  confidence: 0.78 },
              bearing:{ status: "Normal",  confidence: 0.88 },
              gear:   { status: "Warning", confidence: 0.71 }
            };
            updateDevicesFromAI(mockAiPredictions);
          }}
          className="test-ai-btn"
        >
          Test AI Predictions
        </button>

        <button onClick={handleBackToComponents} className="back-btn">
          <i className="fas fa-arrow-left"></i><span>Back to Components</span>
        </button>

        <h1 className="page-title">{deviceName.toUpperCase()} - VOLTAGE ANALYSIS</h1>
        <div className="spacer"></div>
      </div>

      {/* Main */}
      <div className="main-content">
        {/* Connection Status */}
        <div className="connection-status">
          <div className="status-info">
            <div className="status-item">
              <div className={`status-dot ${streamConnected ? 'connected' : 'disconnected'}`}></div>
              <span>Stream: {streamConnected ? 'Connected' : 'Disconnected'}</span>
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

            <button onClick={toggleAI} className={`ai-toggle ${isAiEnabled ? 'enabled' : 'disabled'}`}>
              {aiStatus === 'AI Model Not Loaded' ? 'Load AI' : (isAiEnabled ? 'AI ON' : 'AI OFF')}
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
              {!streamConnected ? (
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
