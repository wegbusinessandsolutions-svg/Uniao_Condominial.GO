const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Restore layout container for 2 columns (Left: Data+Temp, Right: Badge)
content = content.replace(
  `className="grid grid-cols-1 gap-2.5 sm:gap-3 text-sm w-full sm:grid-cols-2 md:grid-cols-3 max-w-3xl"`,
  `className="grid grid-cols-1 gap-2.5 sm:gap-3 text-sm w-full max-w-sm"`
);

// 2. Remove the inline classification card we just added in the left column
content = content.replace(
  /\{\/\* 3\. Classification Card \*\/\}[\s\S]*?\}\(\)\)\}/,
  ""
);

// 3. Add the classification card back to the RIGHT column, formatted exactly like the screenshot
content = content.replace(
  `{/* The Classification Badge was here, currently removed. */}`,
  `{/* Right Column: Classification Badge */}
            <div className="flex-shrink-0 w-[42%] max-w-[150px]">
              {(() => {
                const rawLevel = (profile?.level || "Bronze").trim();
                const levelKey = rawLevel.toLowerCase();
                let badgeImage = badgeBronze;
                let textColor = "text-[#78350f]";
                
                if (levelKey === "prata") {
                  badgeImage = badgePrata;
                  textColor = "text-[#334155]";
                } else if (levelKey === "ouro") {
                  badgeImage = badgeOuro;
                  textColor = "text-[#854d0e]";
                } else if (levelKey === "diamante") {
                  badgeImage = badgeDiamante;
                  textColor = "text-[#0369a1]";
                }
                
                return (
                  <button 
                    type="button" 
                    onClick={() => setIsClassificationModalOpen(true)}
                    className="w-full h-full min-h-[120px] bg-white rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col items-center justify-center p-3 gap-2 border border-transparent hover:border-slate-100"
                  >
                    <img 
                      src={badgeImage} 
                      alt={rawLevel} 
                      className="w-[52px] h-[52px] object-contain drop-shadow-sm mb-1" 
                    />
                    <div className="text-center">
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest font-medium mb-0.5">
                        Classificação
                      </div>
                      <div className={\`text-sm font-medium capitalize \${textColor}\`}>
                        {rawLevel}
                      </div>
                    </div>
                  </button>
                );
              })()}
            </div>`
);

fs.writeFileSync(file, content);
