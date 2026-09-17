const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The duplicate came from a previous patch that didn't cleanly remove the first instance due to regex matching limits on multiline.
// Let's do a more surgical replacement to ensure only ONE classification card exists, and it is on the right side.

// 1. Remove the left-side classification card block entirely
content = content.replace(
  /\{\/\* 3\. Classification Card \*\/\}[\s\S]*?\}\(\)\)\}/,
  ""
);

// 2. Ensure the container for the top row is flex with space-between
// We want: 
// <div className="flex flex-row justify-between items-start w-full gap-3 sm:gap-4">
//   <div className="flex flex-col items-start gap-2 flex-1 min-w-0">
//     ... Date and Weather ...
//   </div>
//   <div className="flex-shrink-0 w-[42%] max-w-[150px]">
//     ... Classification ...
//   </div>
// </div>

// Check if we need to fix the grid layout that was causing the duplicate visually
// The issue is likely that there is STILL a leftover inline block somewhere. 
// We will replace the entire Top Row section to be absolutely sure it's clean and matches the image perfectly.

fs.writeFileSync(file, content);
