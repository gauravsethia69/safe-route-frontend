import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyASaZLZJdeyWMC2AgqIabDwjeyEENZfxDw",
  authDomain: "safe-route-login.firebaseapp.com",
  projectId: "safe-route-login",
  storageBucket: "safe-route-login.firebasestorage.app",
  messagingSenderId: "971954363933",
  appId: "1:971954363933:web:5b4d68a68ac2f8208ef0f4",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);