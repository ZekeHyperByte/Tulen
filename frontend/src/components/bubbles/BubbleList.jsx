// src/components/bubbles/BubbleList.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../common/LoadingSpinner';
import { showToast } from '../common/Toast';

function BubbleList() {
  const [bubbles, setBubbles] = useState([]);
  const [currentBubble, setCurrentBubble] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const fetchBubbles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/bubbles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setBubbles(data.bubbles);
      setCurrentBubble(data.currentBubble);
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to load bubbles', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBubbles();
  }, []);

  const handleJoinBubble = async (bubbleId) => {
    if (currentBubble) {
      if (!window.confirm('You must leave your current bubble to join a new one. Continue?')) {
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/bubbles/${bubbleId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        showToast('Successfully joined bubble');
        navigate(`/bubble/${bubbleId}`);
      } else {
        showToast('Failed to join bubble', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to join bubble', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveBubble = async () => {
    if (!window.confirm('Are you sure you want to leave this bubble?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/bubbles/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        showToast('Successfully left bubble');
        setCurrentBubble(null);
        fetchBubbles();
      } else {
        showToast('Failed to leave bubble', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to leave bubble', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {bubbles.map(bubble => (
        <div key={bubble.bubble_id} className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-bold mb-2">{bubble.name}</h3>
          <p className="text-gray-600 mb-4">{bubble.description}</p>
          
          {currentBubble?.bubble_id === bubble.bubble_id ? (
            <div className="space-y-2">
              <button
                onClick={() => navigate(`/bubble/${bubble.bubble_id}`)}
                className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Enter Bubble
              </button>
              <button
                onClick={handleLeaveBubble}
                className="w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Leave Bubble
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleJoinBubble(bubble.bubble_id)}
              className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              disabled={isLoading}
            >
              Join Bubble
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default BubbleList;