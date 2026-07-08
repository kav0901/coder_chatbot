// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// REPLACE THIS OBJECT WITH YOUR ACTUAL FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDcddecfmYBa3AWGD2F61d5nZm_GIv4P0I",
  authDomain: "coder-chatbot-31ee0.firebaseapp.com",
  projectId: "coder-chatbot-31ee0",
  storageBucket: "coder-chatbot-31ee0.firebasestorage.app",
  messagingSenderId: "207253707963",
  appId: "1:207253707963:web:3eb5f73b5537ea88bddd9e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();