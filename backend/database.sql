CREATE DATABASE tulen_db;

\c tulen_db

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    university VARCHAR(100) NOT NULL,
    major VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE skills (
    skill_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE user_skills (
    user_id INTEGER REFERENCES users(user_id),
    skill_id INTEGER REFERENCES skills(skill_id),
    is_teaching BOOLEAN NOT NULL,
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),
    PRIMARY KEY (user_id, skill_id, is_teaching)
);

CREATE TABLE bubbles (
    bubble_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE bubble_members (
    bubble_id INTEGER REFERENCES bubbles(bubble_id),
    user_id INTEGER REFERENCES users(user_id),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (bubble_id, user_id)
);

CREATE TABLE study_requests (
    request_id SERIAL PRIMARY KEY,
    requester_id INTEGER REFERENCES users(user_id),
    skill_id INTEGER REFERENCES skills(skill_id),
    bubble_id INTEGER REFERENCES bubbles(bubble_id),
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Department Skills table
CREATE TABLE department_skills (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(100) UNIQUE NOT NULL
);

-- Notifications table
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    message TEXT NOT NULL,
    type VARCHAR(50),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skill Relationships table (for related skills)
CREATE TABLE skill_relationships (
    skill_id INTEGER REFERENCES skills(skill_id),
    related_skill_id INTEGER REFERENCES skills(skill_id),
    relationship_type VARCHAR(50),
    PRIMARY KEY (skill_id, related_skill_id)
);

-- Study Matches table
CREATE TABLE study_matches (
    match_id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES study_requests(request_id),
    teacher_id INTEGER REFERENCES users(user_id),
    student_id INTEGER REFERENCES users(user_id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Study Responses table
CREATE TABLE study_responses (
    response_id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES study_requests(request_id),
    responder_id INTEGER REFERENCES users(user_id),
    status VARCHAR(20),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Also need to add study_requests column that was missing from your schema
ALTER TABLE study_requests 
ADD COLUMN specific_topic VARCHAR(255),
ADD COLUMN learning_objectives TEXT,
ADD COLUMN preferred_schedule TEXT;

-- Add user department and study year
ALTER TABLE users 
ADD COLUMN department VARCHAR(100),
ADD COLUMN study_year INTEGER,
ADD COLUMN current_bubble_id INTEGER REFERENCES bubbles(bubble_id);