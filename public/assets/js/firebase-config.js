import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDyLAUVg54wo7b_gsa2L24-O42uqp3D3Zg',
  authDomain: 'band-diary.firebaseapp.com',
  projectId: 'band-diary',
  storageBucket: 'band-diary.firebasestorage.app',
  messagingSenderId: '3830242331',
  appId: '1:3830242331:web:67e77bd4e026da3d082cbe',
  measurementId: 'G-1TBX81187P'
};
const app = initializeApp(firebaseConfig);
if (await isSupported()) getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'europe-west2');
export const storage = getStorage(app);
