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

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'default-5',
    title: "多角度分镜图 (Multi-angle Storyboard)",
    content: `<instruction>
Analyze the entire composition of the input image. Identify ALL key subjects present (whether it's a single person, a group/couple, a vehicle, or a specific object) and their spatial relationship/interaction.
Generate a cohesive 3x3 grid "Cinematic Contact Sheet" featuring 9 distinct camera shots of exactly these subjects in the same environment.`
  },
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

interface TemplateSidebarProps {
  onApply: (content: string) => void;
}

export const TemplateSidebar: React.FC<TemplateSidebarProps> = ({ onApply }) => {
  const [isOpen, setIsOpen] = useState(false); // Default to closed to save space
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
      // Optional: Close sidebar on apply on mobile, but keep open on desktop
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

  const handleCancelForm = () => {
      setTemplateView('list');
      setEditingTemplate(null);
  };

  return (
    <div 
        className={`bg-white dark:bg-gray-850 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out z-30 h-full relative ${isOpen ? 'w-72 md:w-80 shadow-xl md:shadow-none' : 'w-12 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
    >
        {/* Toggle Button */}
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`absolute top-1/2 -right-3 transform -translate-y-1/2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full p-1 shadow-md text-gray-500 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 z-50 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`}
            title={isOpen ? "收起模版" : "展开模版"}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </button>

        {/* Header Area */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center h-14 shrink-0 overflow-hidden whitespace-nowrap">
             {isOpen ? (
                 <div className="flex justify-between items-center w-full animate-fade-in">
                     <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">常用模版</span>
                     {templateView === 'list' && (
                        <button 
                            onClick={handleAddNewClick}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
                            title="添加新模版"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                     )}
                 </div>
             ) : (
                <div 
                    className="w-full h-full flex items-center justify-center cursor-pointer"
                    onClick={() => setIsOpen(true)}
                    title="展开常用模版"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </div>
             )}
        </div>

        {/* Content Area */}
        <div className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 ${!isOpen ? 'hidden' : ''}`}>
             {templateView === 'list' ? (
                templates.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 dark:text-gray-500 text-sm">
                        暂无模版，点击右上角“+”添加。
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {templates.map((t) => (
                            <div
                                key={t.id}
                                onClick={() => handleApplyTemplate(t.content)}
                                className="p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group cursor-pointer relative"
                            >
                                <div className="flex justify-between items-start mb-1 gap-2">
                                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-300 truncate">
                                        {t.title}
                                    </h4>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded shadow-sm">
                                        <button 
                                            onClick={(e) => handleEditClick(t, e)}
                                            className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                                            title="编辑"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={(e) => handleDeleteClick(t.id, e)}
                                            className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                                            title="删除"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                    {t.content}
                                </p>
                            </div>
                        ))}
                    </div>
                )
             ) : (
                <div className="p-4 flex flex-col gap-4 animate-fade-in">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{editingTemplate ? '编辑模版' : '新建模版'}</h3>
                        <button onClick={handleCancelForm} className="text-gray-400 hover:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
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
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2 h-48 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                            placeholder="输入详细的提示词..."
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
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
  );
};