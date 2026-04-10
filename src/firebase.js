import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBlrCoo2GF_p-LpHZn2NqHWllT2eaw62bA",
  authDomain: "examsprepzambia.firebaseapp.com",
  databaseURL: "https://examsprepzambia-default-rtdb.firebaseio.com",
  projectId: "examsprepzambia",
  storageBucket: "examsprepzambia.firebasestorage.app",
  messagingSenderId: "325628669031",
  appId: "1:325628669031:web:0f790afb274372af9c38c2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
