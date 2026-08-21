export type UserLevel = "Bronze" | "Prata" | "Ouro" | "Diamante";

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  imageUrl: string;
  stock: number;
  prices: {
    Bronze: number;
    Prata: number;
    Ouro: number;
    Diamante: number;
  };
  isActive: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  appliedPrice: number;
  level: UserLevel;
}
