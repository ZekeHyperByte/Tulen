// src/components/matches/RequestStatusUpdate.jsx
import React, { useState } from 'react';

function RequestStatusUpdate({ requestId, currentStatus, onUpdate }) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const handleComplete = async () => {
    setShowFeedback(true);
  };

  const handleSubmitFeedback = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/requests/${requestId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ rating, feedback })
      });

      if (response.ok) {
        onUpdate();
        setShowFeedback(false);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleCancel = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/requests/${requestId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
      {currentStatus === 'matched' && (
        <div className="flex space-x-2">
          <button
            onClick={handleComplete}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Mark Complete
          </button>
          <button
            onClick={handleCancel}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Cancel Match
          </button>
        </div>
      )}

      {showFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Provide Feedback</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Rating</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full p-2 border rounded"
                >
                  {[5, 4, 3, 2, 1].map(num => (
                    <option key={num} value={num}>{num} Stars</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Feedback</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows="3"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowFeedback(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitFeedback}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RequestStatusUpdate;