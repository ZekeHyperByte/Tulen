// src/components/auth/SignUpForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../common/LoadingSpinner';
import { showToast } from '../common/Toast';

function SignUpForm() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [skills, setSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    studyYear: ''
  });

  const getSkillsForDepartment = (department) => {
    switch (department) {
      case 'Computer Science':
        return [
          'Python Programming',
          'Java Programming',
          'Database Management',
          'Web Development'
        ];
      case 'Mathematics':
        return [
          'Calculus',
          'Linear Algebra',
          'Statistics',
          'Discrete Mathematics'
        ];
      case 'Physics':
        return [
          'Classical Mechanics',
          'Thermodynamics',
          'Quantum Physics'
        ];
      default:
        return [];
    }
  };

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/skills');
        const data = await response.json();
        setSkills(data);
      } catch (error) {
        showToast('Failed to load skills', 'error');
      }
    };
    fetchSkills();
  }, []);

  const addNewSkill = () => {
    setSelectedSkills([...selectedSkills, { 
      id: Date.now(),
      skillId: '', 
      proficiency: '' 
    }]);
  };

  const removeSkill = (id) => {
    setSelectedSkills(selectedSkills.filter(skill => skill.id !== id));
  };

  const updateSkill = (id, field, value) => {
    setSelectedSkills(selectedSkills.map(skill => 
      skill.id === id ? { ...skill, [field]: value } : skill
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    // Validate that all selected skills have both skill and proficiency
    const invalidSkills = selectedSkills.some(skill => !skill.skillId || !skill.proficiency);
    if (invalidSkills) {
      showToast('Please complete all skill selections', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          studyYear: parseInt(formData.studyYear),
          teachingSkills: selectedSkills.map(({ skillId, proficiency }) => ({
            skillId: parseInt(skillId),
            proficiency: parseInt(proficiency)
          }))
        })
      });

      if (response.ok) {
        showToast('Registration successful!');
        navigate('/login');
      } else {
        const error = await response.json();
        showToast(error.error, 'error');
      }
    } catch (error) {
      showToast('Registration failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const departments = [
    'Computer Science',
    'Mathematics',
    'Physics'
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">Create your account</h2>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Department</label>
              <select
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={formData.department}
                onChange={(e) => {
                  setFormData({...formData, department: e.target.value});
                  setSelectedSkills([]); // Clear skills when department changes
                }}
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Study Year</label>
              <select
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={formData.studyYear}
                onChange={(e) => setFormData({...formData, studyYear: e.target.value})}
              >
                <option value="">Select Year</option>
                {[1, 2, 3, 4].map(year => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>
            </div>

            {formData.department && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teaching Skills
                </label>
                <div className="space-y-3">
                  {selectedSkills.map((skill) => (
                    <div key={skill.id} className="flex items-center space-x-2">
                      <select
                        className="flex-1 rounded border-gray-300 py-2"
                        value={skill.skillId}
                        onChange={(e) => updateSkill(skill.id, 'skillId', e.target.value)}
                      >
                        <option value="">Select Skill</option>
                        {skills
                          .filter(s => getSkillsForDepartment(formData.department).includes(s.name))
                          .map(s => (
                            <option key={s.skill_id} value={s.skill_id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                      
                      {skill.skillId && (
                        <select
                          className="w-32 rounded border-gray-300 py-2"
                          value={skill.proficiency}
                          onChange={(e) => updateSkill(skill.id, 'proficiency', e.target.value)}
                        >
                          <option value="">Level</option>
                          {[1, 2, 3, 4, 5].map(level => (
                            <option key={level} value={level}>
                              Level {level}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => removeSkill(skill.id)}
                        className="text-red-500 hover:text-red-700 px-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={addNewSkill}
                    className="flex items-center text-blue-500 hover:text-blue-700"
                  >
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Skill
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                type="password"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isLoading ? <LoadingSpinner /> : 'Sign up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SignUpForm;