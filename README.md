# NEU Library Log

Digital visitor log system for New Era University Library.

## Production URL
[neu-library-log-nine.vercel.app](https://neu-library-log-nine.vercel.app)

## Deployment Notes
- This application uses Next.js 15 and Firebase.
- **Google Auth**: Ensure that `neu-library-log-nine.vercel.app` is added to your Authorized Domains in the Firebase Console (Authentication > Settings).
- **PWA**: The app is configured with a `manifest.json` for full-screen tablet usage.

## Technical Architecture
- **Framework**: Next.js (App Router)
- **Database**: Firestore (Real-time updates)
- **Authentication**: Firebase Auth (Google Redirect & School ID)
- **Styling**: Tailwind CSS & ShadCN UI
