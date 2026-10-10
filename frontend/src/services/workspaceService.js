import api from './api';

export async function getDashboard({ fresh = false } = {}) {
  const config = fresh ? { headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' } } : {};
  return (await api.get('/dashboard', config)).data.data;
}
export async function getReports() { return (await api.get('/reports')).data.data; }
export async function getActivity(params = {}) { return (await api.get('/activity', { params })).data.data; }
export async function getNotifications(params = {}) { return (await api.get('/notifications', { params })).data.data; }
export async function markRead(id) { return (await api.put(`/notifications/${id}/read`)).data.data; }
export async function markAllRead() { return (await api.put('/notifications/read-all')).data.data; }
