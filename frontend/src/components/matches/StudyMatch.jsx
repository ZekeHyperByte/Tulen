// src/components/matches/StudyMatch.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { showToast } from '../common/Toast';
import LoadingSpinner from '../common/LoadingSpinner';

function StudyMatch() {
  const [matches, setMatches] = useState([]);
  const [activeTab, setActiveTab] = useState('teaching');
  const [showActive, setShowActive] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState({
    rating: 5,
    comment: ''
  });

  const fetchMatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/matches/${activeTab}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch matches');
      }
      const data = await response.json();
      setMatches(data);
    } catch (error) {
      showToast('Failed to fetch matches', 'error');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleRequestResponse = async (requestId, accepted) => {
    if (!window.confirm(`Are you sure you want to ${accepted ? 'accept' : 'decline'} this request?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/study-requests/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ accepted })
      });

      if (!response.ok) {
        throw new Error('Failed to respond to request');
      }

      showToast(`Request ${accepted ? 'accepted' : 'declined'} successfully`);
      fetchMatches();
    } catch (error) {
      showToast(`Failed to ${accepted ? 'accept' : 'decline'} request`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async (matchId) => {
    setSelectedMatch(matchId);
    setShowFeedback(true);
  };

  const handleCancel = async (matchId) => {
    if (!window.confirm('Are you sure you want to cancel this match?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/matches/${matchId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to cancel match');
      }

      showToast('Match cancelled successfully');
      fetchMatches();
    } catch (error) {
      showToast('Failed to cancel match', 'error');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitFeedback = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/matches/${selectedMatch}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(feedback)
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      showToast('Match completed successfully');
      setShowFeedback(false);
      setSelectedMatch(null);
      setFeedback({ rating: 5, comment: '' });
      fetchMatches();
    } catch (error) {
      showToast('Failed to complete match', 'error');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && matches.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <div className="flex space-x-4">
          <button 
            onClick={() => setActiveTab('teaching')}
            className={`px-4 py-2 rounded ${activeTab === 'teaching' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            disabled={isLoading}
          >
            Teaching
          </button>
          <button 
            onClick={() => setActiveTab('learning')}
            className={`px-4 py-2 rounded ${activeTab === 'learning' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            disabled={isLoading}
          >
            Learning
          </button>
        </div>
        <button 
          onClick={() => setShowActive(!showActive)}
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
          disabled={isLoading}
        >
          {showActive ? 'Show All' : 'Show Active Only'}
        </button>
      </div>

      <div className="space-y-4">
        {matches
          .filter(match => !showActive || match.match_status === 'active' || match.match_status === 'pending')
          .map(match => (
            <div key={match.match_id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{match.topic}</h3>
                  <p className="text-gray-600">Skill: {match.skill_name}</p>
                  <p className="text-gray-600">Objectives: {match.learning_objectives}</p>
                  <p className="text-gray-600">Schedule: {match.preferred_schedule}</p>
                  <p className="text-gray-600">
                    {activeTab === 'teaching' ? 'Student' : 'Teacher'}: {match.other_user}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full ${
                  match.match_status === 'active' ? 'bg-green-100 text-green-800' : 
                  match.match_status === 'completed' ? 'bg-blue-100 text-blue-800' :
                  match.match_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {match.match_status}
                </span>
              </div>

              {match.match_status === 'pending' && activeTab === 'teaching' && (
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => handleRequestResponse(match.request_id, true)}
                    disabled={isLoading}
                    className="flex-1 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-green-300"
                  >
                    Accept Request
                  </button>
                  <button
                    onClick={() => handleRequestResponse(match.request_id, false)}
                    disabled={isLoading}
                    className="flex-1 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-red-300"
                  >
                    Decline Request
                  </button>
                </div>
              )}

              {match.match_status === 'active' && !isLoading && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleComplete(match.match_id)}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                  >
                    Mark Complete
                  </button>
                  <button
                    onClick={() => handleCancel(match.match_id)}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                  >
                    Cancel Match
                  </button>
                </div>
              )}

              {match.match_status === 'completed' && match.feedback && (
                <div className="mt-4 p-4 bg-gray-50 rounded">
                  <p className="font-semibold">Feedback:</p>
                  <p>{match.feedback}</p>
                </div>
              )}
            </div>
          ))}
        {matches.length === 0 && !isLoading && (
          <div className="text-center text-gray-500">
            No matches found
          </div>
        )}
      </div>

      {showFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Provide Feedback</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Rating</label>
                <select
                  value={feedback.rating}
                  onChange={(e) => setFeedback({...feedback, rating: Number(e.target.value)})}
                  className="w-full p-2 border rounded"
                  disabled={isLoading}
                >
                  {[5, 4, 3, 2, 1].map(num => (
                    <option key={num} value={num}>{num} Stars</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Feedback</label>
                <textarea
                  value={feedback.comment}
                  onChange={(e) => setFeedback({...feedback, comment: e.target.value})}
                  className="w-full p-2 border rounded"
                  rows="3"
                  disabled={isLoading}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowFeedback(false);
                    setSelectedMatch(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={submitFeedback}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
                  disabled={isLoading}
                >
                  {isLoading ? <LoadingSpinner /> : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudyMatch;