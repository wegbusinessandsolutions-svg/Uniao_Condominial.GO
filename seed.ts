import { initFirebase } from "./src/lib/firebase";
import { collection, addDoc, getDocs, query, where, Timestamp } from "firebase/firestore";

const categorias = [
  {
    nome: "Aromatizadores de Ambiente",
    descricao: "Sprays e difusores para ambiente.",
    status: "Ativa",
    categoriaPai: "-",
    imagem: "https://images.unsplash.com/photo-1608528577891-b6630f9a2e8c?w=400&q=80"
  },
  {
    nome: "Produtos de Higiene e Descartáveis",
    descricao: "Itens de higiene e uso descartável.",
    status: "Ativa",
    categoriaPai: "-",
    imagem: "https://images.unsplash.com/photo-1584824388195-2acb7eff9d78?w=400&q=80"
  },
  {
    nome: "Produtos de Limpeza - Elevador",
    descricao: "Limpeza de metais e partes do elevador.",
    status: "Ativa",
    categoriaPai: "-",
    imagem: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&q=80"
  },
  {
    nome: "Produtos de Limpeza - Piso",
    descricao: "Limpeza de diferentes tipos de chão.",
    status: "Ativa",
    categoriaPai: "-",
    imagem: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=400&q=80"
  },
  {
    nome: "Produtos de Limpeza de Uso Comum",
    descricao: "Limpadores e desinfetantes de uso geral.",
    status: "Ativa",
    categoriaPai: "-",
    imagem: "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400&q=80"
  },
  {
    nome: "Utensílios de Limpeza",
    descricao: "Baldes, rodos e panos.",
    status: "Ativa",
    categoriaPai: "-",
    imagem: "https://images.unsplash.com/photo-1584820927498-cafeecdebf8c?w=400&q=80"
  }
];

async function seed() {
  try {
    const { db } = await initFirebase();
    const colRef = collection(db, "categorias_produtos");
    
    // Check existing
    const existing = await getDocs(colRef);
    const existingNames = existing.docs.map(d => d.data().nome);
    
    for (const cat of categorias) {
      if (!existingNames.includes(cat.nome)) {
        await addDoc(colRef, {
          ...cat,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        console.log("Added", cat.nome);
      } else {
        console.log("Skipping (already exists)", cat.nome);
      }
    }
    console.log("Seed completed successfully!");
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}

seed();
