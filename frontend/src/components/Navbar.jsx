// src/components/Navbar.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Notifications from './Notifications';

function Navbar() {
  const navigate = useNavigate();
  const isLoggedIn = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="cursor-pointer" onClick={() => navigate('/')}>
            <span className="text-xl font-bold">Tulen</span>
          </div>
          
          <div className="flex items-center space-x-4">
            {isLoggedIn ? (
              <>
                <button onClick={() => navigate('/dashboard')} className="px-3 py-2 hover:text-blue-500">
                  Dashboard
                </button>
                <button onClick={() => navigate('/profile')} className="px-3 py-2 hover:text-blue-500">
                  Profile
                </button>
                <Notifications />
                <button onClick={handleLogout} className="px-3 py-2 hover:text-red-500">
                  Logout
                </button>
              </>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="px-3 py-2 hover:text-blue-500">
                  Login
                </button>
                <button onClick={() => navigate('/signup')} className="px-3 py-2 hover:text-blue-500">
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;