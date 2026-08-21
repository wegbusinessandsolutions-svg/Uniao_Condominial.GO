const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Usuarios.tsx', 'utf8');

// 1. Add emailConfirmadoAdmin to initial state
content = content.replace(
  /const \[formData, setFormData\] = useState\(\{/,
  `const [formData, setFormData] = useState({
    password: "",
    emailConfirmadoAdmin: false,`
);

// 2. Add to handleOpenModal
content = content.replace(
  /permissions: user.permissions \|\| \{\}/,
  `permissions: user.permissions || {},
        emailConfirmadoAdmin: user.emailConfirmadoAdmin || false,
        password: ""`
);

content = content.replace(
  /permissions: \{\} as any\n      \}\);/,
  `permissions: {} as any,
        emailConfirmadoAdmin: false,
        password: ""
      });`
);

// 3. Update handleSubmit payload
content = content.replace(
  /permissions: \["admin", "Administrador", "Admin", "Comercial", "Financeiro", "Estoquista", "Entregador", "Expedição"\].includes\(formData.role\) \? formData.permissions : \{\}/,
  `permissions: ["admin", "Administrador", "Admin", "Comercial", "Financeiro", "Estoquista", "Entregador", "Expedição"].includes(formData.role) ? formData.permissions : {},
        emailConfirmadoAdmin: formData.emailConfirmadoAdmin`
);

// 4. Update the save logic in handleSubmit to create the Auth user
const authCreationLogic = `      let dbId = editingUser?.id || formData.email.replace(/[@.]/g, "_");
      
      // If creating a new user, create the Auth user via REST API
      if (!editingUser) {
        if (!formData.password) {
          setEmailError("Para criar um novo usuário, informe uma senha.");
          return;
        }
        try {
          const fbConfig = (await import("../../firebase-applet-config.json")).default;
          const res = await fetch(\`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=\${fbConfig.apiKey}\`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              returnSecureToken: false
            })
          });
          const authData = await res.json();
          if (!res.ok) {
             throw new Error(authData.error.message || "Erro ao criar usuário na Autenticação");
          }
          dbId = authData.localId; // Use real Auth UID
        } catch (authErr: any) {
          setEmailError(authErr.message);
          return;
        }
      }`;

content = content.replace(
  /const dbId = editingUser\?\.id \|\| formData\.email\.replace\(\/\[@\.\]\/g, "_"\);/,
  authCreationLogic
);

// 5. Add the checkbox to the form
const checkboxHTML = `                  <div className="col-span-2 md:col-span-3">
                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-[#0B1A3A] transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.emailConfirmadoAdmin}
                        onChange={(e) => setFormData({...formData, emailConfirmadoAdmin: e.target.checked})}
                        className="w-5 h-5 text-[#0B1A3A] rounded focus:ring-[#0B1A3A]"
                      />
                      <div>
                        <span className="block font-bold text-slate-900">E-mail confirmado pelo administrador</span>
                        <span className="block text-sm text-slate-500">Isenta a necessidade de confirmação por e-mail para acessar o aplicativo</span>
                      </div>
                    </label>
                  </div>`;

content = content.replace(
  /<div>\s*<label className="block text-sm font-bold text-slate-900 mb-1">Telefone \/ Celular<\/label>/,
  checkboxHTML + '\n                  <div>\n                    <label className="block text-sm font-bold text-slate-900 mb-1">Telefone / Celular</label>'
);

fs.writeFileSync('src/pages/admin/Usuarios.tsx', content);
