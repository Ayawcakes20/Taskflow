import { z } from 'zod';
import { isValidCalendarDate } from '../../frontend/src/utils/workspaceDates.js';

const email = z.string().trim().email('Enter a valid email address.').max(254);
const username = z.string().trim().min(3, 'Username must be at least 3 characters.').max(30).regex(/^[a-zA-Z0-9_.-]+$/, 'Use letters, numbers, dots, hyphens, or underscores in the username.');
const password = z.string().min(8, 'Password must be at least 8 characters.').max(72).regex(/[A-Za-z]/, 'Password must include a letter.').regex(/[0-9]/, 'Password must include a number.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.');
const taskTitle = z.string().trim().min(1, 'Task title is required.').max(180);
const taskDescription = z.string().trim().max(5000);
const taskPriority = z.enum(['Low', 'Medium', 'High']);
const taskStatus = z.enum(['Pending', 'In Progress', 'Completed']);
const taskCategory = z.string().trim().max(80);
const taskAssignee = z.string().nullable();
const taskAssignees = z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Choose valid assignees.')).max(250, 'A task can have at most 250 assignees.');
const mongoObjectId = z.string().regex(/^[a-f\d]{24}$/i, 'Choose a valid task.');
const subtaskItem = z.object({
  _id: mongoObjectId.optional(),
  title: z.string().trim().min(1, 'Subtask title is required.').max(200),
  completed: z.boolean().default(false),
}).strict();
const taskSubtasks = z.array(subtaskItem).max(100, 'A task can have at most 100 subtasks.');
const taskDateValue = z.union([
  z.string().datetime({ offset: true }),
  z.string().refine(isValidCalendarDate, 'Enter a valid due date.'),
  z.literal(''),
  z.null(),
]);
const taskDate = taskDateValue.transform((value) => value || null);
const imageDataUri = (maxLength) => z.union([
  z.string().max(maxLength).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i, 'Choose a valid JPEG, PNG, or WebP image.'),
  z.literal(''),
  z.null(),
]).transform((value) => value || null);
const taskImage = imageDataUri(1_500_000);
const taskThumbnail = imageDataUri(180_000);

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(60),
  lastName: z.string().trim().min(1, 'Last name is required.').max(60),
  username,
  email,
  password,
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).refine((data) => data.password === data.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username.'),
  password: z.string().min(1, 'Password is required.'),
});

export const otpRequestSchema = z.object({ email });
export const otpChallengeSchema = z.object({ challengeId: z.string().regex(/^[a-f0-9]{64}$/, 'Start a new verification request.') });
export const otpVerifySchema = otpChallengeSchema.extend({ code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code.') });
export const passwordResetSchema = otpChallengeSchema.extend({
  resetToken: z.string().regex(/^[a-f0-9]{64}$/, 'Verify your recovery code again.'),
  newPassword: password,
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).refine((data) => data.newPassword === data.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

export const taskSchema = z.object({
  title: taskTitle,
  description: taskDescription.optional().default(''),
  priority: taskPriority.default('Medium'),
  status: taskStatus.default('Pending'),
  category: taskCategory.optional().default('General'),
  assignedUsers: taskAssignees.optional(),
  // Legacy request field retained for older clients.
  assignedUser: taskAssignee.optional(),
  dueDate: taskDate.default(null),
  imageUrl: taskImage.optional().default(null),
  imageThumbnail: taskThumbnail.optional().default(null),
  subtasks: taskSubtasks.optional().default([]),
});

export const taskUpdateSchema = z.object({
  title: taskTitle.optional(),
  description: taskDescription.optional(),
  priority: taskPriority.optional(),
  status: taskStatus.optional(),
  category: taskCategory.optional(),
  assignedUsers: taskAssignees.optional(),
  assignedUser: taskAssignee.optional(),
  dueDate: taskDate.optional(),
  imageUrl: taskImage.optional(),
  imageThumbnail: taskThumbnail.optional(),
  subtasks: taskSubtasks.optional(),
}).strict().refine((values) => Object.keys(values).length > 0, 'Provide at least one task field to update.');

export const taskCommentSchema = z.object({
  content: z.string().trim().min(1, 'Write a comment before posting.').max(5000, 'Comments must be 5,000 characters or fewer.'),
}).strict();

const taskIds = z.array(mongoObjectId).min(1, 'Select at least one task.').max(100, 'You can update at most 100 tasks at a time.')
  .refine((ids) => new Set(ids).size === ids.length, 'Remove duplicate task selections.');
export const taskBulkSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('complete'), taskIds }).strict(),
  z.object({ action: z.literal('priority'), taskIds, priority: taskPriority }).strict(),
  z.object({ action: z.literal('assign'), taskIds, assignedUsers: taskAssignees }).strict(),
  z.object({ action: z.literal('delete'), taskIds }).strict(),
]);

export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  username,
  email,
  profileImage: z.string().max(1_500_000).or(z.literal('')).optional(),
});

export const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifications: z.object({
    assignments: z.boolean().optional(),
    updates: z.boolean().optional(),
    deadlines: z.boolean().optional(),
    mentions: z.boolean().optional(),
  }).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: password,
}).refine((data) => data.currentPassword !== data.newPassword, { path: ['newPassword'], message: 'Choose a password different from your current one.' });
