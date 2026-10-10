import ActivityLog from '../models/ActivityLog.js';

export async function recordActivity({ actor = null, action, entityType = 'system', entityId = null, entityTitle = '', details = '', targetUser = null }) {
  try {
    return await ActivityLog.create({ actor, action, entityType, entityId, entityTitle, details, targetUser });
  } catch (error) {
    console.error(`Activity log could not be saved: ${error.message}`);
    return null;
  }
}
