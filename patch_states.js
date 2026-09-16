const fs = require('fs');
const file = '/app/applet/src/pages/cliente/LocalEntrega.tsx';
let content = fs.readFileSync(file, 'utf8');

const stateBlock = `  const [successMsg, setSuccessMsg] = useState("Localização do condomínio padrão selecionada ✓");
  const [showMapOverride, setShowMapOverride] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [cep, setCep] = useState(profile?.cep || "");
  const [endereco, setEndereco] = useState(profile?.endereco || "");
  const [numero, setNumero] = useState(profile?.numero || "");
  const [complemento, setComplemento] = useState(profile?.complemento || "");
  const [bairro, setBairro] = useState(profile?.bairro || "");
  const [cidade, setCidade] = useState(profile?.cidade || "");
  const [estado, setEstado] = useState(profile?.estado || "");
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  const handleCepSearch = async () => {
    const cleanCep = cep.replace(/\\D/g, "");
    if (cleanCep.length !== 8) return;
    
    setIsSearchingCep(true);
    try {
      const res = await fetch(\`https://viacep.com.br/ws/\${cleanCep}/json/\`);
      const data = await res.json();
      if (!data.erro) {
        setEndereco(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setEstado(data.uf || "");
        setSuccessMsg("Endereço preenchido pelo CEP ✓");
      } else {
        alert("CEP não encontrado.");
      }
    } catch (err) {
      console.error("Erro ao buscar CEP:", err);
      alert("Erro ao buscar o CEP.");
    } finally {
      setIsSearchingCep(false);
    }
  };`;

content = content.replace(
  /const \[successMsg, setSuccessMsg\].*const \[isLocating, setIsLocating\] = useState\(false\);/s,
  stateBlock
);

// Add fields to handleSaveLocation
const saveBlock = `        await updateDoc(doc(db, "users", profile.uid), {
          latitude: lat,
          longitude: lng,
          cep,
          endereco,
          numero,
          complemento,
          bairro,
          cidade,
          estado,
          geolocalizacaoAtiva: true,
          geolocalizacaoAtualizadaEm: serverTimestamp()
        });`;

content = content.replace(
  /await updateDoc\(doc\(db, "users", profile.uid\), \{\s*latitude: lat,\s*longitude: lng,\s*geolocalizacaoAtiva: true,\s*geolocalizacaoAtualizadaEm: serverTimestamp\(\)\s*\}\);/s,
  saveBlock
);

fs.writeFileSync(file, content);
