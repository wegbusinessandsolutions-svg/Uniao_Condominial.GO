const fs = require('fs');

let content = fs.readFileSync('src/components/layouts/AdminLayout.tsx', 'utf8');

// The items we want to move:
// Usuários
// Permissões de Usuário
// Relatórios
// Regras de Cashback

// We can just find them in the `items` array and move them.
// But it's easier to do string replacements if we are careful.

const searchFranqueadaStart = 'name: "Franqueada - Empresa",';
const franqueadaIdx = content.indexOf(searchFranqueadaStart);

// Let's replace the whole navGroups definition.
const navGroupsStart = 'export const navGroups: NavGroup[] = [';
const adminLayoutStart = 'export default function AdminLayout() {';

let navGroupsStr = content.substring(content.indexOf(navGroupsStart), content.indexOf(adminLayoutStart));

// We know the exact structure. Let's just generate it since it's a constant array.
// But it has children for Permissões de Usuário. Let's just pull out the items.
