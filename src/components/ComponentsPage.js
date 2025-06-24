import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevices } from './DevicesContext';
import './ComponentsPage.css';
import DeviceCard from './DeviceCard';
import AddDeviceModal from './AddDeviceModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';

const ComponentsPage = () => {
  const navigate = useNavigate();
  
  // Use context instead of local state for devices
  const { 
    devices, 
    addDevice, 
    deleteDevice, 
    updateDeviceStatus, 
    deviceCount 
  } = useDevices();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState(null); // Stores { id, name } of device to delete

  // Function to initiate delete (opens the confirmation modal)
  const handleDeleteInitiate = (id, name) => {
    setDeviceToDelete({ id, name }); // Store the ID and name of the device to be deleted
    setShowConfirmDeleteModal(true); // Show the confirmation modal
  };

  // Function to confirm delete and execute the deletion
  const handleDeleteConfirm = () => {
    if (deviceToDelete) {
      console.log(`Deleting device: ${deviceToDelete.name} (ID: ${deviceToDelete.id})`);
      deleteDevice(deviceToDelete.id); // Use context function
      setShowConfirmDeleteModal(false); // Close the confirmation modal
      setDeviceToDelete(null); // Clear the device to delete state
    }
  };

  // Function to cancel delete
  const handleDeleteCancel = () => {
    setShowConfirmDeleteModal(false); // Close the confirmation modal
    setDeviceToDelete(null); // Clear the device to delete state
  };

  const handleUpdateDeviceStatus = (id, newStatus) => {
    console.log(`Updating device ID: ${id} to status: ${newStatus}`);
    updateDeviceStatus(id, newStatus); // Use context function
  };

  const handleAddNewDevice = (newDevice) => {
    addDevice(newDevice); // Use context function
  };

  const handleNavigateHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 font-inter">
      {/* Header with home navigation */}
      <div className="w-full max-w-7xl flex justify-between items-center mb-8">
        <button
          onClick={handleNavigateHome}
          className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors duration-200"
        >
          <i className="fas fa-home"></i>
          <span>Home</span>
        </button>
        
        <h2 className="text-4xl md:text-5xl font-bold text-center flex-1">
          SYSTEM COMPONENTS STATUS
        </h2>
        
        <div className="w-20"></div> {/* Spacer for centering */}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 mb-10 w-full max-w-7xl">
        {devices.map(device => (
          <DeviceCard
            key={device.id}
            device={device}
            onDelete={handleDeleteInitiate} // Pass the new initiate function
            onUpdateStatus={handleUpdateDeviceStatus}
          />
        ))}

        {/* Add New Device Card Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-gray-700 border-2 border-dashed border-gray-600 rounded-xl shadow-lg flex flex-col items-center justify-center p-6 text-center h-full min-h-[200px] transition-all duration-300 hover:bg-gray-600 hover:border-blue-500 group"
        >
          <div className="text-6xl text-gray-400 group-hover:text-blue-300 transition-colors duration-300">
            <i className="fas fa-plus-circle"></i>
          </div>
          <p className="mt-4 text-xl font-semibold text-gray-300 group-hover:text-white transition-colors duration-300">
            Add New Device
          </p>
        </button>
      </div>

      <button
        onClick={() => setShowAddModal(true)}
        className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
      >
        Add New Devices
      </button>

      {/* Render the AddDeviceModal conditionally */}
      {showAddModal && (
        <AddDeviceModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddNewDevice}
        />
      )}

      {/* Render the ConfirmDeleteModal conditionally */}
      {showConfirmDeleteModal && deviceToDelete && (
        <ConfirmDeleteModal
          deviceName={deviceToDelete.name} // Pass the name to display in the modal
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}

      <footer className="mt-20 text-gray-400 text-sm text-center w-full">
        <div className="flex justify-center space-x-6 mb-2">
          <button onClick={handleNavigateHome} className="hover:text-white transition duration-200">Home</button>
          <a href="javascript:void(0)" className="hover:text-white transition duration-200">About</a>
          <a href="javascript:void(0)" className="hover:text-white transition duration-200">Contact Us</a>
          <a href="javascript:void(0)" className="hover:text-white transition duration-200">Our team</a>
        </div>
        <p>&copy; 2025, My Company</p>
      </footer>
    </div>
  );
};

export default ComponentsPage;