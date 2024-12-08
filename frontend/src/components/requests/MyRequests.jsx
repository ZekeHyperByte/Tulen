// src/components/requests/MyRequests.jsx
import React, { useState, useEffect } from 'react';
import { showToast } from '../common/Toast';
import LoadingSpinner from '../common/LoadingSpinner';

function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/my-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setRequests(data);
    } catch (error) {
      showToast('Failed to fetch requests', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleEdit = (request) => {
    setEditingRequest({
      ...request,
      specific_topic: request.specific_topic,
      learning_objectives: request.learning_objectives,
      preferred_schedule: request.preferred_schedule
    });
    setShowEditForm(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/study-requests/${editingRequest.request_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(editingRequest)
      });

      if (response.ok) {
        showToast('Request updated successfully');
        setShowEditForm(false);
        setEditingRequest(null);
        fetchRequests();
      } else {
        showToast('Failed to update request', 'error');
      }
    } catch (error) {
      showToast('Failed to update request', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (requestId) => {
    if (!window.confirm('Are you sure you want to delete this request?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/study-requests/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        showToast('Request deleted successfully');
        fetchRequests();
      } else {
        throw new Error('Failed to delete request');
      }
    } catch (error) {
      showToast(error.message || 'Failed to delete request', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this request? The request will be reopened for matching.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/study-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to cancel request');
      }

      showToast('Request cancelled successfully');
      fetchRequests();
    } catch (error) {
      showToast(error.message || 'Failed to cancel request', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && requests.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map(request => (
        <div key={request.request_id} className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg">{request.specific_topic}</h3>
              <p className="text-gray-600">Objectives: {request.learning_objectives}</p>
              <p className="text-gray-600">Schedule: {request.preferred_schedule}</p>
            </div>
            <span className={`px-3 py-1 rounded-full ${
              request.status === 'open' ? 'bg-green-100 text-green-800' : 
              request.status === 'matched' ? 'bg-blue-100 text-blue-800' :
              request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              request.status === 'completed' ? 'bg-gray-100 text-gray-800' :
              'bg-red-100 text-red-800'
            }`}>
              {request.status}
            </span>
          </div>
          
          <div className="mt-4 space-x-2">
            {request.status === 'open' && (
              <button
                onClick={() => handleEdit(request)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner /> : 'Edit'}
              </button>
            )}
            
            {request.status === 'pending' ? (
              <button
                onClick={() => handleCancelRequest(request.request_id)}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner /> : 'Cancel Request'}
              </button>
            ) : request.status === 'open' && (
              <button
                onClick={() => handleDelete(request.request_id)}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner /> : 'Delete'}
              </button>
            )}
          </div>
        </div>
      ))}

      {requests.length === 0 && !isLoading && (
        <div className="text-center text-gray-500">
          No requests found
        </div>
      )}

      {showEditForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Edit Request</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Specific Topic</label>
                <input
                  type="text"
                  value={editingRequest.specific_topic}
                  onChange={(e) => setEditingRequest({...editingRequest, specific_topic: e.target.value})}
                  className="w-full p-2 border rounded"
                  disabled={isLoading}
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Learning Objectives</label>
                <textarea
                  value={editingRequest.learning_objectives}
                  onChange={(e) => setEditingRequest({...editingRequest, learning_objectives: e.target.value})}
                  className="w-full p-2 border rounded"
                  rows="3"
                  disabled={isLoading}
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Preferred Schedule</label>
                <input
                  type="text"
                  value={editingRequest.preferred_schedule}
                  onChange={(e) => setEditingRequest({...editingRequest, preferred_schedule: e.target.value})}
                  className="w-full p-2 border rounded"
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingRequest(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
                  disabled={isLoading}
                >
                  {isLoading ? <LoadingSpinner /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyRequests;