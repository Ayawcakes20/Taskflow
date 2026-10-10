import { useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { prepareTaskImage } from '../../utils/prepareTaskImage';

export default function TaskImagePicker({ imageUrl = '', imageThumbnail = '', onChange, disabled = false }) {
  const inputRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const preview = imageThumbnail || imageUrl;

  const choose = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProcessing(true);
    setError('');
    try { onChange(await prepareTaskImage(file)); setFileName(file.name); }
    catch (problem) { setError(problem.message || 'This image could not be prepared.'); }
    finally { setProcessing(false); }
  };

  return <div className="field task-image-field">
    <div className="task-image-label-row"><label htmlFor="task-image-file">Task image</label><span className="field-hint">Optional · JPEG, PNG, or WebP</span></div>
    <input ref={inputRef} id="task-image-file" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={disabled || processing} aria-describedby={error ? 'task-image-error' : 'task-image-hint'} />
    <div className={`task-image-picker ${preview ? 'has-preview' : ''}`}>
      {preview ? <div className="task-image-preview-wrap"><img className="task-image-preview" src={preview} alt="Preview of the task image" />{fileName && <span className="task-image-filename" title={fileName}>{fileName}</span>}</div> : <div className="task-image-placeholder"><ImagePlus size={19} /><span>Add a reference image</span></div>}
      <div className="task-image-actions">
        <button type="button" className="button button-secondary button-sm" onClick={() => inputRef.current?.click()} disabled={disabled || processing}>
          {processing ? <LoaderCircle size={14} className="spin-inline" /> : <ImagePlus size={14} />}{processing ? 'Preparing image…' : preview ? 'Replace image' : 'Choose image'}
        </button>
        {preview && <button type="button" className="button button-quiet button-sm text-danger" onClick={() => { onChange({ imageUrl: null, imageThumbnail: null }); setFileName(''); setError(''); }} disabled={disabled || processing}><Trash2 size={14} />Remove</button>}
        <p id="task-image-hint" className="field-hint">Images are resized before saving; maximum stored image size is 1 MB.</p>
      </div>
    </div>
    {error && <p id="task-image-error" className="field-error" role="alert">{error}</p>}
  </div>;
}
