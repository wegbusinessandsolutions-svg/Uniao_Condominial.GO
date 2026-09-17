const fs = require('fs');

// Ensure the .env file is updated to ensure Vite picks it up correctly
// If there's an .env.local, it should work, but sometimes .env is safer
const key = 'VITE_GOOGLE_MAPS_API_KEY="AIzaSyAlymNHtDK_aGd_tUSz9mhwofMPFsJe1IE"';
fs.writeFileSync('.env', key);

// Ensure the key exists in .env
