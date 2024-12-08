// src/components/bubbles/BubbleDetails.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { showToast } from '../common/Toast';
import LoadingSpinner from '../common/LoadingSpinner';
import PotentialMatches from '../matches/PotentialMatches';

function BubbleDetails() {
  const { id } = useParams();
  const [bubble, setBubble] = useState(null);
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [skills, setSkills] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newRequest, setNewRequest] = useState({
    skill_id: '',
    specific_topic: '',
    learning_objectives: '',
    preferred_schedule: ''
  });

  const fetchBubbleData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [bubbleRes, skillsRes, requestsRes] = await Promise.all([
        fetch(`http://localhost:5000/api/bubbles/${id}`),
        fetch(`http://localhost:5000/api/bubbles/${id}/skills`),
        fetch(`http://localhost:5000/api/bubbles/${id}/requests`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
      ]);

      const [bubbleData, skillsData, requestsData] = await Promise.all([
        bubbleRes.json(),
        skillsRes.json(),
        requestsRes.json()
      ]);

      setBubble(bubbleData);
      setSkills(skillsData);
      setRequests(requestsData);
    } catch (error) {
      showToast('Failed to load bubble data', 'error');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBubbleData();
  }, [fetchBubbleData]);

  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) {
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

      if (!response.ok) {
        throw new Error('Failed to cancel request');
      }

      showToast('Request cancelled successfully');
      fetchBubbleData();
    } catch (error) {
      showToast('Failed to cancel request', 'error');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/study-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...newRequest,
          bubble_id: id
        })
      });
      
      if (response.ok) {
        showToast('Study request created successfully');
        setShowForm(false);
        setNewRequest({
          skill_id: '',
          specific_topic: '',
          learning_objectives: '',
          preferred_schedule: ''
        });
        fetchBubbleData();
      } else {
        showToast('Failed to create request', 'error');
      }
    } catch (error) {
      showToast('Failed to create request', 'error');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespond = async (requestId) => {
    if (window.confirm('Are you sure you want to help with this request?')) {
      setIsLoading(true);
      try {
        const response = await fetch(`http://localhost:5000/api/matches`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ request_id: requestId })
        });

        if (response.ok) {
          showToast('Successfully offered to help!');
          fetchBubbleData();
        } else {
          showToast('Failed to respond to request', 'error');
        }
      } catch (error) {
        showToast('Failed to respond to request', 'error');
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isLoading && !bubble) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!bubble) return <div>Bubble not found</div>;

  return (
    <div className="p-6 relative min-h-screen">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{bubble.name}</h2>
        <p className="text-gray-600">{bubble.description}</p>
      </div>
      
      <div className="space-y-4 mb-20">
        {requests.map(request => (
          <div key={request.request_id} className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{request.specific_topic}</h3>
                <p className="text-gray-600">Posted by: {request.requester_name}</p>
                <p className="text-gray-600">Skill: {request.skill_name}</p>
                <p className="text-gray-600">Objectives: {request.learning_objectives}</p>
                <p className="text-gray-600">Schedule: {request.preferred_schedule}</p>
              </div>
              <span className={`px-3 py-1 rounded-full ${
                request.status === 'open' ? 'bg-green-100 text-green-800' : 
                request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                request.status === 'matched' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {request.status}
              </span>
            </div>

            {/* Show potential matches for own requests */}
            {request.is_own_request && request.status === 'open' && (
              <div className="mt-4 border-t pt-4">
                <PotentialMatches requestId={request.request_id} />
              </div>
            )}

            {/* Show cancel button for pending requests */}
            {request.is_own_request && request.status === 'pending' && (
              <div className="mt-4">
                <button
                  onClick={() => handleCancelRequest(request.request_id)}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                  disabled={isLoading}
                >
                  Cancel Request
                </button>
              </div>
            )}

            {/* Show response button for others' open requests */}
            {request.status === 'open' && !request.is_own_request && !isLoading && (
              <button
                onClick={() => handleRespond(request.request_id)}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Interested to Help
              </button>
            )}
          </div>
        ))}
        {requests.length === 0 && !isLoading && (
          <div className="text-center text-gray-500">
            No requests found in this bubble
          </div>
        )}
      </div>

      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-6 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600"
      >
        + New Request
      </button>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Create Study Request</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Select Skill</label>
                <select 
                  value={newRequest.skill_id}
                  onChange={(e) => setNewRequest({...newRequest, skill_id: e.target.value})}
                  className="w-full p-2 border rounded"
                  required
                  disabled={isLoading}
                >
                  <option value="">Select a skill</option>
                  {skills.map(skill => (
                    <option key={skill.skill_id} value={skill.skill_id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Specific Topic</label>
                <input
                  type="text"
                  value={newRequest.specific_topic}
                  onChange={(e) => setNewRequest({...newRequest, specific_topic: e.target.value})}
                  className="w-full p-2 border rounded"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Learning Objectives</label>
                <textarea
                  value={newRequest.learning_objectives}
                  onChange={(e) => setNewRequest({...newRequest, learning_objectives: e.target.value})}
                  className="w-full p-2 border rounded"
                  rows="3"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Preferred Schedule</label>
                <input
                  type="text"
                  value={newRequest.preferred_schedule}
                  onChange={(e) => setNewRequest({...newRequest, preferred_schedule: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="e.g., Weekdays after 5PM"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
                  {isLoading ? <LoadingSpinner /> : 'Create Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BubbleDetails;