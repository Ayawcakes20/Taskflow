import { Router } from 'express';
import { addTaskComment, bulkTasks, createTask, deleteTask, deleteTaskComment, getTask, listTasks, updateTask, updateTaskComment } from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.use(protect);
router.post('/bulk', bulkTasks);
router.get('/', listTasks);
router.post('/', createTask);
router.post('/:id/comments', addTaskComment);
router.put('/:id/comments/:commentId', updateTaskComment);
router.delete('/:id/comments/:commentId', deleteTaskComment);
router.get('/:id', getTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
