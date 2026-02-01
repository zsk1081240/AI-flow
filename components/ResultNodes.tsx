
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import DraggableNode from './DraggableNode';
import { ImageGenerationItem, AudioGenerationItem, TextHistoryItem, VideoHistoryItem, GenerationBatch } from '../types';
import { HandDrawnCamera, HandDrawnSpeaker, HandDrawnNote, HandDrawnBookOpen, HandDrawnPalette, HandDrawnReel, HandDrawnPen } from './icons';

const downloadFile = (url: string, filename: string) => {
    const element = document.createElement("a");
    element.href = url;
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

const EdgeButton = ({ onClick, side = 'right' }: { onClick: (e: React.MouseEvent) => void, side?: 'left' | 'right' }) => (
    <button 
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className={`w-8 h-8 rounded-full bg-ai-card border border-ai-accent text-ai-accent hover:bg-ai-accent hover:text-white shadow-lg flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 group relative z-40`}
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
    </button>
);

const ExtensionMenu = ({ isOpen, onClose, options, side = 'right' }: { isOpen: boolean, onClose: () => void, options: { label: string, onClick: () => void, icon?: React.ReactNode }[], side?: 'left' | 'right' }) => {
    if (!isOpen) return null;
    return (
        <div 
            className={`absolute top-0 ${side === 'right' ? 'left-full ml-3' : 'right-full mr-3'} bg-ai-card/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 w-48 flex flex-col gap-1 z-[100] animate-fade-in`}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {options.map((opt, idx) => (
                <button 
                    key={idx} 
                    onClick={(e) => { e.stopPropagation(); opt.onClick(); onClose(); }}
                    className="text-[11px] text-left px-3 py-2.5 text-gray-300 hover:text-white hover:bg-ai-accent/20 rounded-xl transition-all flex items-center gap-3 group/item"
                >
                    <span className="text-ai-accent group-hover/item:scale-110 transition-transform">{opt.icon}</span>
                    <span className="font-medium">{opt.label}</span>
                </button>
            ))}
        </div>
    );
};

// Overlay delete button for headerless nodes
const OverlayDeleteButton = ({ onDelete }: { onDelete: () => void }) => (
    <button 
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/node:opacity-100 transition-all shadow-lg hover:scale-110 z-50"
        title="删除"
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
    </button>
);

// --- Batch Group Node (Collapsed State) ---
export const BatchGroupNode: React.FC<{ 
    batch: GenerationBatch, 
    initialX: number, 
    initialY: number, 
    onExpand: () => void,
    onClose: () => void 
}> = ({ batch, initialX, initialY, onExpand, onClose }) => {
    const getIcon = () => {
        switch(batch.mode) {
            case 'image': return <HandDrawnPalette className="w-8 h-8" />;
            case 'video': return <HandDrawnCamera className="w-8 h-8" />;
            case 'audio': return <HandDrawnSpeaker className="w-8 h-8" />;
            case 'story': return <HandDrawnPen className="w-8 h-8" />;
            default: return <HandDrawnReel className="w-8 h-8" />;
        }
    };

    const getTitle = () => {
        const typeMap: any = { image: '图像生成组', story: '文学创作组', video: '视频制作组', audio: '音频设计组', comic: '分镜剧本组' };
        return typeMap[batch.mode] || '创作组';
    };

    return (
        <DraggableNode
            id={batch.id}
            initialX={initialX}
            initialY={initialY}
            width="w-64"
            height="h-40"
            title={getTitle()}
            tooltip="批次汇总：点击卡片中心可展开该生成批次的所有子项。可整体移除。"
            icon={getIcon()}
            onClose={onClose}
            className="border-ai-accent/30 border-dashed hover:border-solid transition-all"
        >
            <div 
                className="flex flex-col items-center justify-center h-full gap-2 cursor-pointer group"
                onClick={onExpand}
            >
                <div className="relative w-24 h-16 bg-black/40 rounded-lg border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <div className="absolute inset-0 bg-ai-accent/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="text-2xl font-black text-ai-accent relative z-10">{batch.items.length}</span>
                    <div className="absolute -right-2 -top-2 flex gap-1">
                        <div className="w-4 h-4 bg-ai-accent rounded-full animate-ping"></div>
                    </div>
                </div>
                <div className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">点击展开该批次内容</div>
                <div className="text-[9px] text-gray-600 italic truncate w-full px-4 text-center">"{batch.prompt}"</div>
            </div>
        </DraggableNode>
    );
};

interface CommonNodeProps {
    isSelected?: boolean;
    onSelect?: (id: string, multi: boolean) => void;
    onPositionChange?: (id: string, x: number, y: number) => void;
    onAddNext?: (e: React.MouseEvent) => void;
    onAddPrev?: (e: React.MouseEvent) => void;
    isExpanded?: boolean;
    onExpand?: () => void;
    isLocked?: boolean;
}

// --- Image Result Node ---
export const ImageResultNode: React.FC<{ 
    item: ImageGenerationItem, 
    initialX: number, 
    initialY: number, 
    onClose: () => void, 
    onImageClick: (img: string) => void,
    onExtend: (type: any, img: string, p: string) => void,
    onUpdateScript: (imgIndex: number, text: string) => void,
} & CommonNodeProps> = ({ item, initialX, initialY, onClose, onImageClick, onExtend, onUpdateScript, isSelected, onSelect, onPositionChange, onAddNext, onAddPrev, isExpanded, onExpand, isLocked }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [showStoryboard, setShowStoryboard] = useState(false);
    const mainImage = item.images[0];

    const extensionOptions = [
        { label: "多剧情延展", icon: <HandDrawnBookOpen className="w-4 h-4" />, onClick: () => onExtend('multi-plot', mainImage, item.prompt) },
        { label: "多角度延展", icon: <HandDrawnReel className="w-4 h-4" />, onClick: () => onExtend('multi-angle', mainImage, item.prompt) },
        { label: "角度调整", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>, onClick: () => onExtend('angle-adj', mainImage, item.prompt) },
        { label: "图生图", icon: <HandDrawnPalette className="w-4 h-4" />, onClick: () => onExtend('img2img', mainImage, item.prompt) },
        { label: "图生视频", icon: <HandDrawnCamera className="w-4 h-4" />, onClick: () => onExtend('video', mainImage, item.prompt) }
    ];

    return (
        <DraggableNode
            id={item.id}
            initialX={initialX}
            initialY={initialY}
            width={showStoryboard ? "w-[500px]" : "w-64"} 
            title={showStoryboard ? "分镜脚本 (Storyboard)" : ""}
            tooltip="图片成果：点击放大预览。下方切换分镜模式可编辑文案。"
            onClose={onClose}
            isSelected={isSelected}
            onSelect={onSelect}
            onPositionChange={onPositionChange}
            onAddNext={onAddNext}
            onAddPrev={onAddPrev}
            isLocked={isLocked}
            hideHeader={!showStoryboard}
            className="overflow-visible transition-all duration-300 ease-out"
            rightAction={
                !showStoryboard && (
                    <div className="relative">
                        <EdgeButton onClick={() => setShowMenu(!showMenu)} />
                        <ExtensionMenu isOpen={showMenu} onClose={() => setShowMenu(false)} options={extensionOptions} />
                    </div>
                )
            }
        >
             {!showStoryboard && <OverlayDeleteButton onDelete={onClose} />}
             
             <div className="flex flex-col h-full bg-ai-card">
                 {/* Main Image View */}
                 <div className="relative group/image flex-shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); onImageClick(mainImage); }}>
                    <img src={mainImage} className={`w-full h-auto shadow-md pointer-events-none ${showStoryboard ? 'rounded-none border-b border-white/5' : 'rounded-xl'}`} alt="Gen" />
                    
                    {!showStoryboard && (
                        <>
                            <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors rounded-xl pointer-events-none flex items-center justify-center">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onImageClick(mainImage); }}
                                    className="opacity-0 group-hover/image:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm pointer-events-auto transform hover:scale-110"
                                    title="预览放大"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </button>
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover/image:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); downloadFile(mainImage, `Creation_${item.id}_0.png`); }}
                                    className="p-1.5 bg-ai-accent hover:bg-ai-accent-hover text-white rounded-lg transition-colors shadow-lg shadow-ai-accent/20"
                                    title="下载"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </button>
                            </div>
                        </>
                    )}
                 </div>

                 {/* Storyboard Toggle */}
                 <button 
                    onClick={() => setShowStoryboard(!showStoryboard)}
                    className={`w-full py-1.5 flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-wider transition-colors ${showStoryboard ? 'bg-ai-dark text-ai-accent border-b border-white/5' : 'text-gray-500 hover:text-gray-300 bg-transparent hover:bg-white/5 rounded-b-xl'}`}
                 >
                     <HandDrawnBookOpen className="w-3 h-3" />
                     {showStoryboard ? "收起分镜" : "编辑分镜脚本"}
                 </button>

                 {/* Storyboard Table */}
                 {showStoryboard && (
                     <div className="flex-1 overflow-y-auto p-0 bg-ai-dark/30 scrollbar-thin">
                         <table className="w-full text-left border-collapse">
                             <thead>
                                 <tr className="border-b border-white/10 text-[10px] text-gray-500 uppercase">
                                     <th className="p-3 w-12 text-center">#</th>
                                     <th className="p-3 w-20">画面</th>
                                     <th className="p-3">脚本文案 (Script)</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                                 {item.images.map((img, idx) => (
                                     <tr key={idx} className="group hover:bg-white/5 transition-colors">
                                         <td className="p-3 text-center text-gray-500 font-mono">{idx + 1}</td>
                                         <td className="p-3">
                                             <div className="w-16 h-16 bg-black rounded overflow-hidden border border-white/10 cursor-pointer hover:border-ai-accent" onClick={() => onImageClick(img)}>
                                                 <img src={img} className="w-full h-full object-cover" alt="Thumb" />
                                             </div>
                                         </td>
                                         <td className="p-3">
                                             <textarea
                                                 value={item.scripts?.[idx] || ''}
                                                 onChange={(e) => onUpdateScript(idx, e.target.value)}
                                                 placeholder="在此输入分镜描述或台词..."
                                                 className="w-full h-16 bg-black/20 border border-white/10 rounded-lg p-2 text-gray-200 focus:border-ai-accent outline-none resize-none text-xs leading-relaxed transition-colors"
                                             />
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                         <div className="p-2 text-[9px] text-gray-600 text-center border-t border-white/5">
                             提示: 此处的文字修改会自动保存，方便后续导出剧本。
                         </div>
                     </div>
                 )}
             </div>
        </DraggableNode>
    );
};

// --- Video Result Node ---
export const VideoResultNode: React.FC<{ 
    item: VideoHistoryItem, 
    initialX: number, 
    initialY: number, 
    onClose: () => void,
} & CommonNodeProps> = ({ item, initialX, initialY, onClose, isSelected, onSelect, onPositionChange, onAddNext, onAddPrev, isExpanded, onExpand, isLocked }) => {
    
    // Video also shows content directly, compact size
    return (
        <DraggableNode 
            id={item.id} 
            initialX={initialX} 
            initialY={initialY} 
            isSelected={isSelected} 
            onSelect={onSelect} 
            onPositionChange={onPositionChange} 
            onAddNext={onAddNext}
            onAddPrev={onAddPrev}
            width="w-80" 
            title="视频结果" 
            tooltip="视频成果：在此直接播放生成的 AI 视频。" 
            icon={<HandDrawnCamera className="w-4 h-4" />} 
            onClose={onClose}
            isLocked={isLocked}
            hideHeader={true}
            className="overflow-visible"
        >
            <OverlayDeleteButton onDelete={onClose} />
            <div className="bg-black relative group rounded-xl overflow-hidden shadow-lg border border-ai-border/50">
                <video src={item.url} controls className="w-full" />
                <button 
                    onClick={(e) => {e.stopPropagation(); downloadFile(item.url, `Video_${item.id}.mp4`);}} 
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-ai-accent text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg backdrop-blur-sm"
                    title="下载视频"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </button>
            </div>
        </DraggableNode>
    );
};

// --- Audio Result Node ---
export const AudioResultNode: React.FC<{ 
    item: AudioGenerationItem, 
    initialX: number, 
    initialY: number, 
    onClose: () => void,
} & CommonNodeProps> = ({ item, initialX, initialY, onClose, isSelected, onSelect, onPositionChange, onAddNext, onAddPrev, isExpanded, onExpand, isLocked }) => {

    return (
        <DraggableNode 
            id={item.id} 
            initialX={initialX} 
            initialY={initialY} 
            isSelected={isSelected} 
            onSelect={onSelect} 
            onPositionChange={onPositionChange} 
            onAddNext={onAddNext}
            onAddPrev={onAddPrev}
            width="w-72" 
            title={item.subType === 'music' ? '乐谱设计' : '语音生成'} 
            tooltip="音频成果" 
            icon={item.subType === 'music' ? <HandDrawnNote className="w-4 h-4" /> : <HandDrawnSpeaker className="w-4 h-4" />} 
            onClose={onClose}
            isLocked={isLocked}
        >
            <div className="p-4 flex flex-col gap-3">
                {item.audioUrl && <audio controls src={item.audioUrl} className="w-full h-8" />}
                <div className="text-[11px] text-gray-400 font-mono bg-black/40 p-3 rounded-lg overflow-y-auto max-h-32 scrollbar-thin">
                    {item.musicScore || item.prompt}
                </div>
                {item.audioUrl && (
                     <div className="flex justify-end border-t border-white/5 pt-2">
                        <button 
                            onClick={() => downloadFile(item.audioUrl!, `Audio_${item.id}.wav`)}
                            className="flex items-center gap-1.5 text-[10px] bg-ai-accent/10 hover:bg-ai-accent text-ai-accent hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            下载音频
                        </button>
                     </div>
                )}
            </div>
        </DraggableNode>
    );
};

// --- Text/Story Result Node ---
export const TextResultNode: React.FC<{ 
    item: TextHistoryItem, 
    initialX: number, 
    initialY: number, 
    onClose: () => void,
    onUpdate: (newContent: string) => void,
    onApplyToPrompt: (content: string) => void,
    onExtend: (content: string) => void,
} & CommonNodeProps> = ({ item, initialX, initialY, onClose, onUpdate, onApplyToPrompt, onExtend, isSelected, onSelect, onPositionChange, onAddNext, onAddPrev, isExpanded, onExpand, isLocked }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(item.content);
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => { if (!isEditing) setContent(item.content); }, [item.content, isEditing]);

    const handleSave = () => {
        onUpdate(content);
        setIsEditing(false);
    };

    // Text nodes still benefit from an expanded state for editing large text
    if (!isExpanded) {
        return (
            <DraggableNode
                id={item.id}
                initialX={initialX}
                initialY={initialY}
                width="w-64"
                height="h-auto"
                title={item.type === 'comic' ? '分镜脚本' : '故事/文本'}
                onClose={onClose}
                isSelected={isSelected}
                onSelect={onSelect}
                onPositionChange={onPositionChange}
                isLocked={isLocked}
            >
                 <div 
                    className="p-3 bg-ai-dark/30 cursor-pointer hover:bg-ai-dark/50 transition-colors"
                    onClick={onExpand}
                >
                    <p className="text-xs text-gray-300 line-clamp-4 font-mono">{content}</p>
                    <p className="text-[9px] text-ai-accent mt-2 text-center font-bold uppercase">点击展开编辑</p>
                 </div>
            </DraggableNode>
        );
    }

    return (
        <DraggableNode
            id={item.id}
            initialX={initialX}
            initialY={initialY}
            isSelected={isSelected}
            onSelect={onSelect}
            onPositionChange={onPositionChange}
            onAddNext={onAddNext}
            onAddPrev={onAddPrev}
            width="w-[450px]"
            height="h-[550px]"
            title={item.type === 'comic' ? '分镜脚本' : '故事/文本'}
            tooltip="文本成果：查看生成的故事或分镜。支持直接编辑内容。点击下方 '应用并重绘' 可将内容同步至创意输入框。"
            icon={<HandDrawnBookOpen className="w-4 h-4" />}
            onClose={onClose}
            isLocked={isLocked}
            rightAction={
                <div className="relative">
                    <EdgeButton onClick={() => setShowMenu(!showMenu)} />
                    <ExtensionMenu 
                        isOpen={showMenu} 
                        onClose={() => setShowMenu(false)} 
                        options={[
                            { label: isEditing ? "完成编辑" : "开始编辑", onClick: () => isEditing ? handleSave() : setIsEditing(true), icon: <HandDrawnPen className="w-4 h-4" /> },
                            { label: "同步至创意输入", onClick: () => onApplyToPrompt(content), icon: <HandDrawnPalette className="w-4 h-4" /> },
                            { label: "复制全文", onClick: () => navigator.clipboard.writeText(content), icon: <HandDrawnNote className="w-4 h-4" /> }
                        ]}
                    />
                </div>
            }
        >
            <div className="h-full flex flex-col bg-ai-dark/30">
                <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                    {isEditing ? (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-full bg-black/40 text-gray-200 text-sm leading-relaxed p-4 rounded-xl border border-ai-accent/30 focus:border-ai-accent outline-none resize-none font-mono"
                        />
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {content}
                        </div>
                    )}
                </div>
                <div className="p-3 border-t border-white/5 bg-black/20 flex gap-2 justify-end">
                    {isEditing && (
                         <button onClick={handleSave} className="text-[10px] px-3 py-1.5 bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white rounded-lg transition-all border border-green-500/20">保存修改</button>
                    )}
                    <button onClick={() => onApplyToPrompt(content)} className="text-[10px] px-3 py-1.5 bg-ai-accent/10 text-ai-accent hover:bg-ai-accent hover:text-white rounded-lg transition-all border border-ai-accent/20">应用并重绘</button>
                </div>
            </div>
        </DraggableNode>
    );
};
