/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';

interface Template {
  id: string;
  title: string;
  content: string;
}

export const IMAGE_STYLES = [
  { id: 'none', label: '默认', value: '' },
  { id: 'realistic', label: '写实', value: 'realistic, highly detailed, photograph' },
  { id: 'illustration', label: '插画', value: 'digital illustration, clean lines, artistic' },
  { id: '3d', label: '3D 渲染', value: '3d render, octane render, unreal engine 5, cinematic lighting' },
  { id: 'anime', label: '动漫', value: 'anime style, vibrant colors, expressive' },
  { id: 'oil', label: '油画', value: 'oil painting, textured brushstrokes, classical' },
  { id: 'cyberpunk', label: '赛博朋克', value: 'cyberpunk style, neon lights, high tech, futuristic' },
];

export const IMAGE_SIZES = ['1K', '2K', '4K'] as const;

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'default-5',
    title: "多角度分镜图 (Multi-angle Storyboard)",
    content: `<instruction>\nAnalyze the entire composition of the input image. Identify ALL key subjects present (whether it's a single person, a group/couple, a vehicle, or a specific object) and their spatial relationship/interaction.\nGenerate a cohesive 3x3 grid "Cinematic Contact Sheet" featuring 9 distinct camera shots of exactly these subjects in the same environment.`
  },
  {
    id: 'default-1',
    title: "电影感接触印样 (Cinematic Contact Sheet)",
    content: `<instruction>\nAnalyze the entire composition of the input image. Identify ALL key subjects present (whether it's a single person, a group/couple, a vehicle, or a specific object) and their spatial\nrelationship/interaction.\nGenerate a cohesive 3x3 grid "Cinematic Contact Sheet" featuring 9 distinct camera shots of exactly these subjects in the same environment.`
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

interface TemplateSidebarProps {
  onApply: (content: string) => void;
  // Settings props
  mode: string;
  imageCount: number;
  setImageCount: (count: number) => void;
  imageStyle: string;
  setImageStyle: (style: string) => void;
  imageSize: '1K' | '2K' | '4K';
  setImageSize: (size: '1K' | '2K' | '4K') => void;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  onSelectApiKey: () => void;
}

export const TemplateSidebar: React.FC<TemplateSidebarProps> = ({ 
    onApply,
    mode,
    imageCount,
    setImageCount,
    imageStyle,
    setImageStyle,
    imageSize,
    setImageSize,
    aspectRatio,
    setAspectRatio,
    onSelectApiKey
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'templates' | 'settings'>('templates');
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [templateView, setTemplateView] = useState<'list' | 'form'>('list');
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');

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

  const handleApplyTemplate = (content: string) => {
      onApply(content);
      if (window.innerWidth < 1024) setIsOpen(false);
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

  const isImageMode = mode === 'image' || mode === 'image-to-image';

  return (
    <div 
        className={`bg-white dark:bg-gray-850 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out z-30 h-full relative ${isOpen ? 'w-72 md:w-80 shadow-xl md:shadow-none' : 'w-12 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
    >
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`absolute top-1/2 -right-3 transform -translate-y-1/2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full p-1 shadow-md text-gray-500 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 z-50 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`}
            title={isOpen ? "收起" : "展开"}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </button>

        {isOpen && (
            <div className="flex border-b border-gray-200 dark:border-gray-700 h-12 flex-shrink-0 animate-fade-in">
                <button 
                    onClick={() => setActiveTab('templates')}
                    className={`flex-1 flex items-center justify-center text-sm font-medium transition-colors ${activeTab === 'templates' ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    模版
                </button>
                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 flex items-center justify-center text-sm font-medium transition-colors ${activeTab === 'settings' ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    参数
                </button>
            </div>
        )}

        {!isOpen && (
            <div className="flex-1 flex flex-col items-center py-4 gap-6 cursor-pointer" onClick={() => setIsOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </div>
        )}

        <div className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 ${!isOpen ? 'hidden' : ''}`}>
             {activeTab === 'templates' ? (
                templateView === 'list' ? (
                    <div className="flex flex-col animate-fade-in">
                        <div className="p-3 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center border-b dark:border-gray-700">
                            <span className="text-xs font-semibold text-gray-500 uppercase">常用模版</span>
                            <button onClick={handleAddNewClick} className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                        </div>
                        {templates.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm">暂无模版</div>
                        ) : (
                            templates.map((t) => (
                                <div key={t.id} onClick={() => handleApplyTemplate(t.content)} className="p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group cursor-pointer relative">
                                    <div className="flex justify-between items-start mb-1 gap-2">
                                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-300 truncate">{t.title}</h4>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded shadow-sm">
                                            <button onClick={(e) => handleEditClick(t, e)} className="p-1 text-gray-500 hover:text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                            <button onClick={(e) => handleDeleteClick(t.id, e)} className="p-1 text-gray-500 hover:text-red-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{t.content}</p>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="p-4 flex flex-col gap-4 animate-fade-in">
                        <h3 className="text-sm font-bold">{editingTemplate ? '编辑模版' : '新建模版'}</h3>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">标题</label>
                            <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">内容</label>
                            <textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2 h-48 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setTemplateView('list')} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300">取消</button>
                            <button onClick={handleSaveTemplate} disabled={!formTitle.trim() || !formContent.trim()} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50">保存</button>
                        </div>
                    </div>
                )
             ) : (
                <div className="p-4 flex flex-col gap-6 animate-fade-in">
                    {/* API Key Management Section */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.543 17.543A2 2 0 0110.129 18H9a2 2 0 01-2-2v-1a2 2 0 01.586-1.414l5.223-5.223A2 2 0 0014 9a2 2 0 012-2z" />
                            </svg>
                            API 密钥管理
                        </h3>
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-3">
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 mb-3 leading-relaxed">
                                生成视频或超清图片需要 Google Cloud 付费项目的密钥。
                            </p>
                            <button 
                                onClick={onSelectApiKey}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 px-3 rounded-md transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                选择 API 密钥
                            </button>
                            <a 
                                href="https://ai.google.dev/gemini-api/docs/billing" 
                                target="_blank" 
                                rel="noreferrer" 
                                className="block text-[9px] text-center text-blue-600 dark:text-blue-400 hover:underline mt-2"
                            >
                                了解计费与限额
                            </a>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">内容生成参数</h3>
                        
                        {isImageMode ? (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">比例</label>
                                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                                        <option value="1:1">1:1 (方形)</option>
                                        <option value="16:9">16:9 (横屏)</option>
                                        <option value="9:16">9:16 (竖屏)</option>
                                        <option value="4:3">4:3 (标准)</option>
                                        <option value="3:4">3:4 (纵向)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">数量</label>
                                    <select value={imageCount} onChange={(e) => setImageCount(Number(e.target.value))} className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                                        <option value={1}>1 张</option>
                                        <option value={4}>4 张</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">风格</label>
                                    <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)} className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                                        {IMAGE_STYLES.map(style => (
                                            <option key={style.id} value={style.id}>{style.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">分辨率 (Pro)</label>
                                    <select value={imageSize} onChange={(e) => setImageSize(e.target.value as any)} className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                                        <option value="1K">1K (标准)</option>
                                        <option value="2K">2K (高清)</option>
                                        <option value="4K">4K (超清)</option>
                                    </select>
                                </div>
                            </>
                        ) : (
                            <div className="p-4 text-center text-gray-400 text-[10px] italic bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                当前模式无额外图片参数。
                            </div>
                        )}
                    </div>
                </div>
             )}
        </div>
    </div>
  );
};
