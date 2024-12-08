// src/components/matches/PotentialMatches.jsx
import React, { useState, useCallback } from 'react';
import { showToast } from '../common/Toast';
import LoadingSpinner from '../common/LoadingSpinner';

function PotentialMatches({ requestId }) {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState(null);
  const [error, setError] = useState(null);

  const getScoreColor = (score) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-blue-600';
    return 'text-gray-600';
  };

  const fetchPotentialMatches = useCallback(async () => {
    if (!requestId) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:5000/api/potential-matches/${requestId}`, {
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
      setError(error.message);
      showToast('Failed to fetch potential matches', 'error');
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  React.useEffect(() => {
    fetchPotentialMatches();
  }, [fetchPotentialMatches]);

  const sendRequest = async (teacherId) => {
    if (!window.confirm('Are you sure you want to send a study request to this teacher?')) {
      return;
    }

    setPendingRequestId(teacherId);
    try {
      const response = await fetch(`http://localhost:5000/api/matches/${requestId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ teacherId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send request');
      }

      showToast('Study request sent successfully!');
      fetchPotentialMatches(); // Refresh the list
    } catch (error) {
      showToast(error.message || 'Failed to send study request', 'error');
      console.error('Send request error:', error);
    } finally {
      setPendingRequestId(null);
    }
  };

  const cancelRequest = async (teacherId) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/matches/${requestId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ teacherId })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel request');
      }

      showToast('Request cancelled successfully');
      fetchPotentialMatches(); // Refresh the list
    } catch (error) {
      showToast('Failed to cancel request', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && matches.length === 0) {
    return (
      <div className="flex justify-center items-center p-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        Error loading matches: {error}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="text-gray-500 text-center p-4">
        No potential matches found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Recommended Teachers</h3>
      {matches.map(match => (
        <div key={match.user_id} className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium text-gray-900">{match.username}</h4>
              <p className="text-sm text-gray-600">Department: {match.department}</p>
              <p className="text-sm text-gray-600">Year: {match.study_year}</p>
              <p className="text-sm text-gray-600">Proficiency: {match.proficiency_level}/5</p>
            </div>
            <div className={`text-right ${getScoreColor(match.score)}`}>
              <p className="font-bold">{(match.score).toFixed(0)}%</p>
              <p className="text-sm">Match Score</p>
            </div>
          </div>
          
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              {match.score >= 0.8 ? 'Excellent Match!' :
               match.score >= 0.6 ? 'Good Match' :
               'Potential Match'}
            </p>
            <div className="mt-2 text-sm text-gray-600">
              <p>Match Details:</p>
              <ul className="list-disc ml-4">
                <li>Proficiency Score: {(match.match_details.proficiencyScore).toFixed(0)}%</li>
                <li>Department: {match.match_details.departmentMatch ? 'Same Department ✓' : 'Different Department'}</li>
                <li>Year Difference: {match.match_details.yearDifference} year(s)</li>
              </ul>
            </div>
          </div>

          {match.hasRequestPending ? (
            <div className="mt-4 space-y-2">
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm text-yellow-800">
                Request pending - Waiting for teacher's response
              </div>
              <button
                onClick={() => cancelRequest(match.user_id)}
                disabled={isLoading}
                className="w-full py-2 px-4 rounded-md text-red-600 border border-red-600 hover:bg-red-50 transition-colors"
              >
                Cancel Request
              </button>
            </div>
          ) : (
            <button
              onClick={() => sendRequest(match.user_id)}
              disabled={isLoading || pendingRequestId === match.user_id}
              className={`mt-4 w-full py-2 px-4 rounded-md text-white transition-colors
                ${pendingRequestId === match.user_id 
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              {pendingRequestId === match.user_id ? (
                <div className="flex items-center justify-center space-x-2">
                  <LoadingSpinner />
                  <span>Sending Request...</span>
                </div>
              ) : (
                'Send Study Request'
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default PotentialMatches;