
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef } from 'react';
import { HandDrawnAttachment } from './icons';

interface PromptInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onSubmit: () => void;
  onAnalyze: () => void;
  isLoading: boolean;
  isGenerating: boolean;
  isFirstRun: boolean;
  mode: 'image' | 'story' | 'video' | 'image-to-image';
  referenceImages: string[];
  setReferenceImages: (imgs: string[]) => void;
}

const PromptInput: React.FC<PromptInputProps> = ({ 
  prompt, 
  setPrompt, 
  onSubmit,
  onAnalyze,
  isLoading, 
  isGenerating, 
  isFirstRun, 
  mode, 
  referenceImages,
  setReferenceImages
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
        setReferenceImages([...referenceImages, ...newImages].slice(0, 4)); // Max 4 images
      });
    }
    // Reset file input so same file can be selected again if needed
    if (event.target) event.target.value = '';
  };

  const removeImage = (index: number) => {
    setReferenceImages(referenceImages.filter((_, i) => i !== index));
  };

  const triggerFileUpload = () => {
      fileInputRef.current?.click();
  };

  return (
    <div className="bg-ai-dark/50 rounded-2xl border border-ai-border shadow-sm overflow-hidden flex flex-col transition-colors duration-200 h-full">
      <input 
        type="file" 
        multiple
        accept="image/*" 
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        disabled={isLoading}
      />
      
      <div className="p-3 flex flex-col gap-3 h-full">
        <div className={`w-full relative flex-grow ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}>
            <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="在此描述您的创意..."
            className="w-full h-full bg-ai-dark border border-ai-border rounded-xl p-4 text-gray-100 placeholder-gray-600 focus:ring-1 focus:ring-ai-accent focus:border-ai-accent focus:outline-none resize-none text-sm leading-relaxed shadow-inner transition-all disabled:pointer-events-none min-h-[100px]"
            disabled={isLoading}
            />
        </div>

        {/* Reference Image Area - Always show if images exist, or if user wants to add */}
        <div className="flex flex-col gap-2 min-h-[110px]">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    参考图片 {referenceImages.length > 0 && `(${referenceImages.length}/4)`}
                </label>
            </div>
            <div className="flex flex-wrap gap-3">
                {referenceImages.map((img, idx) => (
                    <div key={idx} className="relative w-24 h-24 bg-ai-dark rounded-xl overflow-hidden border border-ai-border group shadow-md hover:border-ai-accent/50 transition-all">
                        <img src={img} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                        <button 
                            onClick={() => removeImage(idx)}
                            disabled={isLoading}
                            className="absolute top-1 right-1 bg-black/70 hover:bg-red-600 text-white rounded-full p-1 transition-colors backdrop-blur-sm opacity-0 group-hover:opacity-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                ))}
                
                {/* Large Add Button - Visible when < 4 images */}
                {referenceImages.length < 4 && (
                    <button 
                        onClick={triggerFileUpload}
                        disabled={isLoading}
                        className="w-24 h-24 border-2 border-dashed border-ai-border rounded-xl flex flex-col items-center justify-center text-gray-500 hover:text-ai-accent hover:border-ai-accent hover:bg-ai-accent/10 transition-all bg-ai-dark/30 group"
                        title="添加参考图片"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-[10px] font-bold uppercase tracking-wider">添加</span>
                    </button>
                )}
            </div>
        </div>
        
        <div className={`flex gap-3 items-center pt-2 border-t border-ai-border/30 ${isLoading || !prompt ? "cursor-not-allowed opacity-80" : ""}`}>
            {/* Quick attachment icon as fallback/alternative */}
            <button 
                onClick={triggerFileUpload}
                disabled={isLoading}
                className="text-gray-400 hover:text-ai-accent transition-colors p-2 rounded-lg hover:bg-white/5"
                title="添加参考图片"
            >
                <HandDrawnAttachment className="h-5 w-5" />
            </button>

            <div className="flex-1"></div>

            <button
            onClick={(e) => { e.preventDefault(); onAnalyze(); }}
            disabled={isLoading || !prompt}
            className="bg-transparent hover:bg-white/5 border border-ai-border text-gray-400 hover:text-gray-200 font-semibold py-2 px-4 rounded-xl flex items-center justify-center transition-all text-xs disabled:opacity-50 disabled:pointer-events-none"
            >
                <span>深度分析</span>
            </button>

            <button
            onClick={(e) => { e.preventDefault(); onSubmit(); }}
            disabled={isLoading || !prompt}
            className="bg-ai-accent hover:bg-ai-accent-hover text-white disabled:opacity-50 font-bold py-2 px-6 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg shadow-ai-accent/20 text-xs"
            >
            {isGenerating && (
                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            <span>{isFirstRun ? "立即生成" : "重新生成"}</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default PromptInput;
