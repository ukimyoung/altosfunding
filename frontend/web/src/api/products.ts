import api from './axios';

export interface Product {
  status: string;
  challenge_id: string;
  challenge_name: string;
  product_id: string;
  description: string;
  price_usdt: number;
  capital: number;
  is_recommended: boolean;
  current_participants: number;
  group_size: number;
  start_at: string;
}

export interface ListProductsResponse {
  challenges: Product[];
  total_active_accounts: number;
}

export const listProducts = async () => {
  const response = await api.get<ListProductsResponse>('/v1/challenges/summary');

  return response.data;
};
