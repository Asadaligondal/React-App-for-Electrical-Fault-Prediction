import React, { useState } from 'react';
import './AddDeviceModal.css'; // Import the dedicated CSS file

const AddDeviceModal = ({ onClose, onSave }) => {
  const [deviceName, setDeviceName] = useState('');
  const [deviceIpAddress, setDeviceIpAddress] = useState('');
  const [deviceImageUrl, setDeviceImageUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const validateIpAddress = (ip) => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  const handleSubmit = () => {
    if (!deviceName.trim()) {
      setErrorMessage('Device name cannot be empty.');
      return;
    }

    if (!deviceIpAddress.trim()) {
      setErrorMessage('IP address cannot be empty.');
      return;
    }

    if (!validateIpAddress(deviceIpAddress)) {
      setErrorMessage('Please enter a valid IP address (e.g., 192.168.1.100).');
      return;
    }

    setErrorMessage('');
    
    // Call the onSave prop with the new device data
    onSave({ 
      name: deviceName, 
      ipAddress: deviceIpAddress,
      imageUrl: deviceImageUrl, 
      status: 'Normal', 
      health: 100 
    });
    
    onClose(); // Close the modal after saving
  };

  return (
    // Fixed overlay covering the entire screen
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Add New Device</h2>
        
        <div className="mb-4">
          <label htmlFor="deviceName" className="block text-gray-300 text-sm font-bold mb-2">
            Device Name:
          </label>
          <input
            type="text"
            id="deviceName"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600 placeholder-gray-400 text-white"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="e.g., HVAC Unit, Compressor"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="deviceIpAddress" className="block text-gray-300 text-sm font-bold mb-2">
            Raspberry Pi IP Address:
          </label>
          <input
            type="text"
            id="deviceIpAddress"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600 placeholder-gray-400 text-white"
            value={deviceIpAddress}
            onChange={(e) => setDeviceIpAddress(e.target.value)}
            placeholder="e.g., 192.168.1.100"
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="deviceImageUrl" className="block text-gray-300 text-sm font-bold mb-2">
            Image URL (Optional):
          </label>
          <input
            type="text"
            id="deviceImageUrl"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600 placeholder-gray-400 text-white"
            value={deviceImageUrl}
            onChange={(e) => setDeviceImageUrl(e.target.value)}
            placeholder="e.g., https://example.com/device.png"
          />
        </div>

        {errorMessage && (
          <p className="text-red-400 text-sm mb-4 text-center">{errorMessage}</p>
        )}

        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out"
          >
            Add Device
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddDeviceModal;