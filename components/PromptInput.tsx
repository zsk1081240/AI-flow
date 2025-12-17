/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';

interface PromptInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  resolution?: '720p' | '1080p';
  setResolution?: (res: '720p' | '1080p') => void;
  onSubmit: () => void;
  onAnalyze: () => void; // New prop for analysis only
  isLoading: boolean; // General loading state (disables inputs)
  isGenerating: boolean; // Specific generation state (shows spinner)
  isFirstRun: boolean;
  mode: 'image' | 'story' | 'video' | 'image-to-image';
  setMode: (mode: 'image' | 'story' | 'video' | 'image-to-image') => void;
  referenceImage?: string | null;
  setReferenceImage?: (img: string | null) => void;
}

interface Template {
  id: string;
  title: string;
  content: string;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'default-1',
    title: "电影感接触印样 (Cinematic Contact Sheet)",
    content: `<instruction>
Analyze the entire composition of the input image. Identify ALL key subjects present (whether it's a single person, a group/couple, a vehicle, or a specific object) and their spatial
relationship/interaction.
Generate a cohesive 3x3 grid "Cinematic Contact Sheet" featuring 9 distinct camera shots of exactly these subjects in the same environment.`
  },
  {
    id: 'default-2',
    title: "详细视觉描述 (Detailed Description)",
    content: "Analyze the image in depth. Describe the main subjects, their actions, the setting, lighting, colors, and mood. Be precise about spatial relationships and textures."
  },
  {
    id: 'default-3',
    title: "风格转换：赛博朋克 (Style: Cyberpunk)",
    content: "Reimagine this scene in a high-tech, dystopic cyberpunk style. Add neon signage, rain-slicked streets, cybernetic enhancements to characters, and a moody, nocturnal atmosphere."
  },
  {
    id: 'default-4',
    title: "风格转换：吉卜力 (Style: Studio Ghibli)",
    content: "Reimagine the image in the style of Studio Ghibli: lush backgrounds, vibrant natural colors, whimsical details, and a sense of wonder and nostalgia."
  }
];

const PromptInput: React.FC<PromptInputProps> = ({ 
  prompt, 
  setPrompt, 
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  onSubmit,
  onAnalyze,
  isLoading, 
  isGenerating, 
  isFirstRun, 
  mode, 
  setMode,
  referenceImage,
  setReferenceImage
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [templateView, setTemplateView] = useState<'list' | 'form'>('list');
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('prompt_templates');
    if (saved) {
      try {
        setTemplates(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load templates", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('prompt_templates', JSON.stringify(templates));
  }, [templates]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTemplates(false);
      }
    };
    if (showTemplates) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTemplates]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && setReferenceImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyTemplate = (content: string) => {
      setPrompt(content);
      setShowTemplates(false);
  };

  const handleAddNewClick = () => {
      setEditingTemplate(null);
      setFormTitle('');
      setFormContent('');
      setTemplateView('form');
  };

  const handleEditClick = (t: Template, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingTemplate(t);
      setFormTitle(t.title);
      setFormContent(t.content);
      setTemplateView('form');
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm('确定要删除此模版吗？')) {
          setTemplates(prev => prev.filter(t => t.id !== id));
      }
  };

  const handleSaveTemplate = () => {
      if (!formTitle.trim() || !formContent.trim()) return;

      if (editingTemplate) {
          setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, title: formTitle, content: formContent } : t));
      } else {
          const newTemplate: Template = {
              id: Date.now().toString(),
              title: formTitle,
              content: formContent
          };
          setTemplates(prev => [newTemplate, ...prev]);
      }
      setTemplateView('list');
  };

  const handleCancelForm = () => {
      setTemplateView('list');
      setEditingTemplate(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col transition-colors duration-200">
      <div className="px-4 py-2 md:py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center relative">
        <h2 className="text-base md:text-lg font-semibold text-gray-700 dark:text-gray-200">提示词</h2>
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => {
                    setShowTemplates(!showTemplates);
                    if (!showTemplates) setTemplateView('list'); // Reset view on open
                }}
                className={`text-xs md:text-sm font-medium flex items-center gap-1 transition-colors focus:outline-none ${showTemplates ? 'text-blue-700 dark:text-blue-300' : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'}`}
                title="管理常用提示词模版"
                disabled={isLoading}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                常用模版
            </button>
            
            {showTemplates && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 font-semibold text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center shrink-0">
                        <span>{templateView === 'list' ? '选择模版' : (editingTemplate ? '编辑模版' : '新建模版')}</span>
                        <div className="flex gap-2">
                            {templateView === 'list' && (
                                <button 
                                    onClick={handleAddNewClick}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                                    title="添加新模版"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span className="hidden sm:inline">新建</span>
                                </button>
                            )}
                            <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <div className="overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 flex-grow">
                        {templateView === 'list' ? (
                            templates.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                                    暂无模版，点击“新建”添加。
                                </div>
                            ) : (
                                templates.map((t) => (
                                    <div
                                        key={t.id}
                                        onClick={() => handleApplyTemplate(t.content)}
                                        className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors group border-b border-gray-50 dark:border-gray-700/50 last:border-0 relative cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start mb-1 gap-2">
                                            <div className="text-sm font-bold text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-300 flex items-center gap-2 flex-grow">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"></span>
                                                <span className="truncate">{t.title}</span>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <button 
                                                    onClick={(e) => handleEditClick(t, e)}
                                                    className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-700 rounded shadow-sm"
                                                    title="编辑"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                                <button 
                                                    onClick={(e) => handleDeleteClick(t.id, e)}
                                                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-gray-700 rounded shadow-sm"
                                                    title="删除"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed pl-3.5">
                                            {t.content}
                                        </div>
                                    </div>
                                ))
                            )
                        ) : (
                            <div className="p-4 flex flex-col gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">标题</label>
                                    <input 
                                        type="text" 
                                        value={formTitle}
                                        onChange={(e) => setFormTitle(e.target.value)}
                                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="例如：赛博朋克风格..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">提示词内容</label>
                                    <textarea 
                                        value={formContent}
                                        onChange={(e) => setFormContent(e.target.value)}
                                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2 h-32 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                                        placeholder="输入详细的提示词..."
                                    />
                                </div>
                                <div className="flex gap-2 justify-end pt-2">
                                    <button 
                                        onClick={handleCancelForm}
                                        className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button 
                                        onClick={handleSaveTemplate}
                                        disabled={!formTitle.trim() || !formContent.trim()}
                                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        保存
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>
      
      <div className="p-3 md:p-5 flex flex-col gap-3 md:gap-4">
        <div 
          className={`w-full relative ${isLoading ? 'cursor-not-allowed' : ''}`} 
          title={isLoading ? "处理请求时输入已禁用，请稍候。" : "在此编辑您的提示词。"}
        >
            <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="一张丰盛的自制早餐图片..."
            className="w-full h-16 md:h-24 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-none text-sm md:text-base leading-relaxed shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
            disabled={isLoading}
            />
        </div>

        {/* Image to Image Upload Area */}
        {mode === 'image-to-image' && setReferenceImage && (
            <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">参考图片 (必需):</label>
                {!referenceImage ? (
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors relative cursor-pointer">
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange} 
                            disabled={isLoading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs">点击或拖拽上传参考图片</span>
                        </div>
                    </div>
                ) : (
                    <div className="relative inline-block w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 group">
                        <img src={referenceImage} alt="Ref" className="w-full h-full object-cover" />
                        <button 
                            onClick={() => setReferenceImage(null)}
                            disabled={isLoading}
                            className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        )}
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <div 
                    className={`flex flex-wrap bg-gray-100 dark:bg-gray-700 p-1 rounded-lg transition-colors overflow-x-auto max-w-full ${isLoading ? 'cursor-not-allowed opacity-75' : ''}`} 
                    title={isLoading ? "处理中禁用模式选择" : "选择生成模式"}
                >
                    <button 
                        onClick={() => setMode('image')}
                        disabled={isLoading}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all text-xs md:text-sm font-medium disabled:pointer-events-none whitespace-nowrap ${
                            mode === 'image' 
                            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>图片</span>
                    </button>
                    <button 
                        onClick={() => setMode('story')}
                        disabled={isLoading}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all text-xs md:text-sm font-medium disabled:pointer-events-none whitespace-nowrap ${
                            mode === 'story' 
                            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span>故事</span>
                    </button>
                    <button 
                        onClick={() => setMode('video')}
                        disabled={isLoading}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all text-xs md:text-sm font-medium disabled:pointer-events-none whitespace-nowrap ${
                            mode === 'video' 
                            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>视频</span>
                    </button>
                    <button 
                        onClick={() => setMode('image-to-image')}
                        disabled={isLoading}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all text-xs md:text-sm font-medium disabled:pointer-events-none whitespace-nowrap ${
                            mode === 'image-to-image' 
                            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>图生图</span>
                    </button>
                </div>

                {mode === 'video' && resolution && setResolution && (
                    <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-700/50 p-1 rounded-lg border border-gray-200 dark:border-gray-600">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 pl-2">清晰度:</label>
                        <select
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value as '720p' | '1080p')}
                            className="bg-transparent border-none rounded-md text-xs py-1 pl-1 pr-6 text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer font-medium"
                            disabled={isLoading}
                        >
                            <option value="720p">720p</option>
                            <option value="1080p">1080p</option>
                        </select>
                    </div>
                )}

                {mode !== 'story' && (
                    <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-700/50 p-1 rounded-lg border border-gray-200 dark:border-gray-600">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 pl-2">比例:</label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            className="bg-transparent border-none rounded-md text-xs py-1 pl-1 pr-6 text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer font-medium"
                            disabled={isLoading}
                        >
                            <option value="1:1">1:1 (方形)</option>
                            <option value="16:9">16:9 (横屏)</option>
                            <option value="9:16">9:16 (竖屏)</option>
                            <option value="4:3">4:3 (标准)</option>
                            <option value="3:4">3:4 (纵向)</option>
                        </select>
                    </div>
                )}
            </div>

            <div 
                className={`flex gap-2 ${isLoading || !prompt || (mode === 'image-to-image' && !referenceImage) ? "cursor-not-allowed" : ""}`}
                title={isLoading ? "请等待当前操作完成" : (!prompt ? "请先输入提示词" : (mode === 'image-to-image' && !referenceImage ? "请上传参考图片" : ""))}
            >
                <button
                onClick={(e) => {
                    e.preventDefault();
                    onAnalyze();
                }}
                disabled={isLoading || !prompt || (mode === 'image-to-image' && !referenceImage)}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 text-gray-700 dark:text-gray-200 font-semibold py-1.5 md:py-2 px-3 md:px-4 rounded-lg flex items-center justify-center transition-all shadow-sm text-sm md:text-base disabled:pointer-events-none"
                >
                    <span>分析提示词</span>
                </button>

                <button
                onClick={(e) => {
                    e.preventDefault();
                    onSubmit();
                }}
                disabled={isLoading || !prompt || (mode === 'image-to-image' && !referenceImage)}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-600 disabled:pointer-events-none text-white font-semibold py-1.5 md:py-2 px-4 md:px-6 rounded-lg flex items-center justify-center space-x-2 transition-all shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0 text-sm md:text-base"
                >
                {isGenerating && (
                    <svg className="animate-spin h-4 w-4 md:h-5 md:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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