// src/pages/Dashboard.jsx
import React, { useState } from 'react';
import BubbleList from '../components/bubbles/BubbleList';
import MyRequests from '../components/requests/MyRequests';
import StudyMatch from '../components/matches/StudyMatch';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('bubbles');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex mb-6 space-x-4">
          <button 
            onClick={() => setActiveTab('bubbles')}
            className={`px-4 py-2 rounded ${activeTab === 'bubbles' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Bubbles
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded ${activeTab === 'requests' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            My Requests
          </button>
          <button 
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-2 rounded ${activeTab === 'matches' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            My Matches
          </button>
        </div>

        {activeTab === 'bubbles' && <BubbleList />}
        {activeTab === 'requests' && <MyRequests />}
        {activeTab === 'matches' && <StudyMatch />}
      </div>
    </div>
  );
}

export default Dashboard;