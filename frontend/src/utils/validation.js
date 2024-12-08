// src/utils/validation.js
export const validateStudyRequest = (data) => {
    const errors = {};
  
    if (!data.specific_topic?.trim()) {
      errors.specific_topic = 'Topic is required';
    }
  
    if (!data.learning_objectives?.trim()) {
      errors.learning_objectives = 'Learning objectives are required';
    }
  
    if (!data.preferred_schedule?.trim()) {
      errors.preferred_schedule = 'Schedule is required';
    }
  
    if (!data.skill_id) {
      errors.skill_id = 'Skill is required';
    }
  
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };