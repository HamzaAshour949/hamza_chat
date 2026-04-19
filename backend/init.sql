CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email_verified TINYINT(1) NOT NULL DEFAULT 0,
    verification_code VARCHAR(10) NULL,
    verification_expires_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user INT NOT NULL,
    to_user INT NOT NULL,
    type ENUM('text','image','video','voice','file') DEFAULT 'text',
    content TEXT,
    media_url VARCHAR(500),
    thumbnail TEXT,
    mime_type VARCHAR(100),
    file_name VARCHAR(255),
    file_size INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user) REFERENCES users(id),
    FOREIGN KEY (to_user) REFERENCES users(id),
    INDEX idx_conversation (from_user, to_user, created_at)
);

-- Seed test accounts (password: password123) — already verified so they can
-- log in without going through the Brevo email-confirmation flow.
-- Hash below is bcrypt of "password123" (regenerated — older hash in git was stale).
INSERT INTO users (email, password, email_verified) VALUES
    ('test1@test.com', '$2y$10$uyJawIaNFU.1CTfAdQckz.mmAGNNffHVV1LvhknwiiKGpuGNIgmhi', 1),
    ('test2@test.com', '$2y$10$uyJawIaNFU.1CTfAdQckz.mmAGNNffHVV1LvhknwiiKGpuGNIgmhi', 1);
