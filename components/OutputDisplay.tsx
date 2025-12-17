/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ImageGenerationItem } from '../types';

const ErrorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

interface OutputDisplayProps {
  imageHistory: ImageGenerationItem[];
  story: string | null;
  video: string | null;
  mode: 'image' | 'story' | 'video' | 'image-to-image';
  isLoading: boolean;
  error: string | null;
  isOutdated: boolean;
  requiresApiKey?: boolean;
  onSelectKey?: () => void;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ 
    imageHistory, 
    story, 
    video, 
    mode, 
    isLoading, 
    error, 
    isOutdated,
    requiresApiKey,
    onSelectKey
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const activePointersRef = useRef<Map<number, {x: number, y: number}>>(new Map());
  const prevPinchDistRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Focus on new generation
  useEffect(() => {
      if (imageHistory.length > 0 && !isLoading) {
          // Reset view to top (newest) when new image arrives
          setViewTransform({ x: 0, y: 20, k: 1 });
      }
  }, [imageHistory.length, isLoading]);

  const placeholderCount = 4;

  const downloadFile = (url: string, filename: string) => {
    const element = document.createElement("a");
    element.href = url;
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadStory = () => {
    if (!story) return;
    const file = new Blob([story], {type: 'text/plain'});
    const url = URL.createObjectURL(file);
    downloadFile(url, "generated_story.txt");
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const copyStory = () => {
      if (!story) return;
      navigator.clipboard.writeText(story);
  };

  // --- Canvas Interaction Logic (Copied/Adapted from BeliefGraph) ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'image' && mode !== 'image-to-image') return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    e.preventDefault(); 
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 1) { 
        setIsDragging(true); 
        dragStartRef.current = { x: e.clientX, y: e.clientY }; 
    }
    if (activePointersRef.current.size === 2) { prevPinchDistRef.current = null; }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if ((mode !== 'image' && mode !== 'image-to-image') || !activePointersRef.current.has(e.pointerId)) return;
    e.preventDefault(); 
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pointers: {x: number, y: number}[] = Array.from(activePointersRef.current.values());
    
    if (pointers.length === 2) {
        const dist = Math.sqrt(Math.pow(pointers[1].x - pointers[0].x, 2) + Math.pow(pointers[1].y - pointers[0].y, 2));
        if (prevPinchDistRef.current !== null) {
            const zoomFactor = dist / prevPinchDistRef.current;
            setViewTransform(prev => ({ ...prev, k: Math.min(4, Math.max(0.1, prev.k * zoomFactor)) }));
        }
        prevPinchDistRef.current = dist;
    } else if (pointers.length === 1 && isDragging && dragStartRef.current) {
        const dx = pointers[0].x - dragStartRef.current.x;
        const dy = pointers[0].y - dragStartRef.current.y;
        setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        dragStartRef.current = { x: pointers[0].x, y: pointers[0].y };
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (mode !== 'image' && mode !== 'image-to-image') return;
      canvasRef.current?.releasePointerCapture(e.pointerId);
      activePointersRef.current.delete(e.pointerId);
      if (activePointersRef.current.size < 2) prevPinchDistRef.current = null;
      if (activePointersRef.current.size === 0) { setIsDragging(false); dragStartRef.current = null; }
      else if (activePointersRef.current.size === 1) {
          const p = activePointersRef.current.values().next().value as {x: number, y: number};
          dragStartRef.current = { x: p.x, y: p.y };
      }
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (mode !== 'image' && mode !== 'image-to-image') return;
      e.preventDefault(); 
      const delta = -e.deltaY * 0.001;
      setViewTransform(prev => ({ ...prev, k: Math.min(4, Math.max(0.1, prev.k * Math.exp(delta))) }));
  };

  const zoomIn = () => setViewTransform(prev => ({ ...prev, k: Math.min(4, prev.k * 1.2) }));
  const zoomOut = () => setViewTransform(prev => ({ ...prev, k: Math.max(0.1, prev.k / 1.2) }));
  const resetView = () => setViewTransform({ x: 0, y: 20, k: 1 });

  // --- Render Helpers ---

  const renderVideoContent = () => {
    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                 <svg className="animate-spin h-8 w-8 text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="mt-2 text-sm">正在生成视频...</span>
            </div>
        );
    }
    if (video) {
        return (
            <div className="flex flex-col items-center justify-center min-h-full w-full p-4">
                <div className="w-full max-w-lg bg-black rounded-lg overflow-hidden shadow-lg border border-gray-800 relative group shrink-0">
                     <video controls className="w-full h-auto" src={video}>
                        Your browser does not support the video tag.
                     </video>
                </div>
                <a 
                    href={video} 
                    download="generated-video.mp4" 
                    className="mt-4 text-blue-600 dark:text-blue-400 text-sm hover:underline flex items-center gap-1 shrink-0"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载视频
                </a>
            </div>
        )
    }
    return (
        <div className="h-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-8 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">生成的视频将显示在此处。</p>
        </div>
    );
  };

  const renderStoryContent = () => {
      if (isLoading) {
          return (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                   <svg className="animate-spin h-8 w-8 text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="mt-2 text-sm">正在撰写故事...</span>
              </div>
          );
      }
      if(story) {
          return (
              <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-700">
                  {story.split('\n').map((paragraph, index) => <p key={index} className="text-gray-800 dark:text-gray-200">{paragraph}</p>)}
              </div>
          )
      }
      return (
        <div className="h-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-8 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium">您的创意故事将显示在此处。</p>
        </div>
      );
  };
  
  const renderError = () => (
      <div className="h-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg flex flex-col items-center justify-center p-4 text-center">
          <ErrorIcon />
          <h3 className="mt-4 font-semibold text-red-800 dark:text-red-200">生成失败</h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300 max-w-md">{error}</p>
      </div>
  );
  
  if (requiresApiKey) {
      return (
         <div className="bg-white dark:bg-gray-800 rounded-lg p-4 h-full border border-gray-200 dark:border-gray-700 flex flex-col relative overflow-hidden transition-colors duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 flex-shrink-0">
                 <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">视频生成</h2>
            </div>
            <div className="h-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg flex flex-col items-center justify-center p-8 text-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-amber-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.543 17.543A2 2 0 0110.129 18H9a2 2 0 01-2-2v-1a2 2 0 01.586-1.414l5.223-5.223A2 2 0 0014 9a2 2 0 012-2z" />
                </svg>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">需要计费账户</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm max-w-sm mb-6">
                    使用 Veo 生成视频需要 Google Cloud 的付费 API 密钥。请选择密钥以继续。
                    <br/>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline mt-2 inline-block">了解更多关于计费的信息</a>
                </p>
                <button 
                    onClick={onSelectKey}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors shadow-md flex items-center gap-2"
                >
                    <span>选择 API 密钥</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </button>
            </div>
         </div>
      );
  }

  // --- Mode: Image & Image-to-Image (Infinite Canvas) ---
  if (mode === 'image' || mode === 'image-to-image') {
      const renderHistoryItem = (item: ImageGenerationItem, index: number) => {
          // Calculate Y position based on index (stacking them vertically)
          // Assume each block takes roughly 650px (including gap)
          const yPos = index * 650;
          
          return (
              <div 
                key={item.id} 
                className="absolute left-1/2 transform -translate-x-1/2 w-[600px] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 transition-colors"
                style={{ top: yPos }}
                onPointerDown={(e) => e.stopPropagation()} // Prevent pan start when clicking card
              >
                  <div className="flex justify-between items-start mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
                      <div className="flex gap-3">
                         {item.referenceImage && (
                             <div className="flex-shrink-0 w-12 h-12 rounded border border-gray-300 dark:border-gray-600 overflow-hidden relative group" title="参考图片">
                                 <img src={item.referenceImage} alt="Ref" className="w-full h-full object-cover" />
                                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                     <span className="text-[8px] font-bold text-white bg-black/50 px-1 rounded opacity-0 group-hover:opacity-100">REF</span>
                                 </div>
                             </div>
                         )}
                          <div>
                              <span className="text-xs font-mono text-gray-400 dark:text-gray-500 block mb-1">
                                  {new Date(item.timestamp).toLocaleTimeString()} · Ratio {item.aspectRatio}
                              </span>
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2" title={item.prompt}>
                                  {item.prompt}
                              </p>
                          </div>
                      </div>
                      <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 self-start">
                          #{imageHistory.length - index}
                      </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                      {item.images.map((img, i) => (
                          <div 
                            key={i} 
                            className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative group cursor-zoom-in border border-gray-100 dark:border-gray-600"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImage(img);
                            }}
                          >
                              <img src={img} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                              <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    downloadFile(img, `generated-image-${item.id}-${i + 1}.png`);
                                }}
                                className="absolute bottom-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-sm"
                                title="保存图片"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          );
      };

      const renderLoadingPlaceholder = () => {
          if (!isLoading) return null;
          // Place loading placeholder at the top (index -1 effectively, but let's put it above index 0)
          const yPos = -650; 
          
          return (
            <div 
                className="absolute left-1/2 transform -translate-x-1/2 w-[600px] bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-blue-200 dark:border-blue-900 p-6 flex flex-col items-center justify-center gap-4 animate-pulse z-10"
                style={{ top: yPos, height: 600 }}
            >
                 <div className="flex flex-col items-center text-blue-500 dark:text-blue-400">
                      <svg className="animate-spin h-10 w-10 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="font-medium">AI 正在绘制您的想象...</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full opacity-50">
                      {[1,2,3,4].map(i => (
                          <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                      ))}
                  </div>
            </div>
          );
      };

      return (
        <div className="flex h-full w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden relative">
            
            {/* Main Canvas Area */}
            <div 
                ref={canvasRef}
                className="flex-grow h-full relative overflow-hidden cursor-grab active:cursor-grabbing touch-none"
                style={{ 
                    backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    backgroundColor: 'var(--canvas-bg, transparent)'
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onWheel={handleWheel}
            >
                {/* Canvas Controls */}
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-20 pointer-events-auto">
                    <button onClick={zoomIn} className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-md text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600" title="放大">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    </button>
                    <button onClick={zoomOut} className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-md text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600" title="缩小">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                    </button>
                    <button onClick={resetView} className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-md text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600" title="重置视图">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    </button>
                </div>

                {/* Content Container with Transform */}
                <div 
                    className="absolute w-full h-full pointer-events-none" // Items inside have pointer-events-auto
                    style={{
                        transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.k})`,
                        transformOrigin: '0 0',
                    }}
                >
                    {/* Render History Items */}
                    <div className="relative w-full h-full pointer-events-auto">
                        {/* Adjust origin to be center-top of viewport initially */}
                        <div className="absolute left-1/2 top-10" style={{ width: 0, height: 0 }}>
                             {renderLoadingPlaceholder()}
                             {imageHistory.length === 0 && !isLoading && (
                                 <div className="absolute left-1/2 transform -translate-x-1/2 top-20 w-64 text-center text-gray-400 dark:text-gray-500">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                     <p>画布空白。开始生成图片吧！</p>
                                 </div>
                             )}
                             {imageHistory.map((item, index) => renderHistoryItem(item, index))}
                        </div>
                    </div>
                </div>
            </div>

            {/* History Sidebar */}
            <div className="w-48 xl:w-64 bg-white dark:bg-gray-850 border-l border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0 z-30">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    历史记录 ({imageHistory.length})
                </div>
                <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    {imageHistory.map((item, index) => (
                        <button 
                            key={item.id}
                            onClick={() => {
                                // Jump to item position
                                // Item Y is index * 650
                                const targetY = index * 650;
                                // We want this targetY to be somewhat centered or at top. 
                                // Let's aim for top + padding
                                const newY = -targetY * viewTransform.k + 50; 
                                setViewTransform(prev => ({ ...prev, y: newY }));
                            }}
                            className="w-full text-left p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group flex gap-3 items-start"
                        >
                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden flex-shrink-0 relative">
                                {item.images[0] && <img src={item.images[0]} className="w-full h-full object-cover" alt="" />}
                                {item.referenceImage && <div className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 rounded-tl-sm border-white border"></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-800 dark:text-gray-200 font-medium truncate mb-0.5">
                                    {item.prompt}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                    {new Date(item.timestamp).toLocaleTimeString()}
                                    {item.referenceImage && " (图生图)"}
                                </p>
                            </div>
                        </button>
                    ))}
                    {imageHistory.length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-400">暂无记录</div>
                    )}
                </div>
            </div>

            {/* Image Modal (Shared) */}
            {selectedImage && (
                <div className="fixed inset-0 z-[3000] bg-black/90 flex justify-center p-4 backdrop-blur-sm overflow-y-auto" onClick={() => setSelectedImage(null)}>
                    <button 
                        onClick={() => setSelectedImage(null)}
                        className="fixed top-4 right-4 z-[3010] text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-all backdrop-blur-sm"
                        aria-label="Close Preview"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    
                    <div className="min-h-full w-full flex flex-col items-center justify-center pointer-events-none py-8 pb-20" onClick={e => e.stopPropagation()}>
                        <img 
                            src={selectedImage} 
                            alt="Full view" 
                            className="max-w-full max-h-[70vh] md:max-h-[85vh] object-contain rounded-lg shadow-2xl pointer-events-auto" 
                        />
                        <div className="mt-4 flex gap-4 pointer-events-auto flex-shrink-0">
                            <button
                                onClick={() => downloadFile(selectedImage, "generated-image.jpg")}
                                className="bg-white text-gray-900 px-6 py-2 rounded-full font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-lg"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                下载图片
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // --- Mode: Story/Video (Standard View) ---
  return (
    <>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 h-full border border-gray-200 dark:border-gray-700 flex flex-col relative overflow-hidden transition-colors duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                    {mode === 'video' ? '视频生成' : '创意写作'}
                </h2>
                {mode === 'story' && story && !isLoading && (
                    <div className="flex gap-2">
                        <button onClick={copyStory} className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" title="复制到剪贴板">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                        <button onClick={downloadStory} className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" title="下载文本">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
            
            <div className="flex-grow min-h-0 relative">
                {error ? renderError() : (
                    mode === 'video' ? (
                         <div className="h-full overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                            {renderVideoContent()}
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                            {renderStoryContent()}
                        </div>
                    )
                )}
                
                {isOutdated && !isLoading && !requiresApiKey && (story || video) && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-[2px] flex items-center justify-center z-10 rounded-lg transition-all duration-300 pointer-events-none">
                        <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 text-center transform scale-100 pointer-events-auto">
                            <div className="text-amber-500 mb-2 flex justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">结果已过期</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">提示词已更改。</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </>
  );
};

export default OutputDisplay;