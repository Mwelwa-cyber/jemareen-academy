# Jemareen Academy — EduPay Setup Guide

## What's in this folder
- `src/firebase.js` — your Firebase connection (already configured)
- `src/App.js` — main app with real login check
- `src/components/Login.js` — login page
- `src/components/Dashboard.js` — full dashboard with Firestore
- `public/` — PWA files for phone installation

---

## STEP 1 — Install Node.js
Download from: https://nodejs.org (choose LTS)
After installing, open Command Prompt and check:
```
node --version
```
Should print something like: v20.0.0

---

## STEP 2 — Run the app on your computer
Open Command Prompt, navigate to this folder:
```
cd path\to\jemareen-academy
npm install
npm start
```
The app will open at http://localhost:3000

---

## STEP 3 — Create admin accounts in Firebase

1. Go to https://console.firebase.google.com
2. Open your "Jemareen Academy" project
3. Click "Authentication" in left menu
4. Click "Add user"
5. Enter email + password for each admin:
   - Principal: principal@jemareen.zm / (your password)
   - Bursar: bursar@jemareen.zm / (your password)
   - Teacher: teacher@jemareen.zm / (your password)

These are REAL accounts. Anyone with these credentials can log in from any phone or computer.

---

## STEP 4 — Set Firestore security rules

In Firebase Console:
1. Click "Firestore Database"
2. Click "Rules" tab
3. Replace all text with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
4. Click "Publish"

This means only logged-in users can read/write data.

---

## STEP 5 — Deploy to the internet (free)

```
npm run build
```

Then go to https://netlify.com:
1. Create free account
2. Drag the `build/` folder onto the Netlify dashboard
3. You get a URL like: https://jemareen-edupay.netlify.app

---

## STEP 6 — Install on Android phone

1. Open Chrome on your Android phone
2. Go to your Netlify URL
3. Tap the ⋮ menu → "Add to Home screen"
4. Tap Install

EduPay appears on your home screen like a real app!
Any admin can install it on their own phone the same way.

---

## How it works across multiple admins

- All admins log in with their own email/password
- All data is stored in Firebase (cloud)
- When one admin records a payment, ALL admins see it instantly
- Works on Android, iPhone, and computer browsers

---

## Support
If you get stuck on any step, the most common fixes are:
- "Module not found" → run `npm install` again
- "Permission denied" → check Firestore rules (Step 4)
- "Auth/user-not-found" → create the user in Firebase Console (Step 3)
