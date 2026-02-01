/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { HandDrawnReel, HandDrawnSettings, HandDrawnCamera, HandDrawnPalette, HandDrawnPen, HandDrawnFilmStrip, HandDrawnSpeaker, HandDrawnBookOpen, HandDrawnNote } from './icons';
import { Mode, GenerationSettings } from '../types';

interface Template {
  id: string;
  title: string;
  content: string;
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
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [hasCloudKey, setHasCloudKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [localApiKey, setLocalApiKey] = useState('');
  
  const [camX, setCamX] = useState(0); 
  const [camY, setCamY] = useState(0); 
  const [camZoom, setCamZoom] = useState(0.5); 
  const [lensType, setLensType] = useState('standard');
  const camPadRef = useRef<HTMLDivElement>(null);
  const isDraggingCam = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('prompt_templates');
    if (saved) { try { setTemplates(JSON.parse(saved)); } catch (e) {} }
    const existingKey = localStorage.getItem('gemini_api_key');
    if (existingKey) { setHasCustomKey(true); setLocalApiKey(existingKey); }
    setBaseUrl(localStorage.getItem('gemini_base_url') || '');

    const checkCloudKey = async () => {
        const win = window as any;
        if (win.aistudio?.hasSelectedApiKey) {
            try { setHasCloudKey(await win.aistudio.hasSelectedApiKey()); } catch (e) {}
        }
    };
    checkCloudKey();
  }, []);

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
            
            <button onClick={() => setIsOpen(true)} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-500 transition-colors">
                <HandDrawnSettings className="h-5 w-5" />
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
                        </div>
                    )}

                    {/* API Key */}
                    <div className="pt-4 border-t border-white/5 space-y-3">
                        <button 
                            onClick={() => { onSelectApiKey(); setHasCloudKey(true); }}
                            className={`w-full text-[10px] py-2.5 rounded-xl transition-all font-bold flex items-center justify-center gap-2 ${
                                hasCloudKey 
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                : 'bg-ai-accent/10 text-ai-accent border border-ai-accent/20 hover:bg-ai-accent/20'
                            }`}
                        >
                            <span>{hasCloudKey ? '已链接 Google Cloud' : '链接 API Key'}</span>
                        </button>
                    </div>
                 </div>
             </div>
        </div>
    </div>
  );
};