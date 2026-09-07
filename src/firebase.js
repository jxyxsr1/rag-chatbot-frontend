import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAvW_qWj5Y6w1bxjRhvXhLd5BGTbOSpYCY",
  authDomain: "ai-chatbot-6d921.firebaseapp.com",
  projectId: "ai-chatbot-6d921",
  storageBucket: "ai-chatbot-6d921.firebasestorage.app",
  messagingSenderId: "347995339713",
  appId: "1:347995339713:web:1b70d3150173187d784d40"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);