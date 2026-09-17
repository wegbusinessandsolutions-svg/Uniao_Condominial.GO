const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '{/* 3. Classification Card */}';
const endMarker = '})()}';

const startIdx = content.indexOf(startMarker);
if (startIdx !== -1) {
  // Find the end marker after start marker
  const substringAfterStart = content.substring(startIdx);
  const endMarkerIdx = substringAfterStart.indexOf(endMarker);
  
  if (endMarkerIdx !== -1) {
    const endBlockIdx = startIdx + endMarkerIdx + endMarker.length;
    // Remove the block
    content = content.substring(0, startIdx) + content.substring(endBlockIdx);
    console.log("Replaced successfully!");
  } else {
    console.log("End marker not found");
  }
} else {
  console.log("Start marker not found");
}

fs.writeFileSync(file, content);
