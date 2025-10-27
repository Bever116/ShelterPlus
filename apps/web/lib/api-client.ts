import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});
