'use client';

import { useRef } from 'react';
import { Upload, FileText, X, Square, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UploadedFile } from '@/components/openxrec/types';

type OpenXRecComposerProps = {
  uploadedFiles: UploadedFile[];
  input: string;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (fileId: string) => void;
  onSend: () => void;
  onStop: () => void;
};

export function OpenXRecComposer({
  uploadedFiles,
  input,
  isLoading,
  inputRef,
  onInputChange,
  onFileUpload,
  onRemoveFile,
  onSend,
  onStop,
}: OpenXRecComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full text-sm"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span className="max-w-[150px] truncate">{file.name}</span>
              <button
                onClick={() => onRemoveFile(file.id)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf,.doc,.docx"
          className="hidden"
          onChange={onFileUpload}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          title="上传文档"
        >
          <Upload className="w-4 h-4" />
        </Button>
        <Input
          ref={inputRef}
          placeholder="描述您的需求..."
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
          className="flex-1"
        />
        {isLoading && (
          <Button
            variant="destructive"
            onClick={onStop}
            title="停止当前任务"
          >
            <Square className="w-4 h-4" />
          </Button>
        )}
        <Button onClick={onSend} disabled={isLoading} data-send-button>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </>
  );
}
