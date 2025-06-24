/**
 * AI Model Service for Component Health Prediction
 * Currently using mock predictions - will be replaced with real ONNX.js model
 */

class AIModelService {
  constructor() {
    this.isModelLoaded = false;
    this.model = null;
    this.lastPredictionTime = 0;
    this.predictionInterval = 2000; // Predict every 2 seconds
    this.mockEnabled = true; // Set to false when real model is ready
  }

  /**
   * Initialize the AI model
   * Currently loads mock model - will load ONNX.js model later
   */
  async initializeModel() {
    try {
      console.log('Initializing AI Model...');
      
      if (this.mockEnabled) {
        // Mock initialization
        await this.delay(1000); // Simulate loading time
        this.isModelLoaded = true;
        console.log('Mock AI Model loaded successfully');
        return true;
      } else {
        // TODO: Real ONNX.js model loading
        // import * as ort from 'onnxruntime-web';
        // this.model = await ort.InferenceSession.create('/models/component_classifier.onnx');
        // this.isModelLoaded = true;
        console.log('Real AI Model loaded successfully');
        return true;
      }
    } catch (error) {
      console.error('Failed to load AI model:', error);
      this.isModelLoaded = false;
      return false;
    }
  }

  /**
   * Process FFT data and predict component health
   * @param {Array} frequencies - Array of frequency values
   * @param {Array} magnitudes - Array of magnitude values
   * @returns {Object} Component predictions
   */
  async predictComponentHealth(frequencies, magnitudes) {
    if (!this.isModelLoaded) {
      console.warn('AI Model not loaded yet');
      return null;
    }

    // Throttle predictions to avoid overwhelming
    const now = Date.now();
    if (now - this.lastPredictionTime < this.predictionInterval) {
      return null;
    }
    this.lastPredictionTime = now;

    try {
      if (this.mockEnabled) {
        return this.generateMockPredictions(frequencies, magnitudes);
      } else {
        return this.runRealModel(frequencies, magnitudes);
      }
    } catch (error) {
      console.error('Prediction error:', error);
      return null;
    }
  }

  /**
   * Generate mock predictions for testing
   * @param {Array} frequencies 
   * @param {Array} magnitudes 
   * @returns {Object} Mock predictions
   */
  generateMockPredictions(frequencies, magnitudes) {
    // Simulate some basic analysis based on frequency peaks
    const analysis = this.analyzeFftData(frequencies, magnitudes);
    
    // Component frequencies for reference
    const componentFreqs = {
      motor: 60,
      pulley: 30,
      belt: 15,
      bearing: 120,
      gear: 45
    };

    const predictions = {};
    
    // Generate predictions for each component
    Object.keys(componentFreqs).forEach(component => {
      const targetFreq = componentFreqs[component];
      const peakNearComponent = this.findPeakNearFrequency(frequencies, magnitudes, targetFreq);
      
      // Mock prediction logic
      let confidence = {
        normal: 0.7,
        warning: 0.2,
        faulty: 0.1
      };

      // If there's a significant peak near component frequency, adjust probabilities
      if (peakNearComponent.magnitude > 50) {
        // High peak might indicate issues
        confidence = {
          normal: 0.3,
          warning: 0.4,
          faulty: 0.3
        };
      } else if (peakNearComponent.magnitude > 30) {
        // Medium peak - warning
        confidence = {
          normal: 0.4,
          warning: 0.5,
          faulty: 0.1
        };
      }

      // Add some randomness for demo purposes
      const randomFactor = (Math.random() - 0.5) * 0.2;
      confidence.normal += randomFactor;
      confidence.warning -= randomFactor * 0.5;
      confidence.faulty -= randomFactor * 0.5;

      // Ensure probabilities sum to 1
      const total = confidence.normal + confidence.warning + confidence.faulty;
      Object.keys(confidence).forEach(key => {
        confidence[key] = Math.max(0, confidence[key] / total);
      });

      predictions[component] = confidence;
    });

    console.log('Mock AI Predictions:', predictions);
    return predictions;
  }

  /**
   * Run real ONNX.js model (placeholder)
   * @param {Array} frequencies 
   * @param {Array} magnitudes 
   * @returns {Object} Real model predictions
   */
  async runRealModel(frequencies, magnitudes) {
    // TODO: Implement real model inference
    // const inputTensor = this.preprocessData(frequencies, magnitudes);
    // const results = await this.model.run({'input': inputTensor});
    // return this.postprocessResults(results);
    
    console.log('Real model inference would run here');
    return null;
  }

  /**
   * Convert predictions to component statuses
   * @param {Object} predictions - Raw model predictions
   * @returns {Object} Component statuses
   */
  convertToStatuses(predictions) {
    if (!predictions) return null;

    const statuses = {};
    
    Object.keys(predictions).forEach(component => {
      const confidence = predictions[component];
      
      // Find the status with highest confidence
      let maxConfidence = 0;
      let predictedStatus = 'Normal';
      
      Object.keys(confidence).forEach(status => {
        if (confidence[status] > maxConfidence) {
          maxConfidence = confidence[status];
          predictedStatus = status.charAt(0).toUpperCase() + status.slice(1);
        }
      });
      
      statuses[component] = {
        status: predictedStatus,
        confidence: maxConfidence
      };
    });

    return statuses;
  }

  /**
   * Analyze FFT data for basic insights
   * @param {Array} frequencies 
   * @param {Array} magnitudes 
   * @returns {Object} Analysis results
   */
  analyzeFftData(frequencies, magnitudes) {
    if (!frequencies || !magnitudes || frequencies.length === 0) {
      return { maxPeak: 0, dominantFreq: 0, totalEnergy: 0 };
    }

    let maxMagnitude = 0;
    let maxFreq = 0;
    let totalEnergy = 0;

    for (let i = 0; i < Math.min(frequencies.length, magnitudes.length); i++) {
      const magnitude = parseFloat(magnitudes[i]) || 0;
      totalEnergy += magnitude * magnitude;
      
      if (magnitude > maxMagnitude) {
        maxMagnitude = magnitude;
        maxFreq = parseFloat(frequencies[i]) || 0;
      }
    }

    return {
      maxPeak: maxMagnitude,
      dominantFreq: maxFreq,
      totalEnergy: Math.sqrt(totalEnergy)
    };
  }

  /**
   * Find peak magnitude near a specific frequency
   * @param {Array} frequencies 
   * @param {Array} magnitudes 
   * @param {number} targetFreq 
   * @returns {Object} Peak information
   */
  findPeakNearFrequency(frequencies, magnitudes, targetFreq, tolerance = 5) {
    let maxMagnitude = 0;
    let closestFreq = 0;

    for (let i = 0; i < Math.min(frequencies.length, magnitudes.length); i++) {
      const freq = parseFloat(frequencies[i]) || 0;
      const magnitude = parseFloat(magnitudes[i]) || 0;

      if (Math.abs(freq - targetFreq) <= tolerance) {
        if (magnitude > maxMagnitude) {
          maxMagnitude = magnitude;
          closestFreq = freq;
        }
      }
    }

    return {
      frequency: closestFreq,
      magnitude: maxMagnitude
    };
  }

  /**
   * Utility delay function
   * @param {number} ms 
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get model status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isLoaded: this.isModelLoaded,
      isMock: this.mockEnabled,
      lastPrediction: this.lastPredictionTime
    };
  }
}

// Create singleton instance
export const aiModelService = new AIModelService();
export default aiModelService;