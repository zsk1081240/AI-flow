
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { HandDrawnReel, HandDrawnSettings, HandDrawnCamera, HandDrawnPalette, HandDrawnPen } from './icons';

interface Template {
  id: string;
  title: string;
  content: string;
}

export const IMAGE_STYLES = [
  { id: 'none', label: '默认', value: '' },
  { id: 'realistic', label: '写实', value: 'realistic, highly detailed, photorealistic photograph, 8k resolution' },
  { id: 'illustration', label: '插画', value: 'digital illustration, clean lines, artistic composition, stylized' },
  { id: '3d', label: '3D 渲染', value: '3d render, octane render, unreal engine 5, cinematic lighting, masterpiece' },
  { id: 'anime', label: '动漫', value: 'anime style, vibrant colors, expressive character, high quality anime art' },
  { id: 'oil', label: '油画', value: 'oil painting, textured brushstrokes, classical fine art style, masterpiece' },
  { id: 'cyberpunk', label: '赛博朋克', value: 'cyberpunk style, neon lights, high tech, futuristic, moody atmosphere' },
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
  // Mode props
  mode: string;
  setMode: (mode: 'image' | 'story' | 'video' | 'image-to-image') => void;
  // Settings props
  imageCount: number;
  setImageCount: (count: number) => void;
  imageStyle: string;
  setImageStyle: (style: string) => void;
  imageSize: '1K' | '2K' | '4K';
  setImageSize: (size: '1K' | '2K' | '4K') => void;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  resolution?: '720p' | '1080p';
  setResolution?: (res: '720p' | '1080p') => void;
  onSelectApiKey: () => void;
}

export const TemplateSidebar: React.FC<TemplateSidebarProps> = ({ 
    onApply,
    mode,
    setMode,
    imageCount,
    setImageCount,
    imageStyle,
    setImageStyle,
    imageSize,
    setImageSize,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    onSelectApiKey
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'modes' | 'templates' | 'settings'>('modes');
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

  const ModeButton = ({ targetMode, icon, label }: { targetMode: string, icon: React.ReactNode, label: string }) => (
      <button 
          onClick={() => setMode(targetMode as any)}
          className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all group ${mode === targetMode ? 'bg-ai-accent text-white shadow-lg shadow-ai-accent/30' : 'hover:bg-ai-dark/50 text-gray-400 hover:text-white'}`}
      >
          <div className={`${mode === targetMode ? 'text-white' : 'text-current group-hover:text-ai-accent'}`}>
              {icon}
          </div>
          {isOpen && <span className="text-sm font-medium">{label}</span>}
          {mode === targetMode && isOpen && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
      </button>
  );

  return (
    <div 
        className={`bg-ai-card rounded-3xl border border-ai-border flex flex-col transition-all duration-300 ease-in-out z-30 h-full relative shadow-2xl ${isOpen ? 'w-64' : 'w-20'}`}
    >
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`absolute top-6 -right-3 transform bg-ai-card border border-ai-border rounded-full p-1.5 shadow-md text-gray-400 hover:text-ai-accent z-50 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`}
            title={isOpen ? "收起" : "展开"}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </button>

        <div className="flex flex-col gap-2 p-3 mt-4">
            <ModeButton targetMode="image" icon={<HandDrawnPalette className="h-6 w-6" />} label="图片生成" />
            <ModeButton targetMode="story" icon={<HandDrawnPen className="h-6 w-6" />} label="故事创作" />
            <ModeButton targetMode="video" icon={<HandDrawnCamera className="h-6 w-6" />} label="视频生成" />
            <ModeButton targetMode="image-to-image" icon={<HandDrawnReel className="h-6 w-6" />} label="图生图" />
        </div>

        <div className="my-2 mx-4 border-t border-ai-border/50"></div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 px-3 pb-4">
             {/* Collapsed View Icons */}
             {!isOpen && (
                 <div className="flex flex-col items-center gap-6 mt-4">
                     <button onClick={() => { setIsOpen(true); setActiveTab('templates'); }} className="text-gray-500 hover:text-ai-accent transition-colors" title="模版">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                     </button>
                     <button onClick={() => { setIsOpen(true); setActiveTab('settings'); }} className="text-gray-500 hover:text-ai-accent transition-colors" title="设置">
                         <HandDrawnSettings className="h-6 w-6" />
                     </button>
                 </div>
             )}

             {/* Expanded Content */}
             {isOpen && (
                 <div className="animate-fade-in flex flex-col gap-6">
                     
                     {/* Templates Section */}
                     <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">模版库</h3>
                            <button onClick={handleAddNewClick} className="text-ai-accent hover:text-white p-1 rounded hover:bg-ai-accent/20 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                        </div>
                        
                        {templateView === 'list' ? (
                            <div className="flex flex-col gap-2">
                                {templates.length === 0 ? (
                                    <div className="text-gray-600 text-xs italic text-center py-2">暂无模版</div>
                                ) : (
                                    templates.map((t) => (
                                        <div key={t.id} onClick={() => handleApplyTemplate(t.content)} className="p-3 bg-ai-dark/40 border border-ai-border rounded-xl hover:border-ai-accent/50 hover:bg-ai-dark/80 transition-all group cursor-pointer relative">
                                            <h4 className="text-sm font-medium text-gray-300 group-hover:text-ai-accent truncate mb-1 pr-6">{t.title}</h4>
                                            <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{t.content}</p>
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => handleEditClick(t, e)} className="text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                <button onClick={(e) => handleDeleteClick(t.id, e)} className="text-gray-400 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 bg-ai-dark/40 p-3 rounded-xl border border-ai-border">
                                <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="模版标题" className="w-full text-xs bg-ai-dark border border-ai-border rounded-lg p-2 text-gray-200 focus:border-ai-accent outline-none" />
                                <textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} placeholder="模版内容..." className="w-full text-xs bg-ai-dark border border-ai-border rounded-lg p-2 h-24 text-gray-200 focus:border-ai-accent outline-none resize-none" />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setTemplateView('list')} className="text-xs text-gray-400 hover:text-white">取消</button>
                                    <button onClick={handleSaveTemplate} className="text-xs bg-ai-accent px-3 py-1 rounded text-white hover:bg-ai-accent-hover">保存</button>
                                </div>
                            </div>
                        )}
                     </div>

                     {/* Settings Section */}
                     <div className="flex flex-col gap-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">参数设置</h3>
                        
                        {isImageMode ? (
                            <div className="flex flex-col gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400">比例</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        {['1:1', '16:9', '9:16'].map(r => (
                                            <button key={r} onClick={() => setAspectRatio(r)} className={`text-[10px] py-1.5 rounded-lg border ${aspectRatio === r ? 'bg-ai-accent/20 border-ai-accent text-ai-accent' : 'border-ai-border text-gray-400 hover:bg-ai-dark'}`}>{r}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400">风格</label>
                                    <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)} className="w-full text-xs bg-ai-dark border border-ai-border rounded-lg p-2 text-gray-200 outline-none focus:border-ai-accent">
                                        {IMAGE_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400">质量 (Pro)</label>
                                    <div className="flex bg-ai-dark rounded-lg p-1 border border-ai-border">
                                        {['1K', '2K', '4K'].map((s) => (
                                            <button key={s} onClick={() => setImageSize(s as any)} className={`flex-1 text-[10px] py-1 rounded ${imageSize === s ? 'bg-ai-card text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>{s}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : mode === 'video' ? (
                             <div className="space-y-1">
                                <label className="text-[10px] text-gray-400">分辨率</label>
                                <div className="flex bg-ai-dark rounded-lg p-1 border border-ai-border">
                                    {['720p', '1080p'].map((r) => (
                                        <button key={r} onClick={() => setResolution && setResolution(r as any)} className={`flex-1 text-[10px] py-1 rounded ${resolution === r ? 'bg-ai-card text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>{r}</button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 text-[10px] text-gray-500 bg-ai-dark/30 rounded-lg border border-ai-border border-dashed">
                                当前模式无额外设置
                            </div>
                        )}

                        <div className="pt-2 border-t border-ai-border/50">
                            <button 
                                onClick={onSelectApiKey}
                                className="w-full text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                管理 API 密钥
                            </button>
                        </div>
                     </div>
                 </div>
             )}
        </div>
    </div>
  );
};
