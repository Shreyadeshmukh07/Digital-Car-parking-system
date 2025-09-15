import { firebaseConfig } from "./firebaseConfig.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";



const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const parkingGrid = document.getElementById("parkingGrid");
const reserveForm = document.getElementById("reserveForm");
const reservedSpotsList = document.getElementById("reservedSpotsList");

let currentUser = null;

// Render grid
function renderParkingGrid(reservedSpots) {
  parkingGrid.innerHTML = "";
  for (let i = 1; i <= 20; i++) {
    const spotKey = `Spot ${i}`;
    const spot = document.createElement("div");
    spot.className = "text-white text-sm py-2 text-center rounded-md cursor-pointer";
    spot.textContent = spotKey;

    if (reservedSpots.includes(spotKey)) {
      spot.classList.add("bg-red-600"); // reserved
    } else {
      spot.classList.add("bg-green-600"); // available
    }

    // click → auto-fill spot number
    spot.onclick = () => {
      document.getElementById("spotNumber").value = i;
    };

    parkingGrid.appendChild(spot);
  }
}

// Render reservations
async function renderReservations() {
  if (!currentUser) return;
  reservedSpotsList.innerHTML = "";
  const q = query(collection(db, "reservations"), where("user", "==", currentUser.uid));
  const querySnapshot = await getDocs(q);
  const reservedSpots = [];

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    reservedSpots.push(data.spot);

    const li = document.createElement("li");
    li.className = "flex justify-between items-center bg-gray-100 p-3 rounded shadow";
    li.innerHTML = `
      <div class="text-left">
        <div class="font-bold">${data.spot} - ${data.vehicle}</div>
        <div class="text-sm">${new Date(data.start).toLocaleString()} → ${new Date(data.end).toLocaleString()}</div>
      </div>
      <button class="bg-red-500 text-white px-2 py-1 rounded text-sm">Cancel</button>
    `;
    li.querySelector("button").onclick = async () => {
      await deleteDoc(doc(db, "reservations", docSnap.id));
      renderReservations();
    };

    reservedSpotsList.appendChild(li);
  });

  // update grid with reserved spots
  renderParkingGrid(reservedSpots);
}

// Reservation submit
reserveForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const vehicle = document.getElementById("vehicleNumber").value.trim().toUpperCase();
  const spot = "Spot " + document.getElementById("spotNumber").value.trim();
  const fromTime = new Date(document.getElementById("fromTime").value);
  const toTime = new Date(document.getElementById("toTime").value);

  // ✅ Vehicle number validation (MH 12 RQ 2311)
  const vehiclePattern = /^[A-Z]{2}\s\d{2}\s[A-Z]{1,2}\s\d{4}$/;
  if (!vehiclePattern.test(vehicle)) {
    alert("Please enter a valid vehicle number (e.g., MH 12 RQ 2311).");
    return;
  }

  if (fromTime >= toTime) {
    alert("End time must be after start time.");
    return;
  }

  const hours = Math.ceil((toTime - fromTime) / (1000 * 60 * 60));
  const amount = hours * 20 * 100; // ₹20 per hour

  await addDoc(collection(db, "reservations"), {
    user: currentUser.uid,
    vehicle,
    spot,
    start: fromTime.toISOString(),
    end: toTime.toISOString(),
    hours
  });

  renderReservations();

  // Razorpay payment
  const options = {
    "key": "rzp_test_yQ8sKvUS72HreR",
    "amount": amount,
    "currency": "INR",
    "name": "Smart Parking System",
    "description": "Slot Booking Payment",
    "handler": function (response){
      alert("Payment successful! Payment ID: " + response.razorpay_payment_id);
    },
    "theme": { "color": "#3399cc" }
  };
  const rzp = new Razorpay(options);
  rzp.open();

  reserveForm.reset();
});

// Logout
window.logout = function() {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
};

// Auth check
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    renderReservations();
  } else {
    window.location.href = "index.html";
  }
});

// ✅ Show all slots immediately on page load (all green)
document.addEventListener("DOMContentLoaded", () => {
  renderParkingGrid([]);
});

