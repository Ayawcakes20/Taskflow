import { Link } from 'react-router-dom';
import { ArrowUpRight, Bell } from 'lucide-react';
import { formatDate } from '../../utils/format';

export default function NotificationLink({ notification, onRead }) {
  const row = <div className={`notification-row ${notification.isRead ? 'is-read' : 'is-unread'}`}>
    <span className={`notification-type-icon type-${notification.type}`}><Bell size={16} /></span>
    <div className="notification-copy"><div className="notification-title-row"><strong>{notification.title}</strong><time>{formatDate(notification.createdAt, { month: 'short', day: 'numeric' })}</time></div><p>{notification.message}</p>{notification.task?.title && <small>{notification.task.title}</small>}</div>
    <span className="unread-indicator" aria-label={notification.isRead ? undefined : 'Unread'} aria-hidden={notification.isRead || undefined} />
    <ArrowUpRight size={15} className="notification-arrow" aria-hidden="true" />
  </div>;
  const to = notification.task?._id ? `/tasks/${notification.task._id}` : '/notifications';
  return <Link to={to} onClick={() => onRead?.(notification)} className="notification-link">{row}</Link>;
}
