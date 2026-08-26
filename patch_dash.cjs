const fs = require('fs');
let file = fs.readFileSync('src/pages/admin/Franqueadora.tsx', 'utf8');

// 1. Add recharts imports
file = file.replace(
  'import { initFirebase } from "../../lib/firebase";',
  'import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";\nimport { initFirebase } from "../../lib/firebase";'
);

// 2. Add chartData state
file = file.replace(
  'const [formData, setFormData] = useState<FranqueadoraData>(emptyFranqueadora);',
  'const [formData, setFormData] = useState<FranqueadoraData>(emptyFranqueadora);\n  const [chartData, setChartData] = useState<any[]>([]);'
);

// 3. Add fetching logic for dashboard inside fetchData
const fetchLogic = `
  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const querySnapshot = await getDocs(collection(db, "config_franqueadora"));
      const items: FranqueadoraData[] = [];
      let totalRoyaltiesPercent = 0;
      let countFranqueadas = 0;

      querySnapshot.forEach((doc) => {
        const d = doc.data() as Omit<FranqueadoraData, "id">;
        items.push({ id: doc.id, ...d });
        if (d.royalties) {
          const r = parseFloat(d.royalties.replace(',', '.'));
          if (!isNaN(r)) {
            totalRoyaltiesPercent += r;
            countFranqueadas++;
          }
        }
      });
      setData(items);

      const avgRoyalty = countFranqueadas > 0 ? (totalRoyaltiesPercent / countFranqueadas) / 100 : 0.05;

      const ordersSnap = await getDocs(collection(db, "pedidos_venda"));
      const monthlyTotals = Array(12).fill(0);
      const currentYear = new Date().getFullYear();

      ordersSnap.forEach((d) => {
        const order = d.data();
        if (order.createdAt && order.status !== "cancelado") {
          const date = new Date(order.createdAt);
          if (date.getFullYear() === currentYear) {
            const m = date.getMonth();
            const cand = order.totais?.totalPedido || order.totalPedido || order.valorTotal || order.valor_total || order.totalGeral || order.total;
            let val = 0;
            if (typeof cand === "number") val = cand;
            else if (typeof cand === "string") val = parseFloat(cand.replace(/[^0-9,-]+/g,"").replace(",","."));
            if (!isNaN(val)) monthlyTotals[m] += val;
          }
        }
      });

      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const newChartData = months.map((m, idx) => ({
        name: m,
        royalties: monthlyTotals[idx] * avgRoyalty
      }));
      setChartData(newChartData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };
`;

file = file.replace(
  /const fetchData = async \(\) => \{[\s\S]*?finally \{\s*setLoading\(false\);\s*\}\s*\};/,
  fetchLogic
);

// 4. Render chart in the JSX
const chartJsx = `
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Building size={20} className="text-brand-dark" />
            Somatório Mensal de Royalties ({new Date().getFullYear()})
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                  tickFormatter={(value) => \`R$ \${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}\`}
                />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [\`R$ \${value.toFixed(2).replace('.', ',')}\`, 'Royalties Recebidos']}
                />
                <Bar dataKey="royalties" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
`;

file = file.replace(
  '<div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">',
  chartJsx
);

fs.writeFileSync('src/pages/admin/Franqueadora.tsx', file);
