import api from './api';

export const taskService = {
  async list(params = {}) { return (await api.get('/tasks', { params })).data.data; },
  async listAll(params = {}) {
    const tasks = new Map();
    let page = 1;
    let totalPages = 1;
    do {
      const result = await taskService.list({ ...params, page, limit: 100 });
      for (const task of result.items) tasks.set(String(task._id), task);
      totalPages = result.pagination.totalPages;
      page += 1;
    } while (page <= totalPages);
    return [...tasks.values()];
  },
  async get(id) { return (await api.get(`/tasks/${id}`)).data.data; },
  async create(payload) { return (await api.post('/tasks', payload)).data.data.task; },
  async update(id, payload) { return (await api.put(`/tasks/${id}`, payload)).data.data.task; },
  async remove(id) { return (await api.delete(`/tasks/${id}`)).data; },
  async bulk(payload) { return (await api.post('/tasks/bulk', payload)).data.data; },
  async addComment(id, payload) { return (await api.post(`/tasks/${id}/comments`, payload)).data.data.comment; },
  async updateComment(id, commentId, payload) { return (await api.put(`/tasks/${id}/comments/${commentId}`, payload)).data.data.comment; },
  async removeComment(id, commentId) { return (await api.delete(`/tasks/${id}/comments/${commentId}`)).data.data; },
  async users() { return (await api.get('/users/assignees')).data.data.items; },
};
