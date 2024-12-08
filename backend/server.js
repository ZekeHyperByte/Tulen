const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

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

  // Return rounded score, making sure it's between 0 and 100
  return Math.min(100, Math.round(finalScore));
};

// Register routes
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
    
    // Use department as major
    const userResult = await pool.query(
      'INSERT INTO users (username, email, password_hash, department, study_year, university, major) VALUES ($1, $2, $3, $4, $5, $6, $4) RETURNING user_id',
      [username, email, hashedPassword, department, studyYear, 'Universitas Negeri Semarang']
    );
    const userId = userResult.rows[0].user_id;

    // Add teaching skills
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

app.get('/api/skills', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM skills ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Login routes
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

// Profile routes
app.get('/api/user/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT user_id, username, email, university, major FROM users WHERE user_id = $1', [decoded.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// Bubbles and Skills routes
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

app.get('/api/bubbles/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bubbles WHERE bubble_id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bubbles/:id/skills', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM skills WHERE bubble_id = $1', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// Join bubble
app.post('/api/bubbles/:id/join', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');
    
    // Update user's current bubble
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

// Leave bubble
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

    // Cancel all active requests in this bubble
    await pool.query(`
      UPDATE study_requests 
      SET status = 'cancelled' 
      WHERE requester_id = $1 
      AND bubble_id = $2 
      AND status IN ('open', 'matched')
    `, [decoded.userId, currentBubbleId]);

    // Cancel all active matches in this bubble
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

    // Remove user from bubble
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

// Study Requests routes
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

app.delete('/api/study-requests/:id', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // Delete any matches
    await pool.query('DELETE FROM study_matches WHERE request_id = $1', [req.params.id]);

    // Delete any ratings
    await pool.query('DELETE FROM user_ratings WHERE request_id = $1', [req.params.id]);

    // Delete the request itself
    const result = await pool.query(
      'DELETE FROM study_requests WHERE request_id = $1 AND requester_id = $2 RETURNING *',
      [req.params.id, decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Request not found or unauthorized');
    }

    await pool.query('COMMIT');
    res.json({ message: 'Request deleted successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/study-requests/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // First check if the request exists and belongs to the user
    const requestCheck = await pool.query(
      'SELECT * FROM study_requests WHERE request_id = $1 AND requester_id = $2 AND status = $3',
      [id, decoded.userId, 'pending']
    );

    if (requestCheck.rows.length === 0) {
      throw new Error('Request not found or cannot be cancelled');
    }

    // Delete any existing matches
    await pool.query('DELETE FROM study_matches WHERE request_id = $1', [id]);

    // Update the request status back to open
    await pool.query(
      'UPDATE study_requests SET status = $1 WHERE request_id = $2',
      ['open', id]
    );

    // Get the teacher's ID to send notification
    const matchResult = await pool.query(
      'SELECT teacher_id FROM study_matches WHERE request_id = $1',
      [id]
    );

    if (matchResult.rows.length > 0) {
      // Create notification for the teacher
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

app.post('/api/study-requests/:requestId/respond', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { accepted } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // Verify the request exists and is pending
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

    // Update request status
    await pool.query(
      'UPDATE study_requests SET status = $1 WHERE request_id = $2',
      [newStatus, requestId]
    );

    // Update match status
    await pool.query(
      'UPDATE study_matches SET status = $1 WHERE match_id = $2',
      [newStatus, request.match_id]
    );

    // Create notification for the student
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
      [
        request.student_id,
        accepted 
          ? 'Your study request has been accepted! You can now start learning.' 
          : 'Your study request has been declined.',
        accepted ? 'request_accepted' : 'request_declined'
      ]
    );

    await pool.query('COMMIT');
    res.json({ message: `Request ${accepted ? 'accepted' : 'declined'} successfully` });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error responding to request:', err);
    res.status(500).json({ error: err.message });
  }
});

//MyRequest routes
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

// Matches routes
app.post('/api/matches', async (req, res) => {
  try {
    const { request_id } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // Check if request is still open
    const requestCheck = await pool.query(
      'SELECT requester_id, specific_topic FROM study_requests WHERE request_id = $1 AND status = \'open\'',
      [request_id]
    );

    if (requestCheck.rows.length === 0) {
      throw new Error('Request not available');
    }

    // Create match
    const matchResult = await pool.query(`
      INSERT INTO study_matches (request_id, teacher_id, student_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [request_id, decoded.userId, requestCheck.rows[0].requester_id]);

    // Update request status
    await pool.query(
      'UPDATE study_requests SET status = \'matched\' WHERE request_id = $1',
      [request_id]
    );

    // Create notifications for both users
    await pool.query(`
      INSERT INTO notifications (user_id, message, type)
      VALUES 
        ($1, $2, 'match_created'),
        ($3, $4, 'match_created')
    `, [
      decoded.userId,
      `You have been matched as a teacher for "${requestCheck.rows[0].specific_topic}"`,
      requestCheck.rows[0].requester_id,
      `A teacher has been found for your request "${requestCheck.rows[0].specific_topic}"`
    ]);

    await pool.query('COMMIT');
    res.json(matchResult.rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/matches/:id/cancel', async (req, res) => {
  try {
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

    // Update match status
    await pool.query(
      'UPDATE study_matches SET status = \'cancelled\' WHERE match_id = $1',
      [req.params.id]
    );

    // Update request status
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

    // Update match status
    await pool.query(
      'UPDATE study_matches SET status = \'completed\' WHERE match_id = $1',
      [req.params.id]
    );

    // Update request status
    await pool.query(
      'UPDATE study_requests SET status = \'completed\', feedback = $1 WHERE request_id = $2',
      [feedback, matchResult.rows[0].request_id]
    );

    // Add rating
    const ratedId = matchResult.rows[0].teacher_id === decoded.userId 
      ? matchResult.rows[0].student_id 
      : matchResult.rows[0].teacher_id;

    await pool.query(`
      INSERT INTO user_ratings (request_id, rater_id, rated_id, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
    `, [matchResult.rows[0].request_id, decoded.userId, ratedId, rating, feedback]);

    await pool.query('COMMIT');
    res.json({ message: 'Match completed successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

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

app.post('/api/matches/:id/complete', async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // Update match status
    await pool.query(
      'UPDATE study_matches SET status = \'completed\' WHERE match_id = $1',
      [req.params.id]
    );

    // Update request status
    const matchResult = await pool.query(
      'SELECT request_id, teacher_id, student_id FROM study_matches WHERE match_id = $1',
      [req.params.id]
    );

    if (matchResult.rows.length === 0) {
      throw new Error('Match not found');
    }

    await pool.query(
      'UPDATE study_requests SET status = \'completed\', feedback = $1 WHERE request_id = $2',
      [comment, matchResult.rows[0].request_id]
    );

    // Add rating
    const match = matchResult.rows[0];
    const ratedId = match.teacher_id === decoded.userId ? match.student_id : match.teacher_id;

    await pool.query(`
      INSERT INTO user_ratings (request_id, rater_id, rated_id, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
    `, [match.request_id, decoded.userId, ratedId, rating, comment]);

    await pool.query('COMMIT');
    res.json({ message: 'Match completed successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/matches/:requestId/accept', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { teacherId } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query('BEGIN');

    // Check if request is still open
    const requestCheck = await pool.query(
      'SELECT requester_id, status FROM study_requests WHERE request_id = $1',
      [requestId]
    );

    if (requestCheck.rows.length === 0) {
      throw new Error('Request not found');
    }

    if (requestCheck.rows[0].status !== 'open') {
      throw new Error('Request is no longer available');
    }

    // Update request status to pending
    await pool.query(
      'UPDATE study_requests SET status = $1 WHERE request_id = $2',
      ['pending', requestId]
    );

    // Create match record
    await pool.query(
      'INSERT INTO study_matches (request_id, teacher_id, student_id, status) VALUES ($1, $2, $3, $4)',
      [requestId, teacherId, decoded.userId, 'pending']
    );

    // Create notifications
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

    // Return success response
    res.json({ 
      success: true,
      message: 'Request sent successfully' 
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error sending request:', err);
    res.status(500).json({ 
      error: err.message || 'Failed to send request'
    });
  }
});


//Notifications routes
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

// Function to create notifications
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

//PotentialMatches routes
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

    // Calculate matches with proper scoring
    const matches = teachersResult.rows.map(teacher => {
      return {
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
      };
    });

    // Sort matches by score in descending order
    const sortedMatches = matches.sort((a, b) => b.score - a.score);

    res.json(sortedMatches);
  } catch (err) {
    console.error('Matching error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});