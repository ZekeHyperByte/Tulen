// src/pages/Home.jsx
import React from 'react';

function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Tulen
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Connect with fellow students to learn and teach together
          </p>
          
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-2">Join Study Bubbles</h3>
                <p className="text-gray-600">Connect with students in your field of interest</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-2">Learn & Teach</h3>
                <p className="text-gray-600">Share knowledge and learn from peers</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-2">Customize Learning</h3>
                <p className="text-gray-600">Create specific study requests tailored to your needs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;