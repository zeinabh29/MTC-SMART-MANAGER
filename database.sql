-- =====================================================================
-- MTC SMART MANAGER - UNIFIED MASTER DATABASE SCHEMA & SEED SCRIPT
-- Integrated System:
--   - Member 1: Authentication & User Management
--   - Member 2: Transactions & Packages
--   - Member 3 (Security Engineer): Security Logs, Alerts & Encryption
--   - PDM / ERD: Physical Relational Telecom Model
-- =====================================================================

CREATE TABLE IF NOT EXISTS Customer (
    CustomerID INT PRIMARY KEY AUTO_INCREMENT,
    FullName VARCHAR(100) NOT NULL,
    PhoneNumber VARCHAR(20) UNIQUE NOT NULL,
    Address VARCHAR(255),
    Email VARCHAR(100) UNIQUE NOT NULL,
    RegistrationDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    sim_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    pin_salt VARCHAR(255) NOT NULL,
    balance DECIMAL(10,2) DEFAULT 0.00 CHECK (balance >= 0),
    data_balance_gb DECIMAL(10,2) DEFAULT 3.00,
    minutes_balance INT DEFAULT 450,
    account_status ENUM('active','suspended','locked') DEFAULT 'active',
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    is_two_factor_enabled BOOLEAN DEFAULT FALSE,
    daily_transfer_limit DECIMAL(10,2) DEFAULT 50.00,
    require_transfer_pin BOOLEAN DEFAULT TRUE,
    auto_lock_timer INT DEFAULT 60,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customer(CustomerID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS SIM_Card (
    SIMID INT PRIMARY KEY AUTO_INCREMENT,
    CustomerID INT NOT NULL,
    SIMNumber VARCHAR(20) UNIQUE NOT NULL,
    Status VARCHAR(20) DEFAULT 'Active',
    CurrentBalance DECIMAL(10,2) DEFAULT 0.00,
    NbOfRecharges INT DEFAULT 0,
    FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Agent (
    AgentID INT PRIMARY KEY AUTO_INCREMENT,
    AgentName VARCHAR(100) NOT NULL,
    Location VARCHAR(100),
    Phone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS Recharge_Transaction (
    TransactionID INT PRIMARY KEY AUTO_INCREMENT,
    SIMID INT NOT NULL,
    AgentID INT NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    OldBalance DECIMAL(10,2),
    NewBalance DECIMAL(10,2),
    TransactionDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ReferenceNumber VARCHAR(50) UNIQUE,
    PaymentMethod VARCHAR(50) DEFAULT 'SMS / Central',
    FOREIGN KEY (SIMID) REFERENCES SIM_Card(SIMID) ON DELETE CASCADE,
    FOREIGN KEY (AgentID) REFERENCES Agent(AgentID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CreditTransfer (
    TransferID INT PRIMARY KEY AUTO_INCREMENT,
    SIMID INT NOT NULL,
    SIM_SIMID INT NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    TransferDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Status VARCHAR(20) DEFAULT 'Completed',
    FOREIGN KEY (SIMID) REFERENCES SIM_Card(SIMID) ON DELETE CASCADE,
    FOREIGN KEY (SIM_SIMID) REFERENCES SIM_Card(SIMID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    receipt_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    recipient_id INT NULL,
    transaction_type ENUM('transfer','transfer_received','recharge','package_purchase','dollar_to_data') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(10,2),
    balance_after DECIMAL(10,2),
    details TEXT,
    recipient_phone VARCHAR(20),
    recipient_name VARCHAR(100),
    sender_phone VARCHAR(20),
    sender_name VARCHAR(100),
    transaction_status ENUM('pending','completed','failed') DEFAULT 'completed',
    transaction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_transaction_limits (
    limit_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    transaction_date DATE NOT NULL,
    total_spent DECIMAL(10,2) DEFAULT 0.00,
    UNIQUE (user_id, transaction_date),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS packages (
    package_id INT PRIMARY KEY AUTO_INCREMENT,
    package_name VARCHAR(100) NOT NULL,
    package_type ENUM('data','calls','bundle') DEFAULT 'data',
    data_gb DECIMAL(10,2),
    minutes INT DEFAULT 0,
    price DECIMAL(10,2) NOT NULL,
    validity_days INT NOT NULL,
    is_popular BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS user_packages (
    user_package_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    package_id INT NOT NULL,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(512) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trusted_devices (
    device_id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    device_name VARCHAR(100),
    device_fingerprint TEXT NOT NULL,
    trusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS two_factor_codes (
    code_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    code_type ENUM('login','transaction','pin_reset'),
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pin_history (
    pin_history_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    old_pin_hash VARCHAR(255),
    new_pin_hash VARCHAR(255),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS security_logs (
    log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    event_type ENUM(
        'login_success',
        'login_failed',
        'suspicious_activity',
        'unauthorized_access',
        'account_locked',
        'account_unlocked',
        'session_expired',
        'large_transaction',
        'transfer_completed',
        'recharge_completed'
    ) NOT NULL,
    ip_address VARCHAR(45),
    device_id VARCHAR(255),
    user_agent TEXT,
    risk_score INT CHECK (risk_score BETWEEN 0 AND 100),
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_details TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_risk_time (risk_score, event_timestamp)
);

CREATE TABLE IF NOT EXISTS security_alerts (
    alert_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    alert_type ENUM(
        'failed_login',
        'suspicious_activity',
        'account_locked',
        'large_transaction',
        'new_device_detected',
        'transfer_limit_warning'
    ) NOT NULL,
    alert_message TEXT NOT NULL,
    severity ENUM('info','warning','critical') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_alerts_user (user_id, is_read)
);

CREATE TABLE IF NOT EXISTS encryption_keys (
    key_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    key_hash VARCHAR(512) NOT NULL,
    key_algorithm ENUM('AES-256','RSA-2048') DEFAULT 'AES-256',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

INSERT INTO Customer (CustomerID, FullName, PhoneNumber, Address, Email) VALUES
(1, "Sana'a Hamieh", '76937135', 'Beirut, Lebanon', 'sanaa.hamieh@mtc.com'),
(2, 'Malak Dbouk', '70688012', 'Tyre, Lebanon', 'malak.dbouk@mtc.com'),
(3, 'Zeinab Hamieh', '70721261', 'Baalbek, Lebanon', 'zeinab.hamieh@mtc.com');

INSERT INTO users (user_id, customer_id, full_name, phone_number, sim_number, email, pin_hash, pin_salt, balance, data_balance_gb, minutes_balance, daily_transfer_limit, require_transfer_pin, auto_lock_timer) VALUES
(1, 1, "Sana'a Hamieh", '76937135', '76937135', 'sanaa.hamieh@mtc.com', 'pin_hash_1234', 'salt1', 100.00, 3.0, 450, 50.00, 1, 60),
(2, 2, 'Malak Dbouk', '70688012', '70688012', 'malak.dbouk@mtc.com', 'pin_hash_1234', 'salt2', 50.00, 5.0, 300, 50.00, 1, 60),
(3, 3, 'Zeinab Hamieh', '70721261', '70721261', 'zeinab.hamieh@mtc.com', 'pin_hash_1234', 'salt3', 36.00, 2.0, 200, 50.00, 1, 60);

INSERT INTO SIM_Card (SIMID, CustomerID, SIMNumber, Status, CurrentBalance, NbOfRecharges) VALUES
(1, 1, '76937135', 'Active', 100.00, 1),
(2, 2, '70688012', 'Active', 50.00, 0),
(3, 3, '70721261', 'Active', 36.00, 0);

INSERT INTO Agent (AgentID, AgentName, Location, Phone) VALUES
(1, 'MTC Central Touch Agent', 'Downtown Beirut', '+961 1 999888');

INSERT INTO packages (package_id, package_name, package_type, data_gb, minutes, price, validity_days, is_popular) VALUES
(1, 'Starter Net', 'data', 2.0, 0, 1.50, 7, 0),
(2, 'Super Net', 'data', 5.0, 0, 3.00, 30, 1),
(3, 'Mega Net', 'data', 10.0, 0, 5.00, 30, 1);

INSERT INTO transactions (receipt_id, user_id, recipient_id, transaction_type, amount, balance_before, balance_after, details, recipient_phone, recipient_name, sender_phone, sender_name, transaction_status, transaction_timestamp) VALUES
('TXN0571337504', 1, 3, 'transfer', 55.00, 91.00, 36.00, 'Transfer to Zeinab Hamieh (70721261)', '70721261', 'Zeinab Hamieh', '76937135', "Sana'a Hamieh", 'completed', '2026-02-08 19:22:00'),
('TXN0482910481', 1, NULL, 'recharge', 5.00, 95.00, 100.00, 'Quick Recharge via SMS', NULL, NULL, '76937135', "Sana'a Hamieh", 'completed', '2026-02-08 19:26:33');

INSERT INTO CreditTransfer (TransferID, SIMID, SIM_SIMID, Amount, TransferDate, Status) VALUES
(1, 1, 3, 55.00, '2026-02-08 19:22:00', 'Completed');

INSERT INTO Recharge_Transaction (TransactionID, SIMID, AgentID, Amount, OldBalance, NewBalance, TransactionDate, ReferenceNumber, PaymentMethod) VALUES
(1, 1, 1, 5.00, 95.00, 100.00, '2026-02-08 19:26:33', 'TXN0482910481', 'SMS');
