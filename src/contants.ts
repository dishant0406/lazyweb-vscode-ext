import axios from "axios";

const BACKEND_URL = 'http://localhost:4000/api';
// const BACKEND_URL = 'https://api.lazyweb.rocks/api';

export const APIClient = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});