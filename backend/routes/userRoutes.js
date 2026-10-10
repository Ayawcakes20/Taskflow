import { Router } from 'express';
import { deleteUser, getUser, listAssignees, listUsers, updatePreferences, updateUser } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = Router();
router.use(protect);
router.get('/assignees', listAssignees);
router.get('/', requireAdmin, listUsers);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.delete('/:id', requireAdmin, deleteUser);
router.put('/me/preferences', updatePreferences);

export default router;
