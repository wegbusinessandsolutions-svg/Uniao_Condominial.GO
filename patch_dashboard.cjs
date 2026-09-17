const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Restore the 3 column layout
content = content.replace(
  `className="grid grid-cols-1 gap-2.5 sm:gap-3 text-sm w-full sm:grid-cols-2 max-w-xl"`,
  `className="grid grid-cols-1 gap-2.5 sm:gap-3 text-sm w-full sm:grid-cols-2 md:grid-cols-3 max-w-3xl"`
);

// 2. Add the classification card
content = content.replace(
  `{/* GPS Confirmado removido a pedido do cliente */}`,
  `{/* 3. Classification Card */}
                {(() => {
                  const rawLevel = (profile?.level || "Bronze").trim();
                  const levelKey = rawLevel.toLowerCase();
                  let badgeImage = badgeBronze;
                  if (levelKey === "prata") badgeImage = badgePrata;
                  else if (levelKey === "ouro") badgeImage = badgeOuro;
                  else if (levelKey === "diamante") badgeImage = badgeDiamante;
                  
                  return (
                    <button type="button" onClick={() => setIsClassificationModalOpen(true)} className="bg-white shadow-xs hover:shadow-md px-4 py-2.5 rounded-2xl flex items-center justify-start gap-3 text-slate-700 text-xs sm:text-sm font-normal min-h-[56px] transition-all w-full group cursor-pointer border border-transparent hover:border-slate-100">
                      <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-50 to-white shadow-sm shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <img src={badgeImage} alt={rawLevel} className="w-6 h-6 object-contain drop-shadow-sm" />
                      </div>
                      <div className="leading-tight text-left">
                        <div className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-medium tracking-wider mb-0.5">Classificação</div>
                        <div className="font-semibold text-slate-800 capitalize truncate">{rawLevel}</div>
                      </div>
                    </button>
                  );
                })()}`
);

fs.writeFileSync(file, content);
