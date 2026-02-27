'use client';

import { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import ImageUpload, { type ImagePreview } from './ImageUpload';

interface EdInputProps {
  onSend: (message: string, images?: ImagePreview[]) => void;
  disabled?: boolean;
  voiceButton?: React.ReactNode;
}

export default function EdInput({ onSend, disabled, voiceButton }: EdInputProps) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<ImagePreview[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;
    onSend(trimmed || '(image)', images.length > 0 ? images : undefined);
    setText('');
    setImages([]);
    inputRef.current?.focus();
  }, [text, images, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          setImages(prev => [
            ...prev,
            { base64, mimeType: file.type, name: file.name, previewUrl: result },
          ]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <div className="ed-input-area">
      {images.length > 0 && (
        <ImageUpload images={images} onImagesChange={setImages} disabled={disabled} />
      )}
      <div className="ed-input-row">
        {images.length === 0 && (
          <ImageUpload images={[]} onImagesChange={setImages} disabled={disabled} />
        )}
        <textarea
          ref={inputRef}
          className="ed-input"
          placeholder="Talk to Ed..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          rows={1}
        />
        {voiceButton}
        <button
          className="ed-send-btn"
          onClick={handleSend}
          disabled={disabled || (!text.trim() && images.length === 0)}
          title="Send (Enter)"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
