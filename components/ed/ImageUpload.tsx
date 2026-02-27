'use client';

import { useCallback, useState } from 'react';
import { Image, X } from 'lucide-react';

interface ImagePreview {
  base64: string;
  mimeType: string;
  name: string;
  previewUrl: string;
}

interface ImageUploadProps {
  images: ImagePreview[];
  onImagesChange: (images: ImagePreview[]) => void;
  disabled?: boolean;
}

export type { ImagePreview };

export default function ImageUpload({ images, onImagesChange, disabled }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 10 * 1024 * 1024) return; // 10MB limit

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:image/...;base64, prefix
        const base64 = result.split(',')[1];
        const preview: ImagePreview = {
          base64,
          mimeType: file.type,
          name: file.name,
          previewUrl: result,
        };
        onImagesChange([...images, preview]);
      };
      reader.readAsDataURL(file);
    },
    [images, onImagesChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      Array.from(e.dataTransfer.files).forEach(processFile);
    },
    [processFile, disabled],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return;
      const items = Array.from(e.clipboardData.items);
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) processFile(file);
        }
      }
    },
    [processFile, disabled],
  );

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  if (images.length === 0) {
    return (
      <div
        className={`ed-image-drop ${isDragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <label className="ed-image-btn" title="Attach image">
          <Image size={16} />
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) Array.from(e.target.files).forEach(processFile);
            }}
            disabled={disabled}
          />
        </label>
      </div>
    );
  }

  return (
    <div
      className="ed-image-previews"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {images.map((img, i) => (
        <div key={i} className="ed-image-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.previewUrl} alt={img.name} />
          <button className="ed-image-remove" onClick={() => removeImage(i)} type="button">
            <X size={12} />
          </button>
        </div>
      ))}
      <label className="ed-image-btn" title="Add more images">
        <Image size={16} />
        <input
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) Array.from(e.target.files).forEach(processFile);
          }}
          disabled={disabled}
        />
      </label>
    </div>
  );
}
