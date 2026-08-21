const fs = require('fs');
const file = 'src/components/layouts/AdminLayout.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStart = content.indexOf('// Automatic redirect if non-admin user lands on root "/admin" or "/admin/"');
const targetEnd = content.indexOf('const handleLogout = async () => {');

if (targetStart === -1 || targetEnd === -1) {
  console.log("Could not find targets");
  process.exit(1);
}

const replacement = `  // Automatic redirect if non-admin user lands on root "/admin" or "/admin/"
  const currentPath = location.pathname;
  const cleanPath = currentPath.replace(/\\/$/, "");

  // Path-level module permission checks
  const filteredNav = getFilteredNavGroups(navGroups, userRole, profile?.permissions);
  
  // Find the first available route to use as fallback/dashboard
  let firstAvailableRoute = "/admin"; // fallback
  if (!isAdmin) {
    firstAvailableRoute = "/"; // ultimate fallback if nothing available
    for (const group of filteredNav) {
      if (group.items.length > 0) {
        if (group.items[0].path) {
          firstAvailableRoute = group.items[0].path;
          break;
        } else if (group.items[0].children && group.items[0].children.length > 0) {
          firstAvailableRoute = group.items[0].children[0].path;
          break;
        }
      }
    }
  }

  if (cleanPath === "/admin" && !isAdmin) {
    return <Navigate to={firstAvailableRoute} replace />;
  }

  let hasModuleAccess = false;
  if (isAdmin) {
    hasModuleAccess = true;
  } else {
    // recursively check if cleanPath matches any item's path
    const checkPath = (items) => {
      for (const item of items) {
        if (item.path && (cleanPath === item.path || cleanPath.startsWith(item.path + "/"))) return true;
        if (item.children && checkPath(item.children)) return true;
      }
      return false;
    };
    for (const group of filteredNav) {
      if (checkPath(group.items)) {
        hasModuleAccess = true;
        break;
      }
    }
  }

  if (!hasModuleAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Acesso Restrito ao Módulo
          </h2>
          <p className="text-slate-600 mb-6 text-sm">
            Seu perfil (<span className="font-semibold text-slate-800">{userRole || "Colaborador"}</span>) não possui permissão para acessar este módulo.
          </p>
          <Link
            to={firstAvailableRoute}
            className="inline-block px-5 py-2.5 bg-[#0071e3] text-white rounded-xl hover:bg-blue-600 transition-colors font-bold text-sm shadow-sm"
          >
            Ir para a página inicial
          </Link>
        </div>
      </div>
    );
  }

  `;

content = content.substring(0, targetStart) + replacement + content.substring(targetEnd);
fs.writeFileSync(file, content);
console.log("Patched successfully");
