# **App Name**: NEU Library Log

## Core Features:

- Kiosk User Authentication: Allows visitors to log in via NEU School ID or 'Sign in with Google' (restricted to @neu.edu.ph domain via Firebase Auth). School ID input is autofocus on page load and auto-submits on 'Enter', compatible with USB HID RFID scanners. For first-time Google sign-ins, a user document is auto-created with name, email, and college (if available). For first-time School ID logins, visitors are prompted to enter their full name and college/office. Blocked users receive an 'Entry not allowed' message.
- Kiosk Purpose Selection: Presents pre-defined visit purposes (e.g., Reading books, Research) as large, icon-based clickable cards in a grid on the kiosk screen.
- Kiosk Welcome Display: Shows a full-screen welcome message with the visitor's full name, college/office, current date, and live time. Includes a countdown and auto-resets to the entry screen after 8 seconds.
- Kiosk Visit Logging: Automatically records all successful visitor entries (studentId, fullName, college, purpose, timestamp, loginMethod) to the 'visits' Firestore collection.
- Kiosk Interaction Management: Provides a 'Cancel / Logout' button at every step of the kiosk flow. The kiosk automatically resets to the entry screen after 30 seconds of inactivity to ensure privacy and readiness for the next user.
- Admin Login & Authorization: Secures the /admin route, requiring Google sign-in (restricted to @neu.edu.ph) and verifying the 'admin' role in Firestore before granting dashboard access.
- Admin Dashboard Statistics: Displays key statistics for visitors (today, this week, this month) as stat cards with icons on the admin dashboard.
- Admin Daily Visitor Chart: Presents a bar chart of daily visitor counts for a custom date range using a date picker, utilizing Recharts or Chart.js.
- Admin Visitor Log Table: Shows a paginated table of recent visitor logs, including name, college, purpose, login method, and timestamp, with a 'Block' action button for each entry.
- Admin Visitor Blocking: Allows administrators to block a visitor by their school ID via a modal requiring a reason for audit purposes, which is recorded in the 'blocklist' collection and takes immediate effect at the kiosk.
- Admin Report Generation: Enables export of a PDF report of current dashboard statistics (stat totals, selected date range, and visitor log table), with app name and generation date in the header, using jsPDF or react-pdf.
- Admin Role Management: Admin roles are manually assigned in the 'users' Firestore collection by setting the 'role' field to 'admin'. Includes a 'scripts/seedAdmin.ts' utility for initial admin setup.
- Firebase Security Rules Enforcement: Implements strict Firebase Security Rules to control Firestore read/write access based on user roles and data ownership, ensuring only authorized users can access sensitive information.
- Secure Configuration Management: Ensures sensitive information, such as API keys and other secrets, are stored securely using Firebase environment configuration and never hardcoded, including a placeholder for a future Anthropic API key.

## Style Guidelines:

- A clean, professional university aesthetic. A deep navy primary color provides a strong, academic foundation. White backgrounds offer clarity and contrast, while subtle gray accents are used for secondary elements and borders.
- The 'Inter' sans-serif typeface is used throughout via Google Fonts. Kiosk screens feature large text (minimum 18px body, 48px+ headings) for readability. Admin panel text uses standard sizes appropriate for detailed tables and forms.
- Modern and streamlined icons from 'lucide-react' are used. Kiosk purpose cards feature large icons (48px+) for touch-friendliness. Admin UI elements use standard size icons (20px) for navigation and actions.
- Kiosk screens utilize full-screen centered layouts with ample whitespace. The admin panel features a responsive layout with a sidebar for navigation and a main content area for dashboard elements, adaptable across desktop, tablet, and mobile devices.
- Subtle and professional animations are incorporated using Framer Motion for smooth screen transitions (fade/slide). Skeleton loaders are used for data fetching in the admin dashboard to enhance perceived performance.