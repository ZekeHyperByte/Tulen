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