/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface PromptInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  resolution?: '720p' | '1080p';
  setResolution?: (res: '720p' | '1080p') => void;
  imageCount: number;
  setImageCount: (count: number) => void;
  imageStyle: string;
  setImageStyle: (style: string) => void;
  imageSize: '1K' | '2K' | '4K';
  setImageSize: (size: '1K' | '2K' | '4K') => void;
  onSubmit: () => void;
  onAnalyze: () => void;
  isLoading: boolean;
  isGenerating: boolean;
  isFirstRun: boolean;
  mode: 'image' | 'story' | 'video' | 'image-to-image';
  setMode: (mode: 'image' | 'story' | 'video' | 'image-to-image') => void;
  referenceImages: string[];
  setReferenceImages: (imgs: string[]) => void;
}

const PromptInput: React.FC<PromptInputProps> = ({ 
  prompt, 
  setPrompt, 
  resolution,
  setResolution,
  onSubmit,
  onAnalyze,
  isLoading, 
  isGenerating, 
  isFirstRun, 
  mode, 
  setMode,
  referenceImages,
  setReferenceImages
}) => {
  
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
  };

  const removeImage = (index: number) => {
    setReferenceImages(referenceImages.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col transition-colors duration-200">
      <div className="px-4 py-2 md:py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center relative">
        <h2 className="text-base md:text-lg font-semibold text-gray-700 dark:text-gray-200">提示词</h2>
      </div>
      
      <div className="p-3 md:p-5 flex flex-col gap-3 md:gap-4">
        <div className={`w-full relative ${isLoading ? 'cursor-not-allowed' : ''}`}>
            <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想创作的内容..."
            className="w-full h-16 md:h-24 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-none text-sm md:text-base leading-relaxed shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
            disabled={isLoading}
            />
        </div>

        {mode === 'image-to-image' && (
            <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">参考图片 (最多4张):</label>
                <div className="flex flex-wrap gap-3">
                    {referenceImages.map((img, idx) => (
                        <div key={idx} className="relative w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 group">
                            <img src={img} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                            <button 
                                onClick={() => removeImage(idx)}
                                disabled={isLoading}
                                className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))}
                    {referenceImages.length < 4 && (
                        <div className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors relative cursor-pointer">
                            <input 
                                type="file" 
                                multiple
                                accept="image/*" 
                                onChange={handleFileChange} 
                                disabled={isLoading}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                    )}
                </div>
            </div>
        )}
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <div className={`flex flex-wrap bg-gray-100 dark:bg-gray-700 p-1 rounded-lg transition-colors overflow-x-auto max-w-full ${isLoading ? 'cursor-not-allowed opacity-75' : ''}`}>
                    <button onClick={() => setMode('image')} disabled={isLoading} className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all text-xs md:text-sm font-medium ${mode === 'image' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
                        <span>图片</span>
                    </button>
                    <button onClick={() => setMode('story')} disabled={isLoading} className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all text-xs md:text-sm font-medium ${mode === 'story' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
                        <span>故事</span>
                    </button>
                    <button onClick={() => setMode('video')} disabled={isLoading} className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all text-xs md:text-sm font-medium ${mode === 'video' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
                        <span>视频</span>
                    </button>
                    <button onClick={() => setMode('image-to-image')} disabled={isLoading} className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all text-xs md:text-sm font-medium ${mode === 'image-to-image' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
                        <span>图生图</span>
                    </button>
                </div>

                {mode === 'video' && resolution && setResolution && (
                    <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-700/50 p-1 rounded-lg border border-gray-200 dark:border-gray-600">
                        <select value={resolution} onChange={(e) => setResolution(e.target.value as '720p' | '1080p')} className="bg-transparent border-none rounded-md text-xs py-1 text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer font-medium" disabled={isLoading}>
                            <option value="720p">720p</option>
                            <option value="1080p">1080p</option>
                        </select>
                    </div>
                )}
            </div>

            <div className={`flex gap-2 ${isLoading || !prompt || (mode === 'image-to-image' && referenceImages.length === 0) ? "cursor-not-allowed" : ""}`}>
                <button
                onClick={(e) => { e.preventDefault(); onAnalyze(); }}
                disabled={isLoading || !prompt || (mode === 'image-to-image' && referenceImages.length === 0)}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200 font-semibold py-1.5 md:py-2 px-3 md:px-4 rounded-lg flex items-center justify-center transition-all text-sm md:text-base disabled:pointer-events-none"
                >
                    <span>分析</span>
                </button>

                <button
                onClick={(e) => { e.preventDefault(); onSubmit(); }}
                disabled={isLoading || !prompt || (mode === 'image-to-image' && referenceImages.length === 0)}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-1.5 md:py-2 px-4 md:px-6 rounded-lg flex items-center justify-center space-x-2 transition-all shadow-sm text-sm md:text-base"
                >
                {isGenerating && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                <span>{isFirstRun ? "生成" : "重新生成"}</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PromptInput;
