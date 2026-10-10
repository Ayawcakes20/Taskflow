import { useEffect, useState } from 'react';
import { Edit3, MessageSquare, Send, Trash2, X } from 'lucide-react';
import { Avatar, Button, ConfirmDialog, TextAreaField } from '../common/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { taskService } from '../../services/taskService';
import { getMessage } from '../../services/api';
import { formatDate } from '../../utils/format';

function authorName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ') || person?.username || 'Team member';
}

function wasEdited(comment) {
  if (!comment?.createdAt || !comment?.updatedAt) return false;
  return Math.abs(new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime()) > 1000;
}

function renderCommentContent(content) {
  return content.split(/(@[a-zA-Z0-9_.-]{3,30})/g).map((part, index) => part.startsWith('@')
    ? <span className="comment-mention" key={`${part}-${index}`}>{part}</span>
    : <span key={`${part}-${index}`}>{part}</span>);
}

export default function TaskCommentsPanel({ task, onTaskChange }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const [members, setMembers] = useState([]);
  const [draft, setDraft] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null);
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    taskService.users().then(setMembers).catch(() => setMembers([]));
  }, []);

  const updateComments = (next) => onTaskChange((current) => current ? { ...current, comments: next } : current);
  const canManage = (comment) => user?.role === 'Admin' || String(comment.user?._id ?? comment.user) === String(user?._id);
  const matchingMembers = members.filter((person) => person.username?.toLowerCase().startsWith(mentionQuery || '')).slice(0, 6);
  const showSuggestions = mentionQuery !== null;

  const updateDraft = (event) => {
    const next = event.target.value;
    setDraft(next);
    const match = next.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/);
    setMentionQuery(match ? match[1].toLowerCase() : null);
  };

  const insertMention = (username) => {
    const next = draft.replace(/(^|\s)@([a-zA-Z0-9_.-]*)$/, `$1@${username} `);
    setDraft(next);
    setMentionQuery(null);
  };

  const add = async (event) => {
    event.preventDefault();
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      const comment = await taskService.addComment(task._id, { content: draft.trim() });
      updateComments([...comments, comment]);
      setDraft('');
      setMentionQuery(null);
      toast({ title: 'Comment added', description: 'Your comment is now part of the task.' });
    } catch (error) {
      toast({ title: 'Comment could not be posted', description: getMessage(error), variant: 'error' });
    } finally { setPosting(false); }
  };

  const beginEdit = (comment) => { setEditingId(String(comment._id)); setEditingText(comment.content); };
  const cancelEdit = () => { setEditingId(''); setEditingText(''); };
  const saveEdit = async (comment) => {
    if (!editingText.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      const updated = await taskService.updateComment(task._id, comment._id, { content: editingText.trim() });
      updateComments(comments.map((item) => String(item._id) === String(comment._id) ? updated : item));
      cancelEdit();
      toast({ title: 'Comment updated' });
    } catch (error) {
      toast({ title: 'Comment could not be updated', description: getMessage(error), variant: 'error' });
    } finally { setSavingEdit(false); }
  };

  const remove = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await taskService.removeComment(task._id, pendingDelete._id);
      updateComments(comments.filter((item) => String(item._id) !== String(pendingDelete._id)));
      setPendingDelete(null);
      toast({ title: 'Comment deleted' });
    } catch (error) {
      toast({ title: 'Comment could not be deleted', description: getMessage(error), variant: 'error' });
    } finally { setDeleting(false); }
  };

  return <section className="task-comments-panel" aria-labelledby="task-comments-heading">
    <div className="section-header"><div><span className="section-label">TEAM CONVERSATION</span><h2 id="task-comments-heading">Comments</h2></div><span className="subtle-count">{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span></div>
    {comments.length ? <div className="task-comment-list">{comments.map((comment) => <article className="task-comment" key={comment._id}>
      <Avatar user={comment.user} size="xs" />
      <div className="task-comment-body">
        <div className="task-comment-meta"><strong>{authorName(comment.user)}</strong><time dateTime={comment.updatedAt || comment.createdAt}>{wasEdited(comment) ? `Edited ${formatDate(comment.updatedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : formatDate(comment.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div>
        {String(editingId) === String(comment._id) ? <div className="comment-edit-form"><TextAreaField label="Edit comment" name={`edit-comment-${comment._id}`} rows={3} maxLength={5000} value={editingText} onChange={(event) => setEditingText(event.target.value)} disabled={savingEdit} /><div className="comment-actions"><Button variant="secondary" icon={X} onClick={cancelEdit} disabled={savingEdit}>Cancel</Button><Button icon={Send} loading={savingEdit} disabled={!editingText.trim()} onClick={() => void saveEdit(comment)}>Save comment</Button></div></div> : <p className="task-comment-content">{renderCommentContent(comment.content)}</p>}
        {canManage(comment) && String(editingId) !== String(comment._id) && <div className="task-comment-actions"><button type="button" className="text-button" aria-label={`Edit comment by ${authorName(comment.user)}`} onClick={() => beginEdit(comment)}><Edit3 size={13} />Edit</button><button type="button" className="text-button comment-delete-action" aria-label={`Delete comment by ${authorName(comment.user)}`} onClick={() => setPendingDelete(comment)}><Trash2 size={13} />Delete</button></div>}
      </div>
    </article>)}</div> : <div className="quiet-empty task-comments-empty"><MessageSquare size={17} /><span>No comments yet. Share context with the people working on this task.</span></div>}
    <form className="task-comment-composer" onSubmit={add}><Avatar user={user} size="xs" /><div className="task-comment-compose-field">
      <TextAreaField label="Add a comment" name="new-task-comment" rows={3} maxLength={5000} value={draft} onChange={updateDraft} placeholder="Write a comment, use @username or @everyone…" disabled={posting} />
      {showSuggestions && <div className="comment-mention-suggestions" role="listbox" aria-label="Mention suggestions">
        <button type="button" className="comment-mention-option" onClick={() => insertMention('everyone')}><span className="mention-option-symbol">@</span><span><strong>@everyone</strong><small>Notify all active workspace users</small></span></button>
        {matchingMembers.map((person) => <button type="button" key={person._id} className="comment-mention-option" onClick={() => insertMention(person.username)}><Avatar user={person} size="xs" /><span><strong>@{person.username}</strong><small>{authorName(person)}</small></span></button>)}
      </div>}
      <div className="comment-compose-footer"><span>{draft.length}/5000</span><Button type="submit" icon={Send} loading={posting} disabled={!draft.trim()}>Post comment</Button></div>
    </div></form>
    <ConfirmDialog open={Boolean(pendingDelete)} title="Delete this comment?" description="This comment will be removed from the task." confirmLabel="Delete comment" onClose={() => setPendingDelete(null)} onConfirm={remove} loading={deleting} />
  </section>;
}
