# 📱 MTC Smart Manager

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite%20%7C%20MySQL-blue.svg)](https://sqlite.org/)
[![PWA](https://img.shields.io/badge/PWA-Ready-purple.svg)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](#)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-orange.svg)](#)

A full-stack, mobile-first telecom banking and services application (PWA) designed for **MTC Touch** network subscribers. Built with an exact **1:1 pixel-perfect** dark glassmorphism interface, robust backend REST API, and an ACID-compliant transactional database.

---

## 📸 Screenshots & UI Design

The interface strictly matches native telecom mobile application standards:
- **Authentication:** 4-digit secure PIN entry with masked/unmasked toggle and multi-account switcher.
- **Home Dashboard:** Live Total Balance (`$100.00 Active`), Data (`3.0 GB`), Minutes (`450 min`), and Quick Action buttons.
- **Quick Recharge Modal:** Instant `$5`, `$10`, `$20`, and `$50` SMS recharge with automatic balance synchronization.
- **Credit Transfer Modal:** Real-time transfer calculation (`$100.00 → $45.00`), recipient phone selection, and PIN verification.
- **Digital Transaction Receipt:** Instant high-contrast green success modal with unique Receipt ID (`TXN...`), timestamps, and transfer details.
- **Dollar → Data Converter:** Dynamic slider conversion (`$1 = 100MB`) with live exchange preview.
- **Available Packages:** Interactive data subscription cards (`Starter Net`, `Super Net ★ Popular`, `Mega Net ★ Popular`).
- **Activity & History:** Complete transaction log and team directory (`Sana'a Hamieh`, `Malak Dbouk`, `Zeinab Hamieh`).
- **Security & Settings:** Two-factor authentication (2FA), auto-lock inactivity timer (30s–5m), daily spending limits, and AES-256 audit logs.

---

## 🛠️ Architecture & Tech Stack

- **Frontend:**
  - Modern Vanilla JavaScript (ES6+)
  - Mobile-First Glassmorphic CSS3 with custom CSS Variables
  - Progressive Web App (PWA) with `manifest.json` for standalone desktop/mobile installation
- **Backend:**
  - Native **Node.js** HTTP & REST API server (**0 external `npm` dependencies**)
  - Alternative standalone **Python 3** runner (`server.py`) using Python Standard Library
- **Database Engine:**
  - SQLite with `node:sqlite` (ACID Transactions, zero manual database configuration required)
  - Full relational schema compatible with MySQL (`database.sql`)
- **Security:**
  - Salted PBKDF2 PIN hashing
  - AES-256 encryption key management table
  - Automated account lockout on 3 failed PIN attempts
  - Real-time audit trail and risk scoring (`security_logs` and `security_alerts`)

---

## 🗄️ Database Schema & Relational Models

The project unifies all team modules and the Physical Data Model (PDM / ERD):

```
+------------------+         +--------------------+         +-------------------+
|     Customer     | 1     n |      SIM_Card      | 1     n | Recharge_Trans... |
+------------------+---------+--------------------+---------+-------------------+
| CustomerID <PK>  |         | SIMID <PK>         |         | TransactionID <PK>|
| FullName         |         | CustomerID <FK>    |         | SIMID <FK>        |
| PhoneNumber      |         | SIMNumber          |         | AgentID <FK>      |
| Email            |         | CurrentBalance     |         | Amount            |
| Address          |         | NbOfRecharges      |         | ReferenceNumber   |
+------------------+         +--------------------+         +-------------------+
                               | 1            | 1
                               | From         | To
                               v n            v n
                             +--------------------+
                             |   CreditTransfer   |
                             +--------------------+
                             | TransferID <PK>    |
                             | SIMID <FK1>        |
                             | SIM_SIMID <FK2>    |
                             | Amount             |
                             | TransferDate       |
                             +--------------------+
```

### Integrated Tables:
1. `users` & `Customer`: Profile, phone number, balance, status, daily limits.
2. `SIM_Card`: SIM identification, balance, recharge counter.
3. `transactions`: Complete transaction ledger (transfers, recharges, packages, conversions).
4. `daily_transaction_limits`: Daily spending quotas per user to prevent unauthorized drainage.
5. `packages` & `user_packages`: Telecom data/voice bundles and active user subscriptions.
6. `security_logs` & `security_alerts`: Security event auditing, risk scoring, and notification alerts.
7. `encryption_keys`: Key rotation and algorithm tracking (AES-256).

---

## 🚀 How to Open and Run in VS Code

### Step 1: Open the Project in VS Code
1. Launch **Visual Studio Code**.
2. Go to **File** ➔ **Open Folder...**.
3. Select the folder:
   ```text
   C:\Users\admin\Downloads\MTC SMART MANAGER
   ```
4. Click **Select Folder**.

### Step 2: Open the Integrated Terminal
- Press ``Ctrl + ` `` (backtick) or go to **Terminal** ➔ **New Terminal**.

### Step 3: Run the Server
Choose either Node.js or Python:

#### Option A: Using Node.js (Recommended - Fast & Zero Dependencies):
```bash
node server.js
```
*(or run `npm start`)*

#### Option B: Using Python (Alternative):
```bash
python server.py
```

### Step 4: Open the Application
Once the server starts, open your web browser (Chrome, Edge, Safari, Firefox) and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Default Test Accounts

| Account Name | Phone Number | Default PIN | Initial Balance | Initial Data | Initial Minutes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sana'a Hamieh** *(Primary)* | `76937135` | `1234` or `0000` | `$100.00` | `3.0 GB` | `450 min` |
| **Malak Dbouk** | `70688012` | `1234` | `$50.00` | `5.0 GB` | `300 min` |
| **Zeinab Hamieh** | `70721261` | `1234` | `$36.00` | `2.0 GB` | `200 min` |

> *Tip: You can switch between accounts anytime from the dropdown menu on the login screen or by clicking on team members in the **Activity** tab.*

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/login` | Authenticates user PIN with lockout protection |
| `GET` | `/api/users` | Returns list of all network members |
| `GET` | `/api/user/:id` | Returns account details, balances, and limits |
| `PUT` | `/api/user/:id/settings` | Updates 2FA, auto-lock timer, and daily limits |
| `POST` | `/api/recharge` | Executes instant recharge transaction via SMS |
| `POST` | `/api/transfer` | Performs ACID-compliant credit transfer between accounts |
| `POST` | `/api/convert` | Converts dollar balance to mobile data bundle |
| `GET` | `/api/packages` | Fetches active telecom plans |
| `POST` | `/api/packages/subscribe`| Subscribes user to a package and allocates quota |
| `GET` | `/api/transactions/:userId`| Returns categorized transaction history |
| `GET` | `/api/security/:userId` | Retrieves encryption keys and security audit logs |
| `GET` | `/api/alerts/:userId` | Retrieves active user security alerts |

---

## 📂 Project Structure

```text
MTC SMART MANAGER/
├── server.js            # Node.js native HTTP server & REST API (Zero dependencies)
├── server.py            # Standalone Python 3 HTTP server & REST API
├── database.js          # SQLite database engine, schema initialization & ACID logic
├── database.sql         # Universal SQL schema script (compatible with MySQL & SQLite)
├── mtc_smart_manager.db # Pre-seeded SQLite database file
├── package.json         # Project metadata and run scripts
├── README.md            # Project documentation
└── public/              # Frontend client assets
    ├── index.html       # Single Page Application HTML5 structure
    ├── styles.css       # Mobile-first glassmorphism styling
    ├── app.js           # Client-side state manager and API controller
    └── manifest.json    # PWA configuration for standalone app installation
```

---

## 💡 Installing as a Desktop / Mobile App (PWA)

1. Open `http://localhost:3000` in Google Chrome or Microsoft Edge.
2. In the browser address bar, click the **Install App** icon (or go to `Settings ➔ Apps ➔ Install MTC Smart Manager`).
3. The app will launch in an isolated window without browser tabs or toolbars, operating exactly like a native desktop application.

---

## 📜 License
This project is open-source and available under the [MIT License](LICENSE).
