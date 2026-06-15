import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAPUCa9QnjWwDBIbnaOpAHijPksbWOMB-w",
  authDomain: "maintenance-app-f22f1.firebaseapp.com",
  databaseURL: "https://maintenance-app-f22f1-default-rtdb.firebaseio.com",
  projectId: "maintenance-app-f22f1",
  storageBucket: "maintenance-app-f22f1.firebasestorage.app",
  messagingSenderId: "714599744322",
  appId: "1:714599744322:web:82dbbc384cf2012641fedb"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);