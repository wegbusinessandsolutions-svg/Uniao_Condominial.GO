const fs = require('fs');
let file = fs.readFileSync('src/components/layouts/AdminLayout.tsx', 'utf8');

file = file.replace(
  'const AdminNotifications = React.lazy(() =>\n  import("../common/AdminNotifications").then((m) => ({ default: m.AdminNotifications }))\n);',
  'const AdminNotifications = React.lazy(() =>\n  import("../common/AdminNotifications").then((m) => ({ default: m.AdminNotifications }))\n);\nconst AfiliacaoOverdueAlert = React.lazy(() =>\n  import("../financeiro/AfiliacaoOverdueAlert").then((m) => ({ default: m.AfiliacaoOverdueAlert }))\n);'
);

file = file.replace(
  '<Suspense fallback={<AdminContentSkeleton />}>',
  '<Suspense fallback={null}>\n              <AfiliacaoOverdueAlert />\n            </Suspense>\n            <Suspense fallback={<AdminContentSkeleton />}>'
);

fs.writeFileSync('src/components/layouts/AdminLayout.tsx', file);
