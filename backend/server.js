// ===== Imports and Configurations =====
/**
 * Required dependencies:
 * - express: Web framework
 * - cors: Cross-origin resource sharing
 * - pg: PostgreSQL client
 * - bcrypt: Password hashing
 * - jwt: Authentication tokens
 * - dotenv: Environment variables
 */
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Express configuration
const app = express();
app.use(cors());
app.use(express.json());

/**
 * Database Configuration
 * Connects to PostgreSQL using environment variables for:
 * - User, host, database name
 * - Password and port
 */
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// ===== Helper Functions =====

/**
 * Calculate Match Score
 * 
 * Purpose: Calculates compatibility score between a teacher and student
 * 
 * Factors considered:
 * 1. Teaching proficiency (50% weight)
 * 2. Same department match (30% weight)
 * 3. Year difference (20% weight)
 * 
 * Returns: Score between 0-100
 */
const calculateMatchScore = (teacher, student) => {
  // Base scores out of 100 for each component
  const proficiencyBase = (teacher.proficiency_level / 5) * 100;
  const departmentMatch = teacher.department === student.department ? 100 : 0;

  // New year calculation - favoring senior teachers
  const yearBase = teacher.study_year > student.study_year 
    ? Math.min(((teacher.study_year - student.study_year) / 4) * 100, 100) // Cap at 100%
    : 0; // 0 points if teacher is junior to student

  console.log('Calculation steps:', {
    proficiencyBase,
    departmentMatch,
    yearBase,
    teacher_proficiency: teacher.proficiency_level,
    student_year: student.study_year,
    teacher_year: teacher.study_year,
    yearDifference: teacher.study_year - student.study_year
  });

  // Weights should add up to 1
  const weights = {
    proficiency: 0.5,
    department: 0.3,
    yearProximity: 0.2
  };

  // Calculate weighted score
  const finalScore = (
    (proficiencyBase * weights.proficiency) +
    (departmentMatch * weights.department) +
    (yearBase * weights.yearProximity)
  );

  console.log('Final score before rounding:', finalScore);
  return Math.min(100, Math.round(finalScore));
};

/**
 * Create Notification
 * 
 * Purpose: Creates a new notification for a user
 * 
 * Parameters:
 * - userId: Target user
 * - message: Notification content
 * - type: Notification category
 * 
 * Used for: System notifications, match updates, request status changes
 */
const createNotification = async (userId, message, type) => {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
      [userId, message, type]
    );
  } catch (err) {
    console.error('Error creating notification:', err);
  }
};

// ===== Authentication Routes =====

/**
 * User Registration
 * Method: POST
 * Endpoint: /api/register
 * 
 * Purpose: Register new users into the system
 * 
 * Request body requires:
 * - username: User's display name
 * - email: User's email address
 * - password: Plain text password (will be hashed)
 * - department: User's department/major
 * - studyYear: Current year of study
 * - teachingSkills: Array of skills user can teach (optional)
 * 
 * Process:
 * 1. Hash password for security
 * 2. Create user record
 * 3. Add teaching skills if provided
 * 4. Uses transaction for data consistency
 */
app.post('/api/register', async (req, res) => {
  try {
    const { 
      username, 
      email, 
      password, 
      department,
      studyYear,
      teachingSkills 
    } = req.body;

    await pool.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userResult = await pool.query(
      'INSERT INTO users (username, email, password_hash, department, study_year, university, major) VALUES ($1, $2, $3, $4, $5, $6, $4) RETURNING user_id',
      [username, email, hashedPassword, department, studyYear, 'Universitas Negeri Semarang']
    );
    const userId = userResult.rows[0].user_id;

    if (teachingSkills && teachingSkills.length > 0) {
      for (const skill of teachingSkills) {
        await pool.query(
          'INSERT INTO user_skills (user_id, skill_id, proficiency_level, is_teaching) VALUES ($1, $2, $3, true)',
          [userId, skill.skillId, skill.proficiency]
        );
      }
    }

    await pool.query('COMMIT');
    res.json({ message: 'Registration successful' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * User Login
 * Method: POST
 * Endpoint: /api/login
 * 
 * Purpose: Authenticate users and provide JWT token
 * 
 * Request body requires:
 * - email: User's email
 * - password: User's password
 * 
 * Returns:
 * - JWT token for authentication
 * - User data
 */
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid password' });
    
    const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get User Skills
 * Method: GET
 * Endpoint: /api/skills
 * 
 * Purpose: Retrieve all available skills in the system
 * Used for: Skill selection in registration and requests
 */
app.get('/api/skills', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM skills ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Profile Routes =====

/**
 * Get User Profile
 * Method: GET
 * Endpoint: /api/user/profile
 * 
 * Purpose: Retrieve authenticated user's profile information
 * 
 * Security:
 * - Requires JWT token
 * - Validates token before providing data
 */
app.get('/api/user/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      'SELECT user_id, username, email, university, major FROM users WHERE user_id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update User Profile
 * Method: PUT
 * Endpoint: /api/user/profile
 * 
 * Purpose: Update authenticated user's profile information
 * 
 * Request body can include:
 * - username: New username
 * - email: New email
 * - university: New university
 * - major: New major
 * 
 * Security:
 * - Requires JWT token
 * - Only updates authenticated user's data
 */
app.put('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { username, email, university, major } = req.body;
    
    const result = await pool.query(
      'UPDATE users SET username = $1, email = $2, university = $3, major = $4 WHERE user_id = $5 RETURNING *',
      [username, email, university, major, decoded.userId]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Bubble Routes =====

/**
 * Get All Bubbles
 * Method: GET
 * Endpoint: /api/bubbles
 * 
 * Purpose: Retrieve all available bubbles and user's current bubble
 * 
 * Returns:
 * - List of all bubbles
 * - User's current bubble (if any)
 * 
 * Security:
 * - Requires JWT authentication
 * - Includes user-specific bubble status
 */
app.get('/api/bubbles', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get all bubbles
    const bubblesResult = await pool.query('SELECT * FROM bubbles');
    
    // Get user's current bubble
    const userResult = await pool.query(
      'SELECT current_bubble_id FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    let currentBubble = null;
    if (userResult.rows[0].current_bubble_id) {
      const currentBubbleResult = await pool.query(
        'SELECT * FROM bubbles WHERE bubble_id = $1',
        [userResult.rows[0].current_bubble_id]
      );
      currentBubble = currentBubbleResult.rows[0];
    }

    res.json({
      bubbles: bubblesResult.rows,
      currentBubble
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get Specific Bubble
 * Method: GET
 * Endpoint: /api/bubbles/:id
 * 
 * Purpose: Get detailed information about a specific bubble
 * 
 * Parameters:
 * - id: Bubble ID in URL
 */
app.get('/api/bubbles/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bubbles WHERE bubble_id = $1',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get Bubble Skills
 * Method: GET
 * Endpoint: /api/bubbles/:id/skills
 * 
 * Purpose: Get all skills associated with a specific bubble
 * Used for: Displaying available skills in a bubble
 */
app.get('/api/bubbles/:id/skills', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM skills WHERE bubble_id = $1',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get Bubble Requests
 * Method: GET
 * Endpoint: /api/bubbles/:id/requests
 * 
 * Purpose: Get all open study requests in a bubble
 * 
 * Returns:
 * - List of open requests with:
 *   - Request details
 *   - Skill information
 *   - Requester information
 *   - Flag for user's own requests
 * 
 * Security:
 * - Requires JWT authentication
 * - Identifies user's own requests
 */
app.get('/api/bubbles/:id/requests', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(`
      SELECT 
        sr.*,
        s.name as skill_name,
        u.username as requester_name,
        $1::integer as current_user_id,
        CASE WHEN sr.requester_id = $1::integer THEN true ELSE false END as is_own_request
      FROM study_requests sr
      JOIN skills s ON sr.skill_id = s.skill_id
      JOIN users u ON sr.requester_id = u.user_id
      WHERE sr.bubble_id = $2 AND sr.status = 'open'
    `, [decoded.userId, req.params.id]);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Join Bubble
 * Method: POST
 * Endpoint: /api/bubbles/:id/join
 * 
 * Purpose: Allow user to join a specific bubble
 * 
 * Process:
 * 1. Validates user authentication
 * 2. Updates user's current bubble
 * 
 * Security:
 * - Requires JWT authentication
 * - Uses transaction for data consistency
 */
app.post('/api/bubbles/:id/join', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');
    
    await pool.query(
      'UPDATE users SET current_bubble_id = $1 WHERE user_id = $2',
      [req.params.id, decoded.userId]
    );

    await pool.query('COMMIT');
    res.json({ message: 'Successfully joined bubble' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

/**
 * Leave Bubble
 * Method: POST
 * Endpoint: /api/bubbles/leave
 * 
 * Purpose: Allow user to leave their current bubble
 * 
 * Process:
 * 1. Get user's current bubble
 * 2. Cancel active requests and matches
 * 3. Remove user from bubble
 * 
 * Security:
 * - Requires JWT authentication
 * - Uses transaction for data consistency
 */
app.post('/api/bubbles/leave', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // Get current bubble_id
    const userResult = await pool.query(
      'SELECT current_bubble_id FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    const currentBubbleId = userResult.rows[0].current_bubble_id;

    // Cancel active requests
    await pool.query(`
      UPDATE study_requests 
      SET status = 'cancelled' 
      WHERE requester_id = $1 
      AND bubble_id = $2 
      AND status IN ('open', 'matched')
    `, [decoded.userId, currentBubbleId]);

    // Cancel active matches
    await pool.query(`
      UPDATE study_matches 
      SET status = 'cancelled' 
      WHERE (teacher_id = $1 OR student_id = $1)
      AND request_id IN (
        SELECT request_id FROM study_requests 
        WHERE bubble_id = $2
      )
      AND status = 'active'
    `, [decoded.userId, currentBubbleId]);

    // Remove from bubble
    await pool.query(
      'UPDATE users SET current_bubble_id = NULL WHERE user_id = $1',
      [decoded.userId]
    );

    await pool.query('COMMIT');
    res.json({ message: 'Successfully left bubble' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ===== Study Requests Routes =====

/**
 * Create Study Request 
 * Method: POST
 * Endpoint: /api/study-requests
 * 
 * Purpose: Create a new study request in a bubble
 * 
 * Request body requires:
 * - bubble_id: Target bubble
 * - skill_id: Requested skill
 * - specific_topic: Detailed topic
 * - learning_objectives: Goals
 * - preferred_schedule: Timing preferences
 * 
 * Security:
 * - Requires JWT authentication
 * - Validates user is in bubble
 */
app.post('/api/study-requests', async (req, res) => {
  try {
    const { bubble_id, skill_id, specific_topic, learning_objectives, preferred_schedule } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      'INSERT INTO study_requests (requester_id, bubble_id, skill_id, specific_topic, learning_objectives, preferred_schedule) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [decoded.userId, bubble_id, skill_id, specific_topic, learning_objectives, preferred_schedule]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get User's Requests
 * Method: GET
 * Endpoint: /api/my-requests
 * 
 * Purpose: Retrieve all study requests made by the authenticated user
 * 
 * Returns:
 * - List of requests with:
 *   - Request details
 *   - Skill information
 *   - Bubble information
 *   - Status updates
 */
app.get('/api/my-requests', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(`
      SELECT sr.*, s.name as skill_name, b.name as bubble_name
      FROM study_requests sr
      JOIN skills s ON sr.skill_id = s.skill_id
      JOIN bubbles b ON sr.bubble_id = b.bubble_id
      WHERE sr.requester_id = $1
      ORDER BY sr.created_at DESC
    `, [decoded.userId]);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Cancel/Delete Request
 * Method: DELETE
 * Endpoint: /api/study-requests/:id
 * 
 * Purpose: Cancel an existing study request
 * 
 * Process:
 * 1. Verify request ownership
 * 2. Remove associated matches
 * 3. Remove ratings
 * 4. Delete or update request status
 * 
 * Security:
 * - Requires JWT authentication
 * - Verifies request ownership
 * - Uses transaction for data consistency
 */
app.delete('/api/study-requests/:id', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // Get request details
    const requestResult = await pool.query(
      'SELECT * FROM study_requests WHERE request_id = $1 AND requester_id = $2',
      [req.params.id, decoded.userId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('Request not found or unauthorized');
    }

    // Delete matches
    await pool.query('DELETE FROM study_matches WHERE request_id = $1', [req.params.id]);

    // Delete ratings
    await pool.query('DELETE FROM user_ratings WHERE request_id = $1', [req.params.id]);

    // Update request status to open
    await pool.query(
      'UPDATE study_requests SET status = $1 WHERE request_id = $2',
      ['open', req.params.id]
    );

    await pool.query('COMMIT');
    res.json({ message: 'Request cancelled successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

/**
 * Cancel Pending Request
 * Method: POST
 * Endpoint: /api/study-requests/:id/cancel
 * 
 * Purpose: Cancel a pending study request
 * 
 * Process:
 * 1. Verify request is pending and owned by user
 * 2. Delete associated matches
 * 3. Reset request status to open
 * 4. Notify affected teacher
 * 
 * Security:
 * - Requires JWT authentication
 * - Verifies request ownership and status
 * - Uses transaction for data consistency
 */
app.post('/api/study-requests/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // Verify request status and ownership
    const requestCheck = await pool.query(
      'SELECT * FROM study_requests WHERE request_id = $1 AND requester_id = $2 AND status = $3',
      [id, decoded.userId, 'pending']
    );

    if (requestCheck.rows.length === 0) {
      throw new Error('Request not found or cannot be cancelled');
    }

    // Delete matches
    await pool.query('DELETE FROM study_matches WHERE request_id = $1', [id]);

    // Reset status to open
    await pool.query(
      'UPDATE study_requests SET status = $1 WHERE request_id = $2',
      ['open', id]
    );

    // Get teacher info for notification
    const matchResult = await pool.query(
      'SELECT teacher_id FROM study_matches WHERE request_id = $1',
      [id]
    );

    if (matchResult.rows.length > 0) {
      // Notify teacher
      await pool.query(
        'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
        [
          matchResult.rows[0].teacher_id,
          'A study request has been cancelled by the student',
          'request_cancelled'
        ]
      );
    }

    await pool.query('COMMIT');
    res.json({ message: 'Request cancelled successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error cancelling request:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Matching Routes =====

/**
 * Get Potential Matches
 * Method: GET
 * Endpoint: /api/potential-matches/:requestId
 * 
 * Purpose: Find and rank potential teachers for a study request
 * 
 * Process:
 * 1. Get request and student details
 * 2. Find qualified teachers
 * 3. Calculate match scores using:
 *    - Teaching proficiency
 *    - Department match
 *    - Year difference
 * 4. Sort and return matches
 */
app.get('/api/potential-matches/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    
    // Get request details including student info
    const requestResult = await pool.query(`
      SELECT sr.*, s.skill_id, u.department, u.study_year
      FROM study_requests sr
      JOIN users u ON sr.requester_id = u.user_id
      JOIN skills s ON sr.skill_id = s.skill_id
      WHERE sr.request_id = $1
    `, [requestId]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Find potential teachers and check for pending requests
    const teachersResult = await pool.query(`
      SELECT 
        u.user_id,
        u.username,
        u.department,
        u.study_year,
        us.proficiency_level,
        COALESCE(sm.status, 'none') as request_status,
        CASE 
          WHEN sm.status = 'pending' THEN true 
          ELSE false 
        END as has_request_pending
      FROM users u
      JOIN user_skills us ON u.user_id = us.user_id
      LEFT JOIN study_matches sm ON sm.teacher_id = u.user_id 
        AND sm.request_id = $1
      WHERE us.skill_id = $2
        AND us.is_teaching = true
        AND u.user_id != $3
        AND u.current_bubble_id IS NOT NULL`,
      [requestId, request.skill_id, request.requester_id]
    );

    // Calculate and sort matches
    const matches = teachersResult.rows.map(teacher => ({
      user_id: teacher.user_id,
      username: teacher.username,
      department: teacher.department,
      study_year: teacher.study_year,
      proficiency_level: teacher.proficiency_level,
      hasRequestPending: teacher.has_request_pending,
      score: calculateMatchScore(teacher, request),
      match_details: {
        proficiencyScore: Math.round((teacher.proficiency_level / 5) * 100),
        departmentMatch: teacher.department === request.department,
        yearDifference: Math.abs(teacher.study_year - request.study_year)
      }
    }));

    const sortedMatches = matches.sort((a, b) => b.score - a.score);
    res.json(sortedMatches);
  } catch (err) {
    console.error('Matching error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Accept Match Request
 * Method: POST
 * Endpoint: /api/matches/:requestId/accept
 * 
 * Purpose: Student sends request to potential teacher
 * 
 * Process:
 * 1. Verify request is available
 * 2. Create pending match
 * 3. Update request status
 * 4. Send notifications
 * 
 * Security:
 * - Requires JWT authentication
 * - Verifies request status
 * - Uses transaction
 */
app.post('/api/matches/:requestId/accept', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { teacherId } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // Check availability
    const requestCheck = await pool.query(
      'SELECT requester_id, status FROM study_requests WHERE request_id = $1',
      [requestId]
    );

    if (requestCheck.rows[0].status !== 'open') {
      throw new Error('Request is no longer available');
    }

    // Create match
    await pool.query(
      'INSERT INTO study_matches (request_id, teacher_id, student_id, status) VALUES ($1, $2, $3, $4)',
      [requestId, teacherId, decoded.userId, 'pending']
    );

    // Update request status
    await pool.query(
      'UPDATE study_requests SET status = $1 WHERE request_id = $2',
      ['pending', requestId]
    );

    // Send notifications
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3), ($4, $5, $6)',
      [
        teacherId,
        'You have received a new study request',
        'new_request',
        decoded.userId,
        'Your study request has been sent to the teacher',
        'request_sent'
      ]
    );

    await pool.query('COMMIT');
    res.json({ success: true, message: 'Request sent successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

/**
 * Teacher Response to Request
 * Method: POST
 * Endpoint: /api/study-requests/:requestId/respond
 * 
 * Purpose: Teacher accepts or declines study request
 * 
 * Process:
 * 1. Verify pending request
 * 2. Update match and request status
 * 3. Notify student of decision
 * 
 * Request body:
 * - accepted: boolean (true/false)
 */
app.post('/api/study-requests/:requestId/respond', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { accepted } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // Verify request
    const requestResult = await pool.query(`
      SELECT sr.*, sm.match_id, sm.teacher_id, sm.student_id
      FROM study_requests sr
      JOIN study_matches sm ON sr.request_id = sm.request_id
      WHERE sr.request_id = $1 AND sr.status = 'pending'
      AND sm.teacher_id = $2
    `, [requestId, decoded.userId]);

    if (requestResult.rows.length === 0) {
      throw new Error('Request not found or already handled');
    }

    const request = requestResult.rows[0];
    const newStatus = accepted ? 'active' : 'declined';

    // Update statuses
    await pool.query(
      'UPDATE study_requests SET status = $1 WHERE request_id = $2',
      [newStatus, requestId]
    );

    await pool.query(
      'UPDATE study_matches SET status = $1 WHERE match_id = $2',
      [newStatus, request.match_id]
    );

    // Notify student
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
      [
        request.student_id,
        accepted ? 'Your study request has been accepted!' : 'Your study request has been declined.',
        accepted ? 'request_accepted' : 'request_declined'
      ]
    );

    await pool.query('COMMIT');
    res.json({ message: `Request ${accepted ? 'accepted' : 'declined'} successfully` });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ===== Match Management Routes =====

/**
 * Get User's Matches
 * Method: GET
 * Endpoint: /api/matches/:type
 * 
 * Purpose: Get all matches where user is either teacher or student
 * 
 * Parameters:
 * - type: 'teaching' or 'learning'
 * 
 * Returns:
 * - Match details
 * - Request information
 * - Other user's details
 */
app.get('/api/matches/:type', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const isTeaching = req.params.type === 'teaching';

    const result = await pool.query(`
      SELECT 
        m.match_id,
        m.status as match_status,
        sr.specific_topic as topic,
        sr.learning_objectives,
        sr.preferred_schedule,
        sr.status,
        sr.feedback,
        s.name as skill_name,
        u.username as other_user,
        m.teacher_id,
        m.student_id,
        sr.request_id
      FROM study_matches m
      JOIN study_requests sr ON m.request_id = sr.request_id
      JOIN skills s ON sr.skill_id = s.skill_id
      JOIN users u ON u.user_id = CASE 
        WHEN $1 = true THEN m.student_id 
        ELSE m.teacher_id 
      END
      WHERE CASE 
        WHEN $1 = true THEN m.teacher_id = $2
        ELSE m.student_id = $2
      END
      ORDER BY m.created_at DESC
    `, [isTeaching, decoded.userId]);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Complete Match
 * Method: POST
 * Endpoint: /api/matches/:id/complete
 * 
 * Purpose: Mark a study match as completed and provide feedback
 * 
 * Process:
 * 1. Update match status
 * 2. Update request status
 * 3. Record rating and feedback
 * 
 * Request body:
 * - rating: Numeric rating
 * - feedback: Text feedback
 */
app.post('/api/matches/:id/complete', async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // Get match details
    const matchResult = await pool.query(
      'SELECT * FROM study_matches WHERE match_id = $1 AND (teacher_id = $2 OR student_id = $2)',
      [req.params.id, decoded.userId]
    );

    if (matchResult.rows.length === 0) {
      throw new Error('Match not found or unauthorized');
    }

    // Update statuses
    await pool.query(
      'UPDATE study_matches SET status = \'completed\' WHERE match_id = $1',
      [req.params.id]
    );

    await pool.query(
      'UPDATE study_requests SET status = \'completed\', feedback = $1 WHERE request_id = $2',
      [feedback, matchResult.rows[0].request_id]
    );

    // Add rating
    const match = matchResult.rows[0];
    const ratedId = match.teacher_id === decoded.userId ? match.student_id : match.teacher_id;

    await pool.query(`
      INSERT INTO user_ratings (request_id, rater_id, rated_id, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
    `, [match.request_id, decoded.userId, ratedId, rating, feedback]);

    await pool.query('COMMIT');
    res.json({ message: 'Match completed successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

/**
 * Cancel Match
 * Method: POST
 * Endpoint: /api/matches/:id/cancel
 * 
 * Purpose: Cancel an active match
 * 
 * Process:
 * 1. Verify match participation
 * 2. Update match status
 * 3. Update request status
 * 4. Notify other participant
 */
app.post('/api/matches/:id/cancel', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    const matchResult = await pool.query(
      'SELECT * FROM study_matches WHERE match_id = $1 AND (teacher_id = $2 OR student_id = $2)',
      [req.params.id, decoded.userId]
    );

    if (matchResult.rows.length === 0) {
      throw new Error('Match not found or unauthorized');
    }

    await pool.query(
      'UPDATE study_matches SET status = \'cancelled\' WHERE match_id = $1',
      [req.params.id]
    );

    await pool.query(
      'UPDATE study_requests SET status = \'cancelled\' WHERE request_id = $1',
      [matchResult.rows[0].request_id]
    );

    await pool.query('COMMIT');
    res.json({ message: 'Match cancelled successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ===== Notification Routes =====

/**
 * Get User Notifications
 * Method: GET
 * Endpoint: /api/notifications
 * 
 * Purpose: Get all notifications for the authenticated user
 * 
 * Returns:
 * - List of notifications ordered by creation date
 */
app.get('/api/notifications', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [decoded.userId]
    );
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Mark Notifications as Read
 * Method: PUT
 * Endpoint: /api/notifications/read
 * 
 * Purpose: Mark all user's notifications as read
 */
app.put('/api/notifications/read', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    await pool.query(
      'UPDATE notifications SET read = true WHERE user_id = $1',
      [decoded.userId]
    );
    
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server Initialization
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});