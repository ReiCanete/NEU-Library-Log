# NEU Library Log

**Digital Entry Management System for New Era University Library**

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-v11-orange?style=flat-square&logo=firebase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?style=flat-square&logo=vercel)

- **Live URL:** [neu-library-log-nine.vercel.app](https://neu-library-log-nine.vercel.app)
- **GitHub Repository:** [github.com/ReiCanete/NEU-Library-Log](https://github.com/ReiCanete/NEU-Library-Log)

---

## 📖 Overview

The **NEU Library Log** is a high-performance digital visitor management system designed specifically for the New Era University Library. Built to replace traditional paper logs, it provides a seamless entry experience for students while offering library staff real-time analytics, automated reporting, and proactive security management.

---

## 🏛️ About New Era University

New Era University (NEU) is a private, non-sectarian educational institution in the Philippines, established and maintained by the Iglesia Ni Cristo.

- **Philosophy:** Godliness is the foundation of knowledge.
- **Mission:** Provide quality education anchored on Christian values with the prime purpose of bringing honor and glory to God.
- **Vision:** A world-class Institution of learning with a unique Christian culture of excellence, discipline, and service to humanity.
- **Main Campus:** 9 Central Ave, New Era, Quezon City, 1107 Metro Manila.
- **Contact:** info@neu.edu.ph | (02) 8981 4221 | dpo@neu.edu.ph

---

## ✨ Features

### 🖥️ Kiosk (Visitor-Facing)
- **Smart ID Entry:** Optimized for manual input with automatic dash formatting (`XX-XXXXX-XXX`).
- **Institutional Authentication:** Secure sign-in via Google restricted exclusively to `@neu.edu.ph` domains.
- **Visitor Registration:** Guided first-time setup with institutional data validation and smart auto-capitalization.
- **PHT Timezone Sync:** Real-time visitor counts and timestamps aligned with Philippine Standard Time (PHT).
- **Broadcast System:** Floating announcement toasts (Gold for notices, Red pulsing glow for urgent institutional alerts).
- **Session Protection:** Automatic 3-minute idle timeout with a 10-second warning to protect visitor privacy.
- **Blocklist Enforcement:** Immediate restriction of access for IDs/Emails recorded in the managed blocklist.

### 🛡️ Admin Panel (Staff-Facing)
- **Live Dashboard:** Real-time metrics banner, top visit purposes, purpose distribution chart, college leaderboards, and daily visitor trends.
- **Visitor Logs:** Centralized archive featuring two distinct modules:
  - **Activity Log:** Searchable entry history with a detailed side panel showing full visitor profiles and historical visit history.
  - **Registered Users:** Full registry management with options to edit or remove profiles.
- **Proactive Security:** Managed blocklist allowing staff to restrict access by Student ID or Email with automatic name lookup from Firestore.
- **Official Reporting:** 
  - **Branded PDF Export:** Professional reports featuring the NEU logo, institutional info, mission/vision, and full audit tables.
  - **CSV Engines:** Export capabilities for dashboard metrics, user registries, and historical logs.
- **Role Protection:** Admin roles are preserved and cannot be overwritten by the kiosk registration process.

---

## 🛠 Tech Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS & ShadCN UI |
| **Database** | Firebase Firestore (Spark/Free Tier) |
| **Authentication** | Firebase Auth (Google OAuth @neu.edu.ph) |
| **Charts** | Recharts |
| **PDF Export** | jsPDF & autoTable |
| **Deployment** | Vercel |

---

## 📂 Firestore Collections

### `users`
- Stores visitor profiles (Student ID, Full Name, College, Program, Email, Role).
- Roles are strictly restricted to `visitor` and `admin`.

### `visits`
- Real-time log of every library entry (Student ID, Full Name, Purpose, Login Method, Timestamp).

### `blocklist`
- Records of restricted individuals (Student ID/Email, Reason, Admin who blocked, Timestamp).

### `announcements`
- Broadcast messages (Content, Priority, Active Status, Date Range).

---

## 🏫 Supported Colleges

The system includes pre-defined mapping for the following departments:
- College of Accountancy
- College of Agriculture
- College of Arts and Sciences
- College of Business Administration
- College of Communication
- College of Informatics and Computing Studies
- College of Criminology
- College of Education
- College of Engineering and Architecture
- College of Law
- College of Medical Technology
- College of Midwifery
- College of Music
- College of Nursing
- College of Physical Therapy
- College of Respiratory Therapy
- School of International Relations
- School of Graduate Studies

---

## 🚀 Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ReiCanete/NEU-Library-Log.git
   cd NEU-Library-Log
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

---

## 📸 Screenshots

### Kiosk Workflow
| | |
|:---:|:---:|
| ![Kiosk Home](screenshots/kiosk-home.png) <br> *Kiosk Entry* | ![Kiosk Register](screenshots/kiosk-register.png) <br> *Visitor Registration* |
| ![Kiosk Purpose](screenshots/kiosk-purpose.png) <br> *Purpose Selection* | ![Kiosk Welcome](screenshots/kiosk-welcome.png) <br> *Entry Successful* |

### Administrative Portal
| | |
|:---:|:---:|
| ![Admin Login](screenshots/admin-login-kiosk.png) <br> *Staff Sign-in* | ![Dashboard 1](screenshots/admin-dashboard-1.png) <br> *Live Analytics* |
| ![Dashboard 2](screenshots/admin-dashboard-2.png) <br> *Purpose Distribution* | ![Dashboard 3](screenshots/admin-dashboard-3.png) <br> *Daily Trends* |
| ![Visitor Logs](screenshots/admin-logs.png) <br> *Activity Logs* | ![User Registry](screenshots/admin-logs-users.png) <br> *Registered Users* |
| ![Blocklist](screenshots/admin-blocklist.png) <br> *Access Restrictions* | ![Announcements](screenshots/admin-announcements.png) <br> *Broadcast Center* |
| ![Reports 1](screenshots/admin-reports-1.png) <br> *Report Generation* | ![Reports 2](screenshots/admin-reports-2.png) <br> *PDF Preview* |

---

## ⚠️ Known Limitations
- **Mobile Compatibility:** The system is optimized for kiosk displays and desktop admin use; full responsiveness for mobile devices is currently under verification.

---

## 🛡️ Admin Access Note
Administrative roles are managed manually within the Firestore `users` collection by setting the `role` field to `"admin"`.
**Current Administrators:**
- `reiangelo.canete@neu.edu.ph` (System Developer)
- `jcesperanza@neu.edu.ph` (Library Faculty)

---

## 🎓 Credits
Developed for the **New Era University Library** as a modern digital entry solution. Built with excellence using Next.js and Firebase.