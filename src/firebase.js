import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBzvvey5zMXdm8DPaOo0lI5OUyU6MqXta0",
  authDomain: "jemareen-academy.firebaseapp.com",
  projectId: "jemareen-academy",
  storageBucket: "jemareen-academy.firebasestorage.app",
  messagingSenderId: "125065148800",
  appId: "1:125065148800:web:3ecbe2d943c28e8a2b6965"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
