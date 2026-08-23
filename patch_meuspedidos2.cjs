const fs = require('fs');
let content = fs.readFileSync('src/pages/cliente/MeusPedidos.tsx', 'utf8');

const target = `            {permission !== "granted" && (
              <button
                onClick={async () => {
                  const res = await requestPermission();
                  if (res === "granted") {
                    addToast("Notificações Push no navegador ativadas com sucesso!", "success");
                  }
                }}
                className="bg-[#0071e3] hover:bg-[#005bb5] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-3xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Volume2 size={13} />
                Ativar Push no Navegador
              </button>
            )}`;

if (content.includes(target)) {
    content = content.replace(target, '');
} else {
    console.log("NOT FOUND");
}

fs.writeFileSync('src/pages/cliente/MeusPedidos.tsx', content);
