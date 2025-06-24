import React from 'react';
import { useNavigate } from 'react-router-dom';
import './DeviceCard.css'; // Import DeviceCard specific CSS

const DeviceCard = ({ device, onDelete, onUpdateStatus }) => {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status) {
      case 'Normal': return 'bg-green-500';
      case 'Warning': return 'bg-yellow-500';
      case 'Faulty': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'Normal': return 'text-green-800';
      case 'Warning': return 'text-yellow-800';
      case 'Faulty': return 'text-red-800';
      default: return 'text-gray-800';
    }
  };

  const getIconClass = (name) => {
    switch (name.toLowerCase()) {
      case 'motor': return 'fa-cogs'; // More generic gear-like for motor
      case 'pulley': return 'fa-sync-alt'; // Spinning icon
      case 'belt': return 'fa-link'; // Link/chain for belt
      case 'bearing': return 'fa-circle-notch'; // Rotating circle
      case 'gear': return 'fa-cog'; // Single cog
      default: return 'fa-microchip'; // Default icon for custom devices
    }
  };

  const handleStatusChange = (e) => {
    // Stop propagation to prevent card click
    e.stopPropagation();
    console.log(`Updating status for ${device.name} to: ${e.target.value}`);
    if (onUpdateStatus) {
      onUpdateStatus(device.id, e.target.value);
    }
  };

  const handleDeleteClick = (e) => {
    // Stop propagation to prevent card click
    e.stopPropagation();
    console.log(`Attempting to delete ${device.name} (ID: ${device.id})`);
    if (onDelete) {
      onDelete(device.id, device.name);
    }
  };

  const handleCardClick = () => {
    // Navigate to accelerometer page with device name as parameter
    navigate(`/accelerometer?device=${encodeURIComponent(device.name)}`);
  };

  return (
    <div 
      className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center justify-between text-center border-2 border-transparent hover:border-blue-500 transition-all duration-300 transform hover:scale-105 group relative cursor-pointer"
      onClick={handleCardClick}
      title={`View ${device.name} accelerometer data`}
    >
      <button
        onClick={handleDeleteClick}
        className="absolute top-2 right-2 text-red-400 hover:text-red-600 focus:outline-none transition duration-300 opacity-0 group-hover:opacity-100 z-10"
        title="Delete Device"
      >
        <i className="fas fa-times-circle text-xl"></i>
      </button>

      <div className="mb-4">
        {device.imageUrl ? (
          <img
            src={device.imageUrl}
            alt={device.name}
            className="w-20 h-20 object-cover rounded-full mb-2 border-2 border-gray-600"
            // Fallback for broken images: display first two letters of device name
            onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/80x80/374151/d1d5db?text=${device.name.substring(0,2)}`; }}
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mb-2 text-4xl text-gray-400 border-2 border-gray-600">
            <i className={`fas ${getIconClass(device.name)}`}></i>
          </div>
        )}
      </div>
      
      <h3 className="text-xl font-semibold mb-2">{device.name}</h3>
      
      <div className={`px-4 py-1 rounded-full text-sm font-bold ${getStatusColor(device.status)} ${getStatusTextColor(device.status)} mb-3`}>
        {device.status}
      </div>
      
      <p className="text-lg font-bold text-gray-300">{device.health}%</p>

      {/* Visual indicator that card is clickable */}
      <div className="mt-2 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <i className="fas fa-chart-line mr-1"></i>
        View Sensor Data
      </div>

      {/* Dropdown for status update */}
      <select
        value={device.status}
        onChange={handleStatusChange}
        onClick={(e) => e.stopPropagation()} // Prevent card click when interacting with dropdown
        className="mt-4 bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 z-10 relative"
      >
        <option value="Normal">Normal</option>
        <option value="Warning">Warning</option>
        <option value="Faulty">Faulty</option>
      </select>
    </div>
  );
};

export default DeviceCard;