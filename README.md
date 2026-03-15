# NEU Library Log

**Digital Entry Management System for Nueva Era University Library**

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-v11-orange?style=flat-square&logo=firebase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?style=flat-square&logo=vercel)

- **Live URL:** [neu-library-log-nine.vercel.app](https://neu-library-log-nine.vercel.app)
- **GitHub Repository:** [github.com/supra-sauce/NEU-Library-Log](https://github.com/supra-sauce/NEU-Library-Log)

---

## 📖 Overview

The **NEU Library Log** is a professional digital visitor management system designed specifically for the Nueva Era University Library. Its primary purpose is to replace outdated, manual paper-based entry logs with a high-performance digital kiosk. It provides real-time analytics for library staff and a seamless, modern entry experience for students and visitors.

---

## ✨ Features

### Kiosk (Visitor-Facing)
- **School ID Entry:** Optimized for manual typing or physical RFID scanner input.
- **Institutional Email Sign-in:** Secure verification for `@neu.edu.ph` accounts.
- **First-time Registration:** One-time profile setup with college and degree program selection.
- **Visit Purpose selection:** Six distinct activity categories for accurate analytics.
- **Welcome Display:** Confirmation screen with an 8-second auto-reset timer.
- **Real-time Broadcasts:** Instant display of administrative announcements and urgent alerts.
- **Capacity Counter:** Live monitoring of current library occupancy against daily limits.
- **Access Enforcement:** Automatic blocking of restricted individuals via a managed blocklist.

### Admin Panel (Staff-Facing)
- **Secure Portal:** Private authentication for authorized library staff.
- **Live Dashboard:** Real-time visualization of daily, weekly, and monthly traffic.
- **Visual Analytics:** Donut charts for visit purposes and bar charts for college demographics.
- **Visitor History:** Searchable activity logs with deep filtering by college, program, and date.
- **Access Restrictions:** Managed blocklist with reason tracking and instant status toggles.
- **Broadcast Center:** Command center for posting scheduled or urgent kiosk announcements.
- **System Reports:** Official PDF and CSV export engines with institutional branding.
- **Threshold Management:** Real-time configuration of the library's daily capacity limit.

---

## 🛠 Tech Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS & ShadCN UI |
| **Database** | Firebase Firestore (Real-time) |
| **Authentication** | Firebase Auth (Email/Password + Google OAuth) |
| **Charts** | Recharts |
| **PDF Export** | jsPDF & autoTable |
| **Deployment** | Vercel |

---

## 📂 Project Structure

```text
src/
├── app/
│   ├── page.tsx              # Kiosk entry screen (ID/Email entry)
│   ├── layout.tsx            # Root layout & providers
│   ├── kiosk/
│   │   ├── register/         # One-time visitor registration
│   │   ├── purpose/          # Visit purpose selection
│   │   └── welcome/          # Entry confirmation screen
│   └── admin/
│       ├── login/            # Staff authentication
│       ├── page.tsx          # Dashboard & real-time metrics
│       ├── logs/             # Advanced visitor activity archives
│       ├── blocklist/        # Proactive access management
│       ├── announcements/    # Broadcast & alert management
│       └── reports/          # Official system reporting
├── firebase/
│   ├── config.ts             # SDK initialization (Singleton pattern)
│   ├── provider.tsx          # React Context providers
│   └── firestore/            # Real-time data hooks
├── components/               # Isolated UI components (ShadCN)
└── lib/                      # Validation, utilities, and constants
```

---

## 🗄 Firestore Collections

### `users`
| Field | Type | Description |
| :--- | :--- | :--- |
| `studentId` | string | Unique student or visitor ID |
| `fullName` | string | Full legal name of the visitor |
| `college` | string | Affiliated college name |
| `program` | string | Specific degree program |
| `email` | string | Verified institutional email |
| `role` | string | 'visitor' (default) or 'admin' |
| `createdAt` | timestamp | Initial registration date |

### `visits`
| Field | Type | Description |
| :--- | :--- | :--- |
| `studentId` | string | Visitor's ID number |
| `fullName` | string | Visitor's full name |
| `college` | string | College at time of visit |
| `program` | string | Program at time of visit |
| `purpose` | string | Purpose of the visit |
| `loginMethod` | string | 'id', 'google', or 'email' |
| `timestamp` | timestamp | Visit entry date and time |

### `blocklist`
| Field | Type | Description |
| :--- | :--- | :--- |
| `studentId` | string | Blocked student's ID number |
| `fullName` | string | Name for administrative reference |
| `reason` | string | Context for the access restriction |
| `blockedBy` | string | Email of the issuing administrator |
| `blockedAt` | timestamp | Date the restriction was issued |

### `announcements`
| Field | Type | Description |
| :--- | :--- | :--- |
| `message` | string | Text displayed on the kiosk banner |
| `priority` | string | 'normal' (Gold) or 'urgent' (Pulsing Red) |
| `isActive` | boolean | Toggle for manual overrides |
| `startDate` | timestamp | Scheduled start of display |
| `endDate` | timestamp | Scheduled expiration of message |
| `createdBy` | string | Email of the administrator |

### `settings`
| Field | Type | Description |
| :--- | :--- | :--- |
| `dailyCapacity` | number | Global kiosk entry threshold (Default: 200) |

---

## 🚀 Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/supra-sauce/NEU-Library-Log.git
   cd NEU-Library-Log
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Create a `.env.local` file in the root directory and populate it with your Firebase configuration:
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

## 🔐 Firebase Configuration

### Authentication
- Enable **Google** and **Email/Password** providers in the Firebase Console.
- Add `neu-library-log-nine.vercel.app` to the **Authorized Domains** list.

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null;
    }
    match /visits/{visitId} {
      allow create: if true;
      allow read, update, delete: if isAdmin();
    }
    match /users/{userId} {
      allow read: if true;
      allow create: if true; 
      allow update: if isAdmin() || request.auth.uid == userId; 
    }
    match /blocklist/{blockId} {
      allow read: if true; 
      allow write: if isAdmin();
    }
    match /announcements/{announcementId} {
      allow read: if true; 
      allow write: if isAdmin();
    }
    match /settings/{settingId} {
      allow read: if true; 
      allow write: if isAdmin();
    }
  }
}
```

### Admin Account Creation
1. Create a user via **Firebase Console > Authentication**.
2. Manually create a document in the `users` collection in Firestore.
3. Use the student's email as the Document ID.
4. Set the `role` field to `"admin"`.

---

## 🖥️ Deployment

1. Push your code to a GitHub repository.
2. Connect the repository to **Vercel**.
3. Add all `NEXT_PUBLIC_` environment variables to the Vercel project settings.
4. Deploy. The application is configured for automatic CI/CD on every push to the `main` branch.

---

## ⚠️ Known Limitations
- **RFID Support:** Requires a standard USB HID keyboard-emulating reader.
- **OAuth Redirects:** Google Sign-in functionality is optimized for the production URL and may require domain whitelisting for local testing.
- **Admin Setup:** Admin roles must be assigned manually via the Firestore database for security.

---

## 🎓 Credits
Developed for **Nueva Era University Library** as a modern digital entry solution. Built with excellence using Next.js and Firebase.