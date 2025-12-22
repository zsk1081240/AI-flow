
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImageGenerationItem } from '../types';

const ErrorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  // Lightbox State
  const [lightbox, setLightbox] = useState<{ historyIndex: number, imageIndex: number } | null>(null);
  
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 20, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const activePointersRef = useRef<Map<number, {x: number, y: number}>>(new Map());
  const prevPinchDistRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (imageHistory.length > 0 && !isLoading) {
          setViewTransform({ x: 0, y: 20, k: 1 });
      }
  }, [imageHistory.length, isLoading]);

  const downloadFile = useCallback((url: string, filename: string) => {
    const element = document.createElement("a");
    element.href = url;
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }, []);

  const downloadAllInSet = (item: ImageGenerationItem) => {
      item.images.forEach((img, i) => {
          setTimeout(() => {
              downloadFile(img, `Set_${item.id}_${i + 1}.png`);
          }, i * 200); // Stagger downloads to prevent browser blocking
      });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'image' && mode !== 'image-to-image') return;
    if ((e.target as HTMLElement).closest('button')) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 1) { 
        setIsDragging(true); 
        dragStartRef.current = { x: e.clientX, y: e.clientY }; 
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if ((mode !== 'image' && mode !== 'image-to-image') || !activePointersRef.current.has(e.pointerId)) return;
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
      canvasRef.current?.releasePointerCapture(e.pointerId);
      activePointersRef.current.delete(e.pointerId);
      if (activePointersRef.current.size === 0) { setIsDragging(false); dragStartRef.current = null; }
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (mode !== 'image' && mode !== 'image-to-image') return;
      const delta = -e.deltaY * 0.001;
      setViewTransform(prev => ({ ...prev, k: Math.min(4, Math.max(0.1, prev.k * Math.exp(delta))) }));
  };

  const zoomIn = () => setViewTransform(prev => ({ ...prev, k: Math.min(4, prev.k * 1.2) }));
  const zoomOut = () => setViewTransform(prev => ({ ...prev, k: Math.max(0.1, prev.k / 1.2) }));
  const resetView = () => setViewTransform({ x: 0, y: 20, k: 1 });

  // Lightbox Navigation
  const navigateLightbox = (direction: number) => {
      if (!lightbox) return;
      const currentItem = imageHistory[lightbox.historyIndex];
      let newImgIndex = lightbox.imageIndex + direction;
      
      if (newImgIndex >= currentItem.images.length) {
          // Go to next history item if available
          if (lightbox.historyIndex > 0) {
              setLightbox({ historyIndex: lightbox.historyIndex - 1, imageIndex: 0 });
          } else {
              setLightbox({ ...lightbox, imageIndex: 0 });
          }
      } else if (newImgIndex < 0) {
          // Go to prev history item if available
          if (lightbox.historyIndex < imageHistory.length - 1) {
              const prevItem = imageHistory[lightbox.historyIndex + 1];
              setLightbox({ historyIndex: lightbox.historyIndex + 1, imageIndex: prevItem.images.length - 1 });
          } else {
              setLightbox({ ...lightbox, imageIndex: currentItem.images.length - 1 });
          }
      } else {
          setLightbox({ ...lightbox, imageIndex: newImgIndex });
      }
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!lightbox) return;
          if (e.key === 'Escape') setLightbox(null);
          if (e.key === 'ArrowLeft') navigateLightbox(-1);
          if (e.key === 'ArrowRight') navigateLightbox(1);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox, imageHistory]);

  if (requiresApiKey) {
      return (
         <div className="bg-white dark:bg-gray-800 rounded-lg p-4 h-full border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center">
            <h3 className="text-lg font-bold mb-2">需要付费账户</h3>
            <button onClick={onSelectKey} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">选择 API 密钥</button>
         </div>
      );
  }

  if (mode === 'image' || mode === 'image-to-image') {
      return (
        <div className="flex h-full w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden relative">
            <div ref={canvasRef} className="flex-grow h-full relative overflow-hidden cursor-grab active:cursor-grabbing touch-none" style={{ backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onWheel={handleWheel}>
                
                {/* Control Panel */}
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                    <div className="flex flex-col bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-1.5 gap-1">
                        <button onClick={zoomIn} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300" title="放大">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </button>
                        <button onClick={zoomOut} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300" title="缩小">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                        </button>
                        <div className="h-px bg-gray-200 dark:bg-gray-700 mx-1" />
                        <button onClick={resetView} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300" title="重置">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>
                </div>

                <div className="absolute w-full h-full pointer-events-none" style={{ transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.k})`, transformOrigin: '0 0' }}>
                    <div className="absolute left-1/2 top-10" style={{ width: 0, height: 0 }}>
                        {isLoading && (
                            <div className="absolute left-1/2 transform -translate-x-1/2 w-[600px] h-[400px] bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-2 border-dashed border-blue-400 animate-pulse flex flex-col items-center justify-center gap-2 z-10">
                                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-blue-600 font-bold">正在捕捉灵感...</span>
                            </div>
                        )}
                        {imageHistory.map((item, hIdx) => (
                            <div key={item.id} className="absolute left-1/2 transform -translate-x-1/2 w-[600px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5 pointer-events-auto transition-colors" style={{ top: hIdx * 680 }}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1 pr-4">
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-2" title={item.prompt}>{item.prompt}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">ID: {item.id.slice(-6)}</span>
                                            <span className="text-[10px] text-gray-400">{new Date(item.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => downloadAllInSet(item)}
                                            className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 bg-gray-50 dark:bg-gray-700 rounded-lg transition-all"
                                            title="保存全组图片"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {item.images.map((img, iIdx) => (
                                        <div key={iIdx} className="group relative aspect-square bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 transition-all shadow-sm">
                                            <img src={img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Generated" />
                                            
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                            
                                            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                                <button 
                                                    onClick={() => setLightbox({ historyIndex: hIdx, imageIndex: iIdx })}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-md hover:bg-white/40 text-white rounded-lg text-xs font-medium border border-white/30 transition-all"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                    预览
                                                </button>
                                                <button 
                                                    onClick={() => downloadFile(img, `Creation_${item.id}_${iIdx+1}.png`)}
                                                    className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg"
                                                    title="下载"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar History */}
            <div className="w-56 xl:w-72 bg-white dark:bg-gray-850 border-l border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0 z-30 shadow-2xl overflow-hidden transition-colors">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <span className="font-bold text-xs uppercase text-gray-400 tracking-widest">时光轴 ({imageHistory.length})</span>
                </div>
                <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 p-2 space-y-2">
                    {imageHistory.map((item, idx) => (
                        <button 
                            key={item.id} 
                            onClick={() => setViewTransform(prev => ({ ...prev, y: -idx * 680 * prev.k + 40 }))} 
                            className="w-full text-left p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group border border-transparent hover:border-blue-100 dark:hover:border-blue-800"
                        >
                            <div className="flex gap-3 items-center">
                                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700 group-hover:border-blue-300 transition-colors">
                                    <img src={item.images[0]} className="w-full h-full object-cover" alt="" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate leading-tight">{item.prompt}</p>
                                    <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}
                    {imageHistory.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className="text-xs italic">暂无创作</span>
                        </div>
                    )}
                </div>
            </div>

            {/* LIGHTBOX MODAL */}
            {lightbox && (
                <div 
                    className="fixed inset-0 z-[5000] bg-black/95 flex flex-col items-center justify-center backdrop-blur-xl animate-fade-in touch-none"
                    onClick={() => setLightbox(null)}
                >
                    {/* Top Toolbar */}
                    <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-[5010] bg-gradient-to-b from-black/60 to-transparent">
                        <div className="flex items-center gap-4">
                            <div className="px-3 py-1 bg-white/10 rounded-full border border-white/10 text-white/80 text-xs font-mono">
                                {lightbox.imageIndex + 1} / {imageHistory[lightbox.historyIndex].images.length}
                            </div>
                            <span className="text-white/40 text-[10px] uppercase tracking-widest hidden md:block">使用箭头键切换图片</span>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={(e) => { e.stopPropagation(); downloadFile(imageHistory[lightbox.historyIndex].images[lightbox.imageIndex], `Preview_${Date.now()}.png`); }}
                                className="p-3 bg-white/10 hover:bg-blue-600 text-white rounded-xl transition-all border border-white/20 hover:border-blue-400 group shadow-2xl"
                                title="保存"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                            <button 
                                onClick={() => setLightbox(null)}
                                className="p-3 bg-white/10 hover:bg-red-500/80 text-white rounded-xl transition-all border border-white/20 shadow-2xl"
                                title="关闭"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                    
                    {/* Navigation Arrows */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
                        className="absolute left-6 p-4 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all z-[5010] hidden md:block"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
                        className="absolute right-6 p-4 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all z-[5010] hidden md:block"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>

                    {/* Main Image Container */}
                    <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12" onClick={(e) => e.stopPropagation()}>
                        <img 
                            key={`${lightbox.historyIndex}-${lightbox.imageIndex}`}
                            src={imageHistory[lightbox.historyIndex].images[lightbox.imageIndex]} 
                            alt="Lightbox" 
                            className="max-w-full max-h-full object-contain rounded-lg shadow-[0_0_80px_rgba(0,0,0,0.5)] animate-lightbox-zoom pointer-events-auto transition-transform duration-300"
                        />
                    </div>
                    
                    {/* Bottom Info Bar */}
                    <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center z-[5010] bg-gradient-to-t from-black/80 to-transparent">
                        <div className="max-w-3xl w-full text-center">
                            <p className="text-white/90 text-sm md:text-base font-medium leading-relaxed drop-shadow-lg animate-fade-in-up">
                                {imageHistory[lightbox.historyIndex].prompt}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-5 h-full border border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-200 shadow-sm">
        <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-gray-700 pb-4 flex-shrink-0">
            <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${mode === 'video' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                    {mode === 'video' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    )}
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{mode === 'video' ? '视频生成' : '故事撰写'}</h2>
            </div>
        </div>
        
        <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-5">
                    <div className="relative">
                        <svg className="animate-spin h-14 w-14 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    <div className="text-center">
                        <span className="block text-base font-bold text-gray-800 dark:text-gray-200">创作进行中...</span>
                        <span className="text-sm text-gray-500 mt-1">这通常需要几秒到一分钟</span>
                    </div>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
                    <ErrorIcon />
                    <p className="text-red-600 dark:text-red-400 mt-4 font-bold text-lg">哎呀，出错了</p>
                    <p className="text-red-500/80 mt-1 max-w-xs">{error}</p>
                </div>
            ) : (
                <div className="h-full">
                    {mode === 'video' ? (
                        video ? (
                            <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 h-full bg-black flex items-center group relative">
                                <video src={video} controls className="w-full" />
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button onClick={() => downloadFile(video, 'generated-video.mp4')} className="p-2 bg-white/20 backdrop-blur-md text-white rounded-lg border border-white/30 hover:bg-white/40">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                     </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                <span className="text-sm font-medium">生成视频后将在此播放</span>
                            </div>
                        )
                    ) : (
                        story ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-inner leading-relaxed text-gray-700 dark:text-gray-300 h-full overflow-y-auto">
                                {story.split('\n').map((line, i) => line.trim() && <p key={i} className="mb-4 last:mb-0 indent-8">{line}</p>)}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                <span className="text-sm font-medium">写好的故事将呈现在此</span>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>

        <style>{`
            @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
            @keyframes lightbox-zoom { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            .animate-lightbox-zoom { animation: lightbox-zoom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
        `}</style>
    </div>
  );
};

export default OutputDisplay;
