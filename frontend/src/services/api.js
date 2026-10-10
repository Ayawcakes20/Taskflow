import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) error.message = 'Unable to reach Taskflow. Check your connection and try again.';
    else error.message = error.response.data?.message || 'Something went wrong. Please try again.';
    return Promise.reject(error);
  },
);

export function getMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.message || error?.message || fallback;
}

export default api;
