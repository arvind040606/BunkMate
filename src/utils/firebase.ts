import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut, 
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAB7jsC-6K0puJXUVIu5LZSG7IjxhU7fZU",
  authDomain: "handy-vault-7xnr0.firebaseapp.com",
  projectId: "handy-vault-7xnr0",
  storageBucket: "handy-vault-7xnr0.firebasestorage.app",
  messagingSenderId: "161247579312",
  appId: "1:161247579312:web:da205817a8d7b29c3dbf75"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  sendEmailVerification
};
