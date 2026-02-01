/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { HandDrawnAttachment } from './icons';
import { GenerationSettings } from '../types';

export interface PromptInputHandle {
  triggerFileUpload: () => void;
}

interface PromptInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onSubmit: () => void;
  onAnalyze: () => void;
  isLoading: boolean;
  isGenerating: boolean;
  isFirstRun: boolean;
  mode: 'image' | 'story' | 'video' | 'image-to-image' | 'video-multiframe' | 'audio' | 'comic';
  settings: GenerationSettings;
  updateSettings: (updates: Partial<GenerationSettings>) => void;
  audioText?: string;
  setAudioText?: (text: string) => void;
}

const PromptInput = forwardRef<PromptInputHandle, PromptInputProps>(({ 
  prompt, 
  setPrompt, 
  onSubmit,
  onAnalyze,
  isLoading, 
  isGenerating, 
  isFirstRun, 
  mode, 
  settings,
  updateSettings,
  audioText = '',
  setAudioText
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useImperativeHandle(ref, () => ({
    triggerFileUpload: () => {
      fileInputRef.current?.click();
    }
  }));

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const readers = Array.from(files).map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      Promise.all(readers).then(newImages => {
        const maxImages = 4;
        updateSettings({ referenceImages: [...settings.referenceImages, ...newImages].slice(0, maxImages) });
      });
    }
    if (event.target) event.target.value = '';
  };

  const removeImage = (index: number) => {
    updateSettings({ referenceImages: settings.referenceImages.filter((_, i) => i !== index) });
  };

  const triggerFileUpload = () => {
      fileInputRef.current?.click();
  };

  const getPlaceholder = () => {
      if (mode === 'video') return "描述视频内容... (可上传图片作为关键帧)";
      if (mode === 'video-multiframe') return "描述关键帧的运镜节奏...";
      if (mode === 'audio' && settings.audioMode === 'music') return "描述配乐氛围 (例如: 赛博朋克雨夜)...";
      if (mode === 'comic') return "输入故事大纲或小说片段...";
      return "在此描述您的创意...";
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <input 
        type="file" 
        multiple
        accept="image/*" 
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        disabled={isLoading}
      />
      
      <div className="flex-grow relative bg-black/20 rounded-2xl border border-white/5 overflow-hidden focus-within:border-ai-accent/50 focus-within:bg-black/30 transition-all">
        {mode === 'audio' ? (
            <div className="flex flex-col h-full divide-y divide-white/5">
                 <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={settings.audioMode === 'music' ? "配乐氛围描述..." : "情感与语气指导..."}
                    className="w-full h-1/2 bg-transparent p-4 text-gray-200 placeholder-gray-600 outline-none resize-none text-sm leading-relaxed"
                    disabled={isLoading}
                />
                {settings.audioMode === 'speech' && (
                    <textarea
                        value={audioText}
                        onChange={(e) => setAudioText?.(e.target.value)}
                        placeholder="朗读文本内容..."
                        className="w-full h-1/2 bg-transparent p-4 text-gray-200 placeholder-gray-600 outline-none resize-none text-sm leading-relaxed"
                        disabled={isLoading}
                    />
                )}
            </div>
        ) : (
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={getPlaceholder()}
                className="w-full h-full bg-transparent p-4 text-gray-200 placeholder-gray-600 outline-none resize-none text-sm leading-relaxed"
                disabled={isLoading}
            />
        )}
      </div>

      {settings.referenceImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {settings.referenceImages.map((img, idx) => (
                <div key={idx} className="relative w-16 h-16 bg-black/50 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 group">
                    <img src={img} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                    <button 
                        onClick={() => removeImage(idx)}
                        disabled={isLoading}
                        className="absolute top-0 right-0 p-0.5 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            ))}
          </div>
      )}

      <div className={`flex gap-3 items-center pt-2 ${isLoading ? "opacity-50 pointer-events-none" : ""}`}>
            {mode !== 'audio' && (
                <>
                    <button 
                        onClick={triggerFileUpload}
                        className="text-gray-400 hover:text-ai-accent transition-colors p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
                        title="上传图片"
                    >
                        <HandDrawnAttachment className="h-5 w-5" />
                    </button>

                    {(mode === 'image' || mode === 'image-to-image') && (
                        <div className="flex items-center bg-black/20 rounded-lg p-0.5 border border-white/5">
                            {[1, 2, 3, 4].map(n => (
                                <button
                                    key={n}
                                    onClick={() => updateSettings({ imageCount: n })}
                                    className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-md transition-all ${
                                        settings.imageCount === n 
                                        ? 'bg-white/10 text-white shadow-sm' 
                                        : 'text-gray-600 hover:text-gray-400'
                                    }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

            <div className="flex-1"></div>

            <button
            onClick={(e) => { e.preventDefault(); onAnalyze(); }}
            className={`text-xs font-semibold text-gray-500 hover:text-white px-4 py-2 transition-colors ${mode === 'audio' ? 'hidden' : ''}`}
            >
                深度分析
            </button>

            <button
            onClick={(e) => { e.preventDefault(); onSubmit(); }}
            className="bg-ai-accent hover:bg-ai-accent-hover text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-all shadow-glow hover:shadow-glow-lg active:scale-95 text-xs tracking-wide"
            >
            {isGenerating && (
                <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            )}
            <span>{isFirstRun ? "立即生成" : "重新生成"}</span>
            </button>
      </div>
    </div>
  );
});

export default PromptInput;