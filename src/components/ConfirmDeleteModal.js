import React from 'react';
import './ConfirmDeleteModal.css'; // Import the dedicated CSS file

const ConfirmDeleteModal = ({ onConfirm, onCancel, deviceName }) => {
  return (
    // Fixed overlay covering the entire screen
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-sm">
        <h2 className="text-2xl font-bold text-white mb-4 text-center">Confirm Deletion</h2>
        <p className="text-gray-300 text-center mb-6">
          Are you sure you want to delete <span className="font-semibold text-red-400">"{deviceName}"</span>?
          This action cannot be undone.
        </p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={onCancel}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
