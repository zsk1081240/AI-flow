/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { HandDrawnReel, HandDrawnSettings, HandDrawnCamera, HandDrawnPalette, HandDrawnPen, HandDrawnFilmStrip, HandDrawnSpeaker, HandDrawnBookOpen, HandDrawnNote, TrashIcon, KeyIcon } from './icons';
import { Mode, GenerationSettings } from '../types';

interface Template {
  id: string;
  title: string;
  content: string;
}

interface SavedKey {
    id: string;
    alias: string;
    key: string;
    timestamp: number;
}

export const IMAGE_STYLES = [
  { id: 'none', label: '默认', value: '' },
  { id: 'realistic', label: '写实 (Realistic)', value: 'realistic, highly detailed, photorealistic photograph, 8k resolution' },
  { id: 'illustration', label: '插画 (Illustration)', value: 'digital illustration, clean lines, artistic composition, stylized' },
  { id: '3d', label: '3D 渲染 (3D Render)', value: '3d render, octane render, unreal engine 5, cinematic lighting, masterpiece' },
  { id: 'anime', label: '动漫 (Anime)', value: 'anime style, vibrant colors, expressive character, high quality anime art' },
  { id: 'cyberpunk', label: '赛博朋克 (Cyberpunk)', value: 'cyberpunk style, neon lights, high tech, futuristic, moody atmosphere' },
  { id: 'watercolor', label: '水彩 (Watercolor)', value: 'watercolor painting, soft blending, artistic, expressive, wet-on-wet technique' },
  { id: 'sketch', label: '素描 (Sketch)', value: 'pencil sketch, graphite drawing, rough lines, shading, artistic sketch' },
];

export const AUDIO_VOICES = [
    { id: 'Puck', label: 'Puck (男, 温和)' },
    { id: 'Charon', label: 'Charon (男, 低沉)' },
    { id: 'Kore', label: 'Kore (女, 清晰)' },
    { id: 'Fenrir', label: 'Fenrir (男, 粗犷)' },
    { id: 'Zephyr', label: 'Zephyr (女, 柔和)' },
];

export const MUSIC_STYLES = [
    { id: 'Cinematic', label: '电影原声' },
    { id: 'Lo-Fi', label: 'Lo-Fi 嘻哈' },
    { id: 'Ambient', label: '环境氛围' },
    { id: 'Classical', label: '古典交响' },
    { id: 'Electronic', label: '电子舞曲' },
];

export const LENS_TYPES = [
    { id: 'standard', label: '标准 (35mm)' },
    { id: 'wide', label: '广角 (16mm)' },
    { id: 'telephoto', label: '长焦 (85mm)' },
    { id: 'macro', label: '微距' },
    { id: 'fisheye', label: '鱼眼' },
];

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'default-local-storyboard',
    title: "局部分镜 (Storyboard)",
    content: `<instruction>\nAnalyze the uploaded reference image. Generate a high-quality 2x2 grid storyboard.\n1. Panorama\n2. Close-up\n3. Detail Shot\n4. Medium Shot\nEnsure consistent lighting and style.</instruction>`
  },
  {
    id: 'default-character-consistency',
    title: "角色一致性 (Consistency)",
    content: `# 任务：角色一致性图像生成\n严格依据【角色参考图】绘制角色。\n\n**【文字指令】：**\na cinematic photo of **the character**, [在这里详细描述新的场景、动作...]`
  }
];

interface TemplateSidebarProps {
  onApply: (content: string) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
  settings: GenerationSettings;
  updateSettings: (updates: Partial<GenerationSettings>) => void;
  onSelectApiKey: () => void;
  onTriggerUpload?: () => void;
}

export const TemplateSidebar: React.FC<TemplateSidebarProps> = ({ 
    onApply,
    mode,
    setMode,
    settings,
    updateSettings,
    onSelectApiKey,
    onTriggerUpload
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  
  // API Key Management State
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [inputAlias, setInputAlias] = useState('');
  
  const [camX, setCamX] = useState(0); 
  const [camY, setCamY] = useState(0); 
  const [camZoom, setCamZoom] = useState(0.5); 
  const [lensType, setLensType] = useState('standard');
  const camPadRef = useRef<HTMLDivElement>(null);
  const isDraggingCam = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('prompt_templates');
    if (saved) { try { setTemplates(JSON.parse(saved)); } catch (e) {} }
    
    // Load Keys
    try {
        const storedKeys = JSON.parse(localStorage.getItem('hz_custom_api_keys') || '[]');
        setSavedKeys(storedKeys);
        const current = localStorage.getItem('gemini_api_key');
        setActiveKey(current);
    } catch(e) {}
  }, []);

  const handleAddKey = () => {
    if (!inputKey.trim()) return;
    const newEntry: SavedKey = {
        id: Date.now().toString(),
        alias: inputAlias.trim() || `Secret Key ${savedKeys.length + 1}`,
        key: inputKey.trim(),
        timestamp: Date.now()
    };
    const updated = [...savedKeys, newEntry];
    setSavedKeys(updated);
    localStorage.setItem('hz_custom_api_keys', JSON.stringify(updated));
    setInputKey('');
    setInputAlias('');
    
    // Auto switch if first key
    if (savedKeys.length === 0) {
        handleSelectKey(newEntry.key);
    }
  };

  const handleSelectKey = (key: string | null) => {
    if (key) {
        localStorage.setItem('gemini_api_key', key);
    } else {
        localStorage.removeItem('gemini_api_key');
    }
    setActiveKey(key);
  };

  const handleDeleteKey = (id: string) => {
    const keyToDelete = savedKeys.find(k => k.id === id);
    const updated = savedKeys.filter(k => k.id !== id);
    setSavedKeys(updated);
    localStorage.setItem('hz_custom_api_keys', JSON.stringify(updated));
    
    if (keyToDelete?.key === activeKey) {
        handleSelectKey(null);
    }
  };

  const handleSelectCloudKey = () => {
      onSelectApiKey();
      handleSelectKey(null); // Clear custom key so env key takes precedence
      // We assume user successfully linked if they clicked this,
      // visually we rely on activeKey === null to show Default/Cloud is active.
      setShowKeyModal(false);
  };

  useEffect(() => {
      const parts = [];
      if (camY < -0.3) parts.push('Low angle');
      else if (camY > 0.3) parts.push('High angle');
      
      if (camX < -0.3) parts.push('from left');
      else if (camX > 0.3) parts.push('from right');
      
      if (camZoom < 0.2) parts.push('Panoramic');
      else if (camZoom < 0.4) parts.push('Wide shot');
      else if (camZoom > 0.7) parts.push('Close-up');

      const lensLabel = LENS_TYPES.find(l => l.id === lensType)?.label;
      if (lensLabel) parts.push(`Lens: ${lensLabel}`);

      const detail = parts.join(', ');
      if (detail !== settings.cameraDetail) updateSettings({ cameraDetail: detail });
  }, [camX, camY, camZoom, lensType]);

  const handleApplyTemplate = (t: Template) => {
      onApply(t.content);
      if (t.id === 'default-local-storyboard' || t.id === 'default-character-consistency') {
          setMode('image-to-image');
          if (onTriggerUpload) onTriggerUpload();
      }
      if (window.innerWidth < 1024) setIsOpen(false);
  };

  const handleCamPadMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!camPadRef.current) return;
      const rect = camPadRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      
      let x = (clientX - rect.left) / rect.width;
      let y = (clientY - rect.top) / rect.height;
      
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      
      setCamX((x * 2) - 1);
      setCamY(1 - (y * 2)); 
  };

  const startCamDrag = (e: React.MouseEvent | React.TouchEvent) => {
      isDraggingCam.current = true;
      handleCamPadMove(e);
  };

  useEffect(() => {
      const stopDrag = () => isDraggingCam.current = false;
      const moveDrag = (e: MouseEvent | TouchEvent) => {
          if (isDraggingCam.current) handleCamPadMove(e as any);
      };
      window.addEventListener('mouseup', stopDrag);
      window.addEventListener('mousemove', moveDrag);
      window.addEventListener('touchend', stopDrag);
      window.addEventListener('touchmove', moveDrag);
      return () => {
          window.removeEventListener('mouseup', stopDrag);
          window.removeEventListener('mousemove', moveDrag);
          window.removeEventListener('touchend', stopDrag);
          window.removeEventListener('touchmove', moveDrag);
      }
  }, []);

  const ModeButton = ({ targetMode, icon, label }: { targetMode: string, icon: React.ReactNode, label: string }) => (
      <button 
          onClick={() => setMode(targetMode as any)}
          className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 group overflow-hidden ${mode === targetMode ? 'bg-ai-accent text-white shadow-glow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          title={label}
      >
          <div className="relative z-10">{icon}</div>
          {mode === targetMode && <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-50"></div>}
      </button>
  );

  return (
    <>
    <div 
        className={`glass-panel-heavy rounded-[2rem] border border-white/5 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-30 h-full relative shadow-2xl ${isOpen ? 'w-80' : 'w-20'}`}
    >
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`absolute top-8 -right-3 w-6 h-6 bg-ai-card border border-ai-border rounded-full flex items-center justify-center shadow-lg text-gray-400 hover:text-white z-50 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </button>

        <div className="flex flex-col items-center gap-3 py-6 w-20 flex-shrink-0 border-r border-white/5 h-full absolute left-0 top-0 bottom-0 bg-black/20">
            <ModeButton targetMode="image" icon={<HandDrawnPalette className="h-5 w-5" />} label="图片生成" />
            <ModeButton targetMode="story" icon={<HandDrawnPen className="h-5 w-5" />} label="故事创作" />
            <ModeButton targetMode="comic" icon={<HandDrawnBookOpen className="h-5 w-5" />} label="漫剧创作" />
            <ModeButton targetMode="video" icon={<HandDrawnCamera className="h-5 w-5" />} label="视频生成" />
            <ModeButton targetMode="image-to-image" icon={<HandDrawnReel className="h-5 w-5" />} label="图生图" />
            <ModeButton targetMode="video-multiframe" icon={<HandDrawnFilmStrip className="h-5 w-5" />} label="智能多帧" />
            <ModeButton targetMode="audio" icon={<HandDrawnSpeaker className="h-5 w-5" />} label="音频中心" />
            
            <div className="flex-1"></div>
            
            <button onClick={() => { setIsOpen(true); setShowKeyModal(true); }} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors relative group">
                <HandDrawnSettings className="h-5 w-5" />
                {activeKey && (
                     <div className="absolute top-2 right-2 w-2 h-2 bg-ai-accent rounded-full shadow-[0_0_8px_rgba(139,92,246,0.8)] animate-pulse"></div>
                )}
            </button>
        </div>

        <div className={`ml-20 h-full flex flex-col transition-opacity duration-300 ${isOpen ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'}`}>
             <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-6">
                 
                 {/* Templates */}
                 {mode !== 'audio' && (
                     <div className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">模版库</h3>
                        <div className="flex flex-col gap-2">
                            {templates.map((t) => (
                                <div key={t.id} onClick={() => handleApplyTemplate(t)} className="p-3 bg-white/5 border border-white/5 rounded-xl hover:border-ai-accent/40 hover:bg-white/10 transition-all cursor-pointer group">
                                    <h4 className="text-xs font-bold text-gray-300 group-hover:text-white truncate">{t.title}</h4>
                                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{t.content}</p>
                                </div>
                            ))}
                        </div>
                     </div>
                 )}

                 {/* Settings */}
                 <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">参数设置</h3>
                    
                    {(mode === 'image' || mode === 'image-to-image') && (
                        <div className="space-y-4">
                            <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-3">
                                <label className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                    <HandDrawnCamera className="w-3 h-3" /> 镜头控制
                                </label>
                                <div className="relative w-full aspect-square bg-black/50 rounded-lg border border-white/10 overflow-hidden group cursor-crosshair touch-none shadow-inner"
                                     ref={camPadRef}
                                     onMouseDown={startCamDrag}
                                     onTouchStart={startCamDrag}
                                >
                                    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none border-white/5">
                                        <div className="border-r border-b border-white/5"></div>
                                        <div className="border-b border-white/5"></div>
                                        <div className="border-r border-white/5"></div>
                                        <div></div>
                                    </div>
                                    <div 
                                        className="absolute w-3 h-3 bg-ai-accent rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)] border border-white transform -translate-x-1/2 -translate-y-1/2"
                                        style={{ left: `${((camX + 1) / 2) * 100}%`, top: `${((1 - camY) / 2) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="space-y-2">
                                    <input 
                                        type="range" 
                                        min="0" max="1" step="0.05"
                                        value={camZoom}
                                        onChange={(e) => setCamZoom(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ai-accent"
                                    />
                                    <div className="flex justify-between text-[8px] text-gray-600 font-mono">
                                        <span>WIDE</span><span>ZOOM</span>
                                    </div>
                                </div>
                                <select 
                                    value={lensType} 
                                    onChange={(e) => setLensType(e.target.value)} 
                                    className="w-full text-[10px] bg-black/50 border border-white/10 rounded-lg p-2 text-gray-300 outline-none focus:border-ai-accent"
                                >
                                    {LENS_TYPES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-1 bg-black/20 p-1 rounded-xl">
                                {['1:1', '16:9', '9:16'].map(r => (
                                    <button key={r} onClick={() => updateSettings({ aspectRatio: r })} className={`text-[10px] py-1.5 rounded-lg border transition-all ${settings.aspectRatio === r ? 'bg-ai-accent text-white border-transparent shadow' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{r}</button>
                                ))}
                            </div>
                            
                            <div className="grid grid-cols-3 gap-1 bg-black/20 p-1 rounded-xl">
                                {['1K', '2K', '4K'].map(s => (
                                    <button key={s} onClick={() => updateSettings({ imageSize: s as any })} className={`text-[10px] py-1.5 rounded-lg border transition-all ${settings.imageSize === s ? 'bg-ai-accent text-white border-transparent shadow' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{s}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* API Key Trigger */}
                    <div className="pt-4 border-t border-white/5 space-y-3">
                        <button 
                            onClick={() => setShowKeyModal(true)}
                            className={`w-full text-[10px] py-2.5 rounded-xl transition-all font-bold flex items-center justify-center gap-2 ${
                                activeKey 
                                ? 'bg-ai-accent/10 text-ai-accent border border-ai-accent/20 hover:bg-ai-accent/20' 
                                : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
                            }`}
                        >
                             <KeyIcon className="w-4 h-4" />
                            <span>{activeKey ? '使用自定义 Key' : 'API Key 管理'}</span>
                        </button>
                    </div>
                 </div>
             </div>
        </div>
    </div>

    {/* API Key Manager Modal */}
    {showKeyModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowKeyModal(false)}>
            <div className="bg-ai-card border border-ai-border rounded-2xl w-96 max-w-full shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <KeyIcon className="w-4 h-4 text-ai-accent" />
                        API Key 管理
                    </h3>
                    <button onClick={() => setShowKeyModal(false)} className="text-gray-500 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="p-4 space-y-6">
                    {/* Active Status */}
                    <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">当前状态</p>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${activeKey ? 'bg-ai-accent' : 'bg-green-500'}`}></div>
                                <span className="text-xs font-medium text-gray-200">
                                    {activeKey ? '正在使用自定义 Key' : '系统默认 / Google Cloud Key'}
                                </span>
                            </div>
                            {activeKey && (
                                <button onClick={() => handleSelectKey(null)} className="text-[10px] text-gray-400 hover:text-white underline">重置为默认</button>
                            )}
                        </div>
                    </div>

                    {/* Key List */}
                    <div className="space-y-2">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">已保存的 Keys</p>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                            {/* Default Option */}
                            <div 
                                onClick={() => handleSelectKey(null)}
                                className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center group ${
                                    activeKey === null 
                                    ? 'bg-green-500/10 border-green-500/30 ring-1 ring-green-500/50' 
                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                                }`}
                            >
                                <div>
                                    <p className={`text-xs font-bold ${activeKey === null ? 'text-green-400' : 'text-gray-300'}`}>系统默认</p>
                                    <p className="text-[10px] text-gray-500">Google Cloud / Environment</p>
                                </div>
                                {activeKey === null && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
                            </div>

                            {/* Saved Keys */}
                            {savedKeys.map((k) => (
                                <div 
                                    key={k.id}
                                    onClick={() => handleSelectKey(k.key)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center group ${
                                        activeKey === k.key 
                                        ? 'bg-ai-accent/10 border-ai-accent/30 ring-1 ring-ai-accent/50' 
                                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0 pr-2">
                                        <p className={`text-xs font-bold truncate ${activeKey === k.key ? 'text-ai-accent' : 'text-gray-300'}`}>{k.alias}</p>
                                        <p className="text-[10px] text-gray-500 font-mono truncate">••••••••{k.key.slice(-4)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {activeKey === k.key && <div className="w-2 h-2 bg-ai-accent rounded-full"></div>}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteKey(k.id); }}
                                            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add New */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                         <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">添加新 Key</p>
                         <input 
                            type="text" 
                            placeholder="备注名 (例如: Personal Pro)" 
                            value={inputAlias}
                            onChange={(e) => setInputAlias(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-ai-accent outline-none"
                         />
                         <div className="flex gap-2">
                             <input 
                                type="password" 
                                placeholder="sk-..." 
                                value={inputKey}
                                onChange={(e) => setInputKey(e.target.value)}
                                className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-ai-accent outline-none font-mono"
                             />
                             <button 
                                onClick={handleAddKey}
                                disabled={!inputKey.trim()}
                                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-4 rounded-xl text-xs font-bold transition-colors"
                             >
                                 添加
                             </button>
                         </div>
                    </div>

                    <div className="pt-2">
                        <button 
                            onClick={handleSelectCloudKey}
                            className="w-full py-2 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                            链接 Google Cloud 项目
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )}
    </>
  );
};