
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header';
import PromptInput, { PromptInputHandle } from './components/PromptInput';
import ClarificationCard from './components/ClarificationCard';
import BeliefGraph from './components/BeliefGraph';
import PoseReferenceCard from './components/PoseReferenceCard';
import { TemplateSidebar } from './components/TemplateSidebar';
import CanvasWorkspace from './components/CanvasWorkspace';
import DraggableNode from './components/DraggableNode';
import { ImageResultNode, VideoResultNode, AudioResultNode, TextResultNode, BatchGroupNode } from './components/ResultNodes';
import { HandDrawnNodes, HandDrawnPen, HandDrawnNote, HandDrawnPalette, HandDrawnCamera, HandDrawnReel, HandDrawnFilmStrip, HandDrawnBookOpen } from './components/icons';
import BatchActionBar from './components/BatchActionBar';
import {
  parsePromptToBeliefGraph,
  generateClarifications,
  generateImagesFromPrompt,
  generateStoryFromPrompt,
  generateComicScript,
  generateVideosFromPrompt,
  generateSmartMultiFrameVideo,
  generateSpeech,
  generateMusicScore,
  refinePromptWithAllUpdates,
} from './services/geminiService';
import { BeliefState, Clarification, GraphUpdate, Mode, GenerationBatch, GenerationSettings, NodeConnection, ImageGenerationItem } from './types';

function App() {
  const [prompt, setPrompt] = useState('一只猫正在为它的动物朋友们举办派对');
  const [audioText, setAudioText] = useState('你好，欢迎来到 HZ-AI Studio。');
  
  // Consolidated Generation Settings
  const [genSettings, setGenSettings] = useState<GenerationSettings>({
      aspectRatio: '1:1',
      resolution: '720p',
      imageCount: 4,
      imageStyle: 'none',
      imageSize: '1K',
      negativePrompt: '',
      cameraDetail: '',
      audioVoice: 'Puck',
      audioMode: 'speech',
      musicStyle: 'Cinematic',
      referenceImages: []
  });

  const [analysisModel, setAnalysisModel] = useState<string>('gemini-3-pro-preview');

  const updateSettings = useCallback((updates: Partial<GenerationSettings>) => {
      setGenSettings(prev => ({ ...prev, ...updates }));
  }, []);
  
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [isAttributesLoading, setIsAttributesLoading] = useState(false);
  const [isClarificationsLoading, setIsClarificationsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState(false);
  
  const [mode, setMode] = useState<Mode>('image');
  const [batches, setBatches] = useState<GenerationBatch[]>([]);
  const [nodeOverrides, setNodeOverrides] = useState<Record<string, {x: number, y: number}>>({});
  
  // Node Links & Locks & Clipboard
  const [connections, setConnections] = useState<NodeConnection[]>([]);
  const [lockedNodeIds, setLockedNodeIds] = useState<Set<string>>(new Set(['creation-center', 'analysis-center']));
  const [clipboard, setClipboard] = useState<any | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);

  // Expanded Node Management
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, canvasX: number, canvasY: number, sourceNodeId?: string, type: 'canvas' | 'node-handle' | 'node' } | null>(null);

  // Z-Index Management: Stores order of node IDs. Last is on top.
  const [nodeOrder, setNodeOrder] = useState<string[]>(['creation-center', 'analysis-center']);

  const bringToFront = (id: string) => {
      setNodeOrder(prev => {
          const filtered = prev.filter(n => n !== id);
          return [...filtered, id];
      });
  };

  const getZIndex = (id: string) => {
      // If expanded, always be on top
      if (id === expandedNodeId) return 1000;
      const idx = nodeOrder.indexOf(id);
      return idx === -1 ? 10 : 10 + idx; 
  };

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const itemPositionsRef = useRef<Record<string, {x: number, y: number}>>({});

  const modeRef = useRef<Mode>(mode);
  const promptInputRef = useRef<PromptInputHandle>(null);
  
  // Use timestamps for IDs to ensure uniqueness and order
  const analysisRequestIdRef = useRef(0);
  const generationRequestIdRef = useRef(0);

  const [requiresApiKey, setRequiresApiKey] = useState(false);
  const [beliefGraph, setBeliefGraph] = useState<BeliefState | null>(null);
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<string[]>([]);
  const [skippedQuestions, setSkippedQuestions] = useState<string[]>([]); 
  const [hasGenerated, setHasGenerated] = useState(false);

  const [lastAnalyzedPrompt, setLastAnalyzedPrompt] = useState<string | null>(null);
  const [lastAnalyzedMode, setLastAnalyzedMode] = useState<Mode | null>(null);

  const [pendingAttributeUpdates, setPendingAttributeUpdates] = useState<Record<string, string>>({});
  const [pendingRelationshipUpdates, setPendingRelationshipUpdates] = useState<Record<string, string>>({});
  const [pendingClarificationAnswers, setPendingClarificationAnswers] = useState<{[key: string]: string}>({});
  
  const [activeAnalysisView, setActiveAnalysisView] = useState<'graph' | 'clarify' | 'attributes' | 'pose'>('graph');
  const [isDarkMode, setIsDarkMode] = useState(true); 
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { document.documentElement.classList.toggle('dark', isDarkMode); }, [isDarkMode]);

  useEffect(() => {
      const handleClick = () => setContextMenu(null);
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleStatusUpdate = useCallback((msg: string) => {
      setStatusNotification(msg);
      // Auto clear after 5 seconds
      setTimeout(() => setStatusNotification(prev => prev === msg ? null : prev), 5000);
  }, []);

  const handleModeChange = (newMode: Mode) => {
    if (newMode === mode) return;
    // Increment request IDs to invalidate pending async operations from previous mode
    analysisRequestIdRef.current += 1;
    generationRequestIdRef.current += 1;
    
    setMode(newMode);
    setRequiresApiKey(false); 
    if (newMode !== 'audio' && prompt === '一只猫正在为它的动物朋友们举办派对') setPrompt(''); 
  };

  const handleUpdateTextInBatch = (batchId: string, itemId: string, newContent: string) => {
      setBatches(prev => prev.map(b => b.id === batchId ? { ...b, items: b.items.map(i => i.id === itemId ? { ...i, content: newContent } : i) } : b));
  };

  const handleUpdateImageScript = (batchId: string, itemId: string, imgIndex: number, text: string) => {
      setBatches(prev => prev.map(b => b.id === batchId ? {
          ...b,
          items: b.items.map(i => {
              if (i.id === itemId && (b.mode === 'image' || b.mode === 'image-to-image')) {
                  const item = i as ImageGenerationItem;
                  return {
                      ...item,
                      scripts: { ...(item.scripts || {}), [imgIndex]: text }
                  };
              }
              return i;
          })
      } : b));
  };

  const handleRemoveItem = (batchId: string, itemId: string) => {
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, items: b.items.filter(i => i.id !== itemId) } : b).filter(b => b.items.length > 0));
    setSelectedItemIds(prev => { const next = new Set(prev); next.delete(itemId); return next; });
    if (expandedNodeId === itemId) setExpandedNodeId(null);
    setConnections(prev => prev.filter(c => c.sourceId !== itemId && c.targetId !== itemId));
  };

  const handleSelectNode = (itemId: string, multi: boolean) => {
    // If we are in connecting mode and click a different node, create connection
    if (connectingSourceId && connectingSourceId !== itemId) {
        setConnections(prev => [...prev, {
            id: `link-${Date.now()}`,
            sourceId: connectingSourceId,
            targetId: itemId
        }]);
        setConnectingSourceId(null);
        handleStatusUpdate("已建立连接");
        return;
    }
    
    // Clear connecting mode if we just clicked normally without selecting a target
    if (connectingSourceId) setConnectingSourceId(null);

    bringToFront(itemId);
    setSelectedItemIds(prev => {
      const next = new Set(multi ? prev : []);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const handleSelectionEnd = (rect: { x: number, y: number, width: number, height: number }) => {
    const newlySelected = new Set<string>();
    document.querySelectorAll('[data-node-id]').forEach((el) => {
      const id = el.getAttribute('data-node-id');
      const pos = id ? itemPositionsRef.current[id] : null;
      if (pos && pos.x < rect.x + rect.width && pos.x + el.clientWidth > rect.x && pos.y < rect.y + rect.height && pos.y + el.clientHeight > rect.y) {
        newlySelected.add(id!);
      }
    });
    setSelectedItemIds(newlySelected.size > 0 ? newlySelected : new Set());
  };

  const handleBackgroundClick = () => {
      setSelectedItemIds(new Set());
      setExpandedNodeId(null); // Collapse any expanded node
      setConnectingSourceId(null);
      setLightboxImage(null); // Close lightbox
  };

  const handleManualGroup = () => {
    if (selectedItemIds.size < 2) return;
    let items: any[] = [];
    batches.forEach(b => { items = [...items, ...b.items.filter(i => selectedItemIds.has(i.id))]; });
    if (items.length === 0) return;
    const newBatch: GenerationBatch = { id: `batch-manual-${Date.now()}`, timestamp: Date.now(), mode: 'image', prompt: "手动合并的分组", isExpanded: true, items };
    setBatches(prev => [newBatch, ...prev.map(b => ({ ...b, items: b.items.filter(i => !selectedItemIds.has(i.id)) })).filter(b => b.items.length > 0)]);
    setSelectedItemIds(new Set());
    handleStatusUpdate("已将选中项手动成组");
  };

  const handleBatchAction = (action: 'align-left' | 'align-top' | 'distribute-grid' | 'group' | 'delete') => {
      if (action === 'group') {
          handleManualGroup();
          return;
      }
      
      const selectedIds = Array.from(selectedItemIds);
      if (action === 'delete') {
          if (window.confirm(`确定要删除选中的 ${selectedIds.length} 个节点吗？`)) {
             setBatches(prev => prev.map(b => ({ ...b, items: b.items.filter(i => !selectedItemIds.has(i.id)) })).filter(b => b.items.length > 0));
             setConnections(prev => prev.filter(c => !selectedItemIds.has(c.sourceId) && !selectedItemIds.has(c.targetId)));
             setSelectedItemIds(new Set());
          }
          return;
      }

      if (selectedIds.length < 2) return;

      const positions = selectedIds.map(id => ({ id, ...itemPositionsRef.current[id] })).filter(p => p.x !== undefined);
      if (positions.length === 0) return;

      const newOverrides = { ...nodeOverrides };

      if (action === 'align-left') {
          const minX = Math.min(...positions.map(p => p.x));
          positions.forEach(p => { newOverrides[p.id] = { x: minX, y: p.y }; });
          handleStatusUpdate("已左对齐");
      } else if (action === 'align-top') {
          const minY = Math.min(...positions.map(p => p.y));
          positions.forEach(p => { newOverrides[p.id] = { x: p.x, y: minY }; });
          handleStatusUpdate("已顶对齐");
      } else if (action === 'distribute-grid') {
          const startX = Math.min(...positions.map(p => p.x));
          const startY = Math.min(...positions.map(p => p.y));
          const cols = Math.ceil(Math.sqrt(positions.length));
          const gap = 40;
          const cellW = 320; 
          const cellH = 320; 
          positions.forEach((p, idx) => {
              const row = Math.floor(idx / cols);
              const col = idx % cols;
              newOverrides[p.id] = { x: startX + col * (cellW + gap), y: startY + row * (cellH + gap) };
          });
          handleStatusUpdate("已排列为网格");
      }
      setNodeOverrides(newOverrides);
  };

  const handleApplyPose = (posePrompt: string) => {
    const current = prompt.trim();
    setPrompt(current.toLowerCase().includes('pose:') ? current.replace(/pose:.*$/i, `Pose: ${posePrompt}`) : `${current}, Pose: ${posePrompt}`);
  };

  const handleApplyAllUpdates = async () => {
    if (isUpdatingPrompt) return;
    setIsUpdatingPrompt(true);
    const qaPairs = Object.entries(pendingClarificationAnswers).map(([q, a]) => ({ question: q, answer: a as string }));
    const graphUpdates: GraphUpdate[] = [];
    Object.entries(pendingAttributeUpdates).forEach(([key, value]) => {
        const [entity, attribute] = key.split(':');
        graphUpdates.push({ type: 'attribute', entity, attribute, value: value as string });
    });
    Object.entries(pendingRelationshipUpdates).forEach(([key, value]) => {
        const [source, target] = key.split(':');
        graphUpdates.push({ type: 'relationship', source, target, oldLabel: '', newLabel: value as string });
    });
    try {
        const newRefined = await refinePromptWithAllUpdates(prompt, qaPairs, graphUpdates, analysisModel, handleStatusUpdate);
        setPrompt(newRefined);
        setPendingAttributeUpdates({}); 
        setPendingRelationshipUpdates({}); 
        setPendingClarificationAnswers({});
        setAnsweredQuestions(prev => [...prev, ...qaPairs.map(a => a.question)]);
        handleStatusUpdate("提示词已优化，请点击生成按钮开始创作");
    } catch(error) { 
        console.error(error); 
        handleStatusUpdate("优化提示词失败");
    } finally { 
        setIsUpdatingPrompt(false); 
    }
  };

  const processRequest = useCallback(async (currentPrompt: string, currentAnswered: string[], currentMode: Mode, skipAnalysis: boolean, skipGen: boolean) => {
    const genRequestId = ++generationRequestIdRef.current;
    
    // Safety check function to ensure we don't update state for stale requests
    const isGenCurrent = () => modeRef.current === currentMode && generationRequestIdRef.current === genRequestId;
    
    setRequiresApiKey(false);
    
    if (!skipAnalysis && currentMode !== 'audio') {
        setActiveAnalysisView('clarify');
    }

    if (!skipAnalysis) {
        setBeliefGraph(null); setClarifications([]);
        setPendingAttributeUpdates({}); setPendingRelationshipUpdates({}); setPendingClarificationAnswers({});
        setSkippedQuestions([]); 
    }
    
    // Analysis Phase
    if (!skipAnalysis && currentMode !== 'audio') {
        setIsGraphLoading(true); setIsAttributesLoading(true); setIsClarificationsLoading(true);
        
        // Execute analysis in parallel but handle them individually
        Promise.all([
            parsePromptToBeliefGraph(currentPrompt, currentMode, analysisModel, handleStatusUpdate)
                .then(g => isGenCurrent() && setBeliefGraph(g))
                .catch(e => console.error("Graph Error", e))
                .finally(() => isGenCurrent() && setIsGraphLoading(false)),
            generateClarifications(currentPrompt, currentAnswered, currentMode, analysisModel, handleStatusUpdate)
                .then(c => isGenCurrent() && setClarifications(c))
                .catch(e => console.error("Clarification Error", e))
                .finally(() => isGenCurrent() && setIsClarificationsLoading(false))
        ]).then(() => {
             if (isGenCurrent()) {
                setIsAttributesLoading(false);
                setLastAnalyzedPrompt(currentPrompt); 
                setLastAnalyzedMode(currentMode);
             }
        });
    }

    // Generation Phase
    if (!skipGen) {
        setIsGenerating(true);
        try {
            let resultItems: any[] = [];
            const timestamp = Date.now();
            
            // Perform generation based on mode
            if (currentMode === 'image' || currentMode === 'image-to-image') {
                const imgs = await generateImagesFromPrompt(currentPrompt, genSettings.aspectRatio, genSettings.referenceImages, genSettings.imageCount, genSettings.imageStyle, genSettings.imageSize, genSettings.negativePrompt, genSettings.cameraDetail, handleStatusUpdate);
                if (imgs.length > 0) {
                    resultItems = imgs.map((img, i) => ({ id: `${timestamp}-${i}`, timestamp, prompt: currentPrompt, aspectRatio: genSettings.aspectRatio, images: [img] }));
                }
            } else if (currentMode === 'story' || currentMode === 'comic') {
                const content = currentMode === 'story' ? await generateStoryFromPrompt(currentPrompt) : await generateComicScript(currentPrompt);
                resultItems = [{ id: `${timestamp}`, type: currentMode, content, timestamp }];
            } else if (currentMode === 'video' || currentMode === 'video-multiframe') {
                const url = currentMode === 'video' 
                    ? await generateVideosFromPrompt(currentPrompt, genSettings.referenceImages, genSettings.aspectRatio, genSettings.resolution, handleStatusUpdate) 
                    : await generateSmartMultiFrameVideo(currentPrompt, genSettings.referenceImages, genSettings.aspectRatio, handleStatusUpdate);
                if (url) resultItems = [{ id: `${timestamp}`, url, prompt: currentPrompt, timestamp }];
            } else if (currentMode === 'audio') {
                if (genSettings.audioMode === 'speech') {
                    const url = await generateSpeech(currentPrompt ? `${currentPrompt}: ${audioText}` : audioText, genSettings.audioVoice);
                    resultItems = [{ id: `${timestamp}`, timestamp, prompt: audioText, audioUrl: url, voice: genSettings.audioVoice, subType: 'speech' }];
                } else {
                    const musicScore = await generateMusicScore(currentPrompt || audioText, genSettings.musicStyle);
                    resultItems = [{ id: `${timestamp}`, timestamp, prompt: currentPrompt || audioText, subType: 'music', musicScore }];
                }
            }

            // Only update state if request is still valid and we have results
            if (isGenCurrent()) {
                if (resultItems.length > 0) {
                    setBatches(prev => [{ id: `batch-${timestamp}`, timestamp, mode: currentMode, prompt: currentPrompt, isExpanded: true, items: resultItems }, ...prev]);
                    setHasGenerated(true);
                    handleStatusUpdate("创作完成");
                } else {
                    handleStatusUpdate("生成未返回结果，请重试");
                }
            }
        } catch (error: any) {
            if (isGenCurrent()) {
                if (error.message && error.message.includes("API key")) setRequiresApiKey(true);
                else handleStatusUpdate(`错误: ${error.message || "未知错误"}`);
            }
        } finally { 
            if (isGenCurrent()) setIsGenerating(false); 
        }
    }
  }, [genSettings, audioText, handleStatusUpdate, analysisModel]);

  const handleBatchExpand = (id: string) => { setBatches(prev => prev.map(b => b.id === id ? { ...b, isExpanded: true } : b)); };
  
  // Dynamic layout calculation to support compact rows based on aspect ratio
  const getBatchLayout = useCallback((batch: GenerationBatch) => {
      const GAP = 12; // Base gap between items
      let itemWidth = 256; // w-64
      let itemHeight = 256; // 1:1 default height

      if (batch.mode === 'image' || batch.mode === 'image-to-image') {
          const first = batch.items[0] as any;
          const ar = first?.aspectRatio;
          if (ar === '9:16') itemHeight = 455; 
          else if (ar === '16:9') itemHeight = 144;
          else itemHeight = 256; 
      } else if (batch.mode === 'video' || batch.mode === 'video-multiframe') {
          itemWidth = 320; 
          itemHeight = 180; 
      } else if (batch.mode === 'audio') {
          itemWidth = 288;
          itemHeight = 160; 
      } else if (batch.mode === 'note') {
          itemWidth = 256;
          itemHeight = 200;
      } else {
          itemWidth = 450; 
          itemHeight = 550;
      }

      return {
          strideX: itemWidth + GAP,
          strideY: itemHeight + GAP
      };
  }, []);

  // Optimized Y calculation using batches state directly
  const calculateBatchY = (index: number, currentBatches: GenerationBatch[]) => {
      let y = 100;
      // Iterate only up to the current index
      for (let i = 0; i < index; i++) {
          const b = currentBatches[i];
          const layout = getBatchLayout(b);
          
          if (!b.isExpanded) {
              y += 180; // Collapsed height + padding
          } else {
              const itemsPerRow = 4;
              const rows = Math.ceil(b.items.length / itemsPerRow);
              y += 100 + (rows * layout.strideY);
          }
      }
      return y;
  };

  const updateItemPosition = useCallback((id: string, x: number, y: number) => { 
      itemPositionsRef.current[id] = { x, y }; 
      // Force a re-render for connections only if specific conditions met (optimization)
      // Actually we need to re-render to update lines.
      setConnections(prev => [...prev]); 
  }, []);

  const handleAddNewNode = (type: 'note' | 'image' | 'story', x: number, y: number, sourcePrompt?: string) => {
      const timestamp = Date.now();
      const id = `manual-${timestamp}`;

      if (type === 'note') {
          const newItem = {
              id,
              content: sourcePrompt ? `关于 "${sourcePrompt.slice(0, 20)}..." 的笔记` : "点击编辑输入内容...",
              timestamp,
              type: 'note'
          };
          setBatches(prev => [{
              id: `batch-${id}`,
              timestamp,
              mode: 'note',
              prompt: "便签",
              isExpanded: true,
              items: [newItem]
          }, ...prev]);
          setNodeOverrides(prev => ({ ...prev, [id]: { x, y } }));
      } else {
          setPrompt(sourcePrompt || "");
          setMode(type);
          setNodeOverrides(prev => ({ ...prev, 'creation-center': { x, y } }));
          bringToFront('creation-center');
      }
      setContextMenu(null);
  };

  const handleNodeAddHandleClick = (e: React.MouseEvent, nodeId: string, side: 'left' | 'right', promptContext: string) => {
      e.stopPropagation();
      const currentOverride = nodeOverrides[nodeId] || itemPositionsRef.current[nodeId];
      const baseX = currentOverride?.x ?? e.clientX;
      const baseY = currentOverride?.y ?? e.clientY;
      const newX = side === 'right' ? baseX + 320 : baseX - 320;
      const newY = baseY;

      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          canvasX: newX,
          canvasY: newY,
          sourceNodeId: nodeId,
          type: 'node-handle'
      });
  };

  const handleContextAction = (action: string) => {
      if (!contextMenu) return;
      const { sourceNodeId, canvasX, canvasY } = contextMenu;
      
      let sourceImage: string | undefined;
      let sourcePrompt = "";
      if (sourceNodeId && contextMenu.type === 'node-handle') {
        for (const batch of batches) {
            const item = batch.items.find(i => i.id === sourceNodeId);
            if (item) {
                sourcePrompt = batch.prompt;
                if ((item as any).images && (item as any).images.length > 0) {
                    sourceImage = (item as any).images[0];
                }
            }
        }
      }

      if (contextMenu.type === 'node-handle') {
        setNodeOverrides(prev => ({ ...prev, 'creation-center': { x: canvasX, y: canvasY } }));

        if (action === 'image') {
            setMode('image');
            setPrompt(sourcePrompt ? `Variant of: ${sourcePrompt}` : "");
        } else if (action === 'video') {
            setMode('video');
            setPrompt(sourcePrompt);
            if (sourceImage) updateSettings({ referenceImages: [sourceImage] });
        } else if (action === 'img2img') {
            setMode('image-to-image');
            setPrompt(sourcePrompt);
            if (sourceImage) updateSettings({ referenceImages: [sourceImage] });
        } else if (action === 'multi-angle') {
            setMode('image'); 
            setPrompt(`${sourcePrompt}, multiple angles, character sheet`);
            if (sourceImage) updateSettings({ referenceImages: [sourceImage] });
        } else if (action === 'story') {
            setMode('story');
            setPrompt(`Continue the story based on: ${sourcePrompt}`);
        }
      }
      
      setContextMenu(null);
  };

  return (
    <div className="dark font-sans h-screen flex flex-col bg-ai-dark text-gray-200 overflow-hidden" 
         onContextMenu={(e) => e.preventDefault()}> 
        <Header isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)} />
        
        {statusNotification && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
                <div className="bg-ai-card/90 border border-ai-accent/30 text-gray-200 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border-t-ai-accent/50">
                    <div className="w-2 h-2 rounded-full bg-ai-accent animate-pulse shadow-[0_0_8px_rgba(139,92,246,1)]"></div>
                    <span className="text-xs font-black tracking-widest uppercase">{statusNotification}</span>
                </div>
            </div>
        )}

        {lightboxImage && (
            <div className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur-3xl flex items-center justify-center animate-in fade-in duration-500" onClick={() => setLightboxImage(null)}>
                <div className="relative group max-w-[90vw] max-h-[90vh]">
                    <img src={lightboxImage} alt="Preview" className="w-full h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-500" onClick={(e) => e.stopPropagation()} />
                    <button className="absolute -top-12 -right-12 p-3 text-white/50 hover:text-white transition-colors" onClick={() => setLightboxImage(null)}>
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
        )}

        <BatchActionBar selectedCount={selectedItemIds.size} onAction={handleBatchAction} />

        {contextMenu && (
            <div 
                className="fixed bg-ai-card border border-ai-border rounded-xl shadow-2xl p-1 z-[9999] w-56 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 mb-1">
                    {contextMenu.type === 'node-handle' ? "节点延展" : contextMenu.type === 'node' ? "节点操作" : "画布操作"}
                </div>
                
                {contextMenu.type === 'node-handle' && (
                    <>
                        <button onClick={() => handleContextAction('image')} className="text-left px-3 py-2 hover:bg-white/10 rounded-lg text-xs flex items-center gap-2 transition-colors group">
                            <HandDrawnPalette className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                            <span>图片生成 (Image Gen)</span>
                        </button>
                        <button onClick={() => handleContextAction('video')} className="text-left px-3 py-2 hover:bg-white/10 rounded-lg text-xs flex items-center gap-2 transition-colors group">
                            <HandDrawnCamera className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                            <span>视频生成 (Video Gen)</span>
                        </button>
                        <button onClick={() => handleContextAction('img2img')} className="text-left px-3 py-2 hover:bg-white/10 rounded-lg text-xs flex items-center gap-2 transition-colors group">
                            <HandDrawnReel className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform" />
                            <span>图生图 (Img2Img)</span>
                        </button>
                        <button onClick={() => handleContextAction('multi-angle')} className="text-left px-3 py-2 hover:bg-white/10 rounded-lg text-xs flex items-center gap-2 transition-colors group">
                            <HandDrawnFilmStrip className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
                            <span>多角度延展 (Multi-angle)</span>
                        </button>
                        <button onClick={() => handleContextAction('story')} className="text-left px-3 py-2 hover:bg-white/10 rounded-lg text-xs flex items-center gap-2 transition-colors group">
                            <HandDrawnBookOpen className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
                            <span>剧情延展 (Plot Ext)</span>
                        </button>
                    </>
                )}
            </div>
        )}

        <div className="absolute top-24 left-6 bottom-8 z-[90] pointer-events-none">
            <div className="pointer-events-auto h-full">
                <TemplateSidebar 
                    onApply={setPrompt} 
                    mode={mode} 
                    setMode={handleModeChange} 
                    settings={genSettings}
                    updateSettings={updateSettings}
                    onSelectApiKey={() => (window as any).aistudio?.openSelectKey()}
                    onTriggerUpload={() => promptInputRef.current?.triggerFileUpload()}
                />
            </div>
        </div>

        <div className="flex-1 w-full h-full pt-16">
            <CanvasWorkspace 
                onSelectionEnd={handleSelectionEnd} 
                onBackgroundClick={handleBackgroundClick}
            >
                {/* Render Connections */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
                    {connections.map(conn => {
                        const sourcePos = itemPositionsRef.current[conn.sourceId];
                        const targetPos = itemPositionsRef.current[conn.targetId];
                        if (!sourcePos || !targetPos) return null;
                        
                        // Simple center estimation (assuming avg width/height)
                        const x1 = sourcePos.x + 150; 
                        const y1 = sourcePos.y + 100;
                        const x2 = targetPos.x + 150;
                        const y2 = targetPos.y + 100;
                        
                        const dx = Math.abs(x2 - x1);
                        const c1x = x1 + dx * 0.5;
                        const c2x = x2 - dx * 0.5;

                        return (
                            <path 
                                key={conn.id}
                                d={`M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`}
                                fill="none"
                                stroke="#525252"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                                className="opacity-50"
                            />
                        );
                    })}
                    {connectingSourceId && itemPositionsRef.current[connectingSourceId] && (
                        /* Visual cue for pending connection */
                        <circle cx={itemPositionsRef.current[connectingSourceId].x + 150} cy={itemPositionsRef.current[connectingSourceId].y + 100} r="5" fill="#10b981" className="animate-ping" />
                    )}
                </svg>

                <DraggableNode 
                    id="creation-center" 
                    initialX={nodeOverrides['creation-center']?.x ?? 400} 
                    initialY={nodeOverrides['creation-center']?.y ?? 100} 
                    width="w-[420px]" 
                    height="h-[520px]" 
                    title="创意中心" 
                    tooltip="在这里构筑您的创意，支持文本、图像上传。Gemini 3 Pro 将深度思考您的输入。" 
                    icon={<HandDrawnPen className="w-4 h-4" />} 
                    onPositionChange={updateItemPosition}
                    onSelect={(id) => bringToFront(id)}
                    isSelected={selectedItemIds.has('creation-center')}
                    className={`z-[${getZIndex('creation-center')}]`}
                    onAddNext={(e) => handleNodeAddHandleClick(e, 'creation-center', 'right', prompt)}
                    staticNode={true}
                    isLocked={lockedNodeIds.has('creation-center')}
                >
                    <div className="h-full p-3 flex flex-col">
                        <PromptInput 
                            ref={promptInputRef} 
                            prompt={prompt} 
                            setPrompt={setPrompt} 
                            onSubmit={() => processRequest(prompt, answeredQuestions, mode, false, false)} 
                            onAnalyze={() => processRequest(prompt, answeredQuestions, mode, false, true)} 
                            isLoading={isGenerating} 
                            isGenerating={isGenerating} 
                            isFirstRun={!hasGenerated} 
                            mode={mode} 
                            settings={genSettings}
                            updateSettings={updateSettings}
                            audioText={audioText} 
                            setAudioText={setAudioText} 
                        />
                    </div>
                </DraggableNode>

                <DraggableNode 
                    id="analysis-center" 
                    initialX={nodeOverrides['analysis-center']?.x ?? 880} 
                    initialY={nodeOverrides['analysis-center']?.y ?? 100} 
                    width="w-[600px]" 
                    height="h-[640px]" 
                    title="共创分析" 
                    tooltip="通过信念图谱和智能澄清，AI 能够识别您想法中的模糊点并给出专业增强建议。" 
                    icon={<HandDrawnNodes className="w-4 h-4" />} 
                    onPositionChange={updateItemPosition}
                    onSelect={(id) => bringToFront(id)}
                    isSelected={selectedItemIds.has('analysis-center')}
                    className={`z-[${getZIndex('analysis-center')}]`}
                    staticNode={true}
                    isLocked={lockedNodeIds.has('analysis-center')}
                >
                    <div className="flex flex-col h-full bg-ai-dark/30">
                        <div className="flex items-center justify-between px-2 py-1 bg-black/20 border-b border-white/5">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">分析模型</span>
                            <select 
                                value={analysisModel} 
                                onChange={(e) => setAnalysisModel(e.target.value)}
                                className="text-[10px] bg-transparent text-ai-accent font-mono outline-none cursor-pointer"
                            >
                                <option value="gemini-3-pro-preview">Gemini 3 Pro (High Quality)</option>
                                <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                            </select>
                        </div>
                        <div className="flex border-b border-white/5 bg-black/40 p-1">
                            {['graph', 'clarify', 'attributes', 'pose'].map(v => (
                                <button key={v} onClick={() => setActiveAnalysisView(v as any)} className={`flex-1 py-2 text-[10px] font-black tracking-widest uppercase transition-all rounded-xl ${activeAnalysisView === v ? 'text-ai-accent bg-ai-accent/10 border border-ai-accent/30' : 'text-gray-500 hover:text-gray-300'}`}>
                                    {v === 'graph' ? '信念图谱' : v === 'clarify' ? '智能澄清' : v === 'attributes' ? '属性调优' : '姿势参考'}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 relative overflow-hidden">
                            <div className={`${activeAnalysisView === 'graph' ? 'block' : 'hidden'} absolute inset-0`}>
                                <BeliefGraph data={beliefGraph} isLoading={isGraphLoading} mode={mode} view='graph' pendingAttributeUpdates={pendingAttributeUpdates} setPendingAttributeUpdates={setPendingAttributeUpdates} pendingRelationshipUpdates={pendingRelationshipUpdates} setPendingRelationshipUpdates={setPendingRelationshipUpdates} pendingClarificationCount={Object.keys(pendingClarificationAnswers).length} currentPrompt={prompt} />
                            </div>
                            <div className={`${activeAnalysisView === 'attributes' ? 'block' : 'hidden'} absolute inset-0`}>
                                <BeliefGraph data={beliefGraph} isLoading={isGraphLoading} mode={mode} view='attributes' pendingAttributeUpdates={pendingAttributeUpdates} setPendingAttributeUpdates={setPendingAttributeUpdates} pendingRelationshipUpdates={pendingRelationshipUpdates} setPendingRelationshipUpdates={setPendingRelationshipUpdates} pendingClarificationCount={Object.keys(pendingClarificationAnswers).length} currentPrompt={prompt} />
                            </div>
                            <div className={`${activeAnalysisView === 'clarify' ? 'block' : 'hidden'} absolute inset-0 bg-ai-card`}>
                                <ClarificationCard clarifications={clarifications} onRefresh={() => processRequest(prompt, answeredQuestions, mode, false, true)} isLoading={isClarificationsLoading} pendingAnswers={pendingClarificationAnswers} setPendingAnswers={setPendingClarificationAnswers} onApply={handleApplyAllUpdates} isApplying={isUpdatingPrompt} prompt={prompt} />
                            </div>
                            <div className={`${activeAnalysisView === 'pose' ? 'block' : 'hidden'} absolute inset-0 bg-ai-card`}>
                                <PoseReferenceCard currentPrompt={prompt} mode={mode} onApplyPose={handleApplyPose} handleStatusUpdate={handleStatusUpdate} />
                            </div>
                        </div>
                    </div>
                </DraggableNode>

                {batches.map((batch, bIdx) => {
                    const batchBaseY = calculateBatchY(bIdx, batches);
                    const layout = getBatchLayout(batch);
                    
                    if (batch.mode === 'note') {
                        return batch.items.map((item: any) => (
                            <TextResultNode 
                                key={item.id} 
                                item={{...item, type: 'note'}} 
                                initialX={nodeOverrides[item.id]?.x ?? (1500 + 100)}
                                initialY={nodeOverrides[item.id]?.y ?? (batchBaseY)}
                                onClose={() => handleRemoveItem(batch.id, item.id)}
                                onUpdate={(c) => handleUpdateTextInBatch(batch.id, item.id, c)}
                                onApplyToPrompt={setPrompt}
                                onExtend={() => {}}
                                isSelected={selectedItemIds.has(item.id)}
                                onSelect={handleSelectNode}
                                onPositionChange={updateItemPosition}
                                className={`z-[${getZIndex(item.id)}]`}
                                isExpanded={expandedNodeId === item.id}
                                onExpand={() => setExpandedNodeId(item.id)}
                                isLocked={lockedNodeIds.has(item.id)}
                            />
                        ));
                    }

                    if (!batch.isExpanded) {
                        return (
                            <BatchGroupNode 
                                key={batch.id} 
                                batch={batch} 
                                initialX={nodeOverrides[batch.id]?.x ?? 1500} 
                                initialY={nodeOverrides[batch.id]?.y ?? batchBaseY} 
                                onExpand={() => handleBatchExpand(batch.id)} 
                                onClose={() => setBatches(prev => prev.filter(b => b.id !== batch.id))} 
                            />
                        );
                    }
                    return <React.Fragment key={batch.id}>
                        {batch.items.map((item, iIdx) => {
                            const commonProps = {
                                initialX: nodeOverrides[item.id]?.x ?? (1500 + (iIdx % 4) * layout.strideX),
                                initialY: nodeOverrides[item.id]?.y ?? (batchBaseY + Math.floor(iIdx / 4) * layout.strideY),
                                onClose: () => handleRemoveItem(batch.id, item.id),
                                isSelected: selectedItemIds.has(item.id),
                                onSelect: handleSelectNode,
                                onPositionChange: updateItemPosition,
                                className: `z-[${getZIndex(item.id)}]`,
                                onAddNext: (e: React.MouseEvent) => handleNodeAddHandleClick(e, item.id, 'right', batch.prompt),
                                onAddPrev: (e: React.MouseEvent) => handleNodeAddHandleClick(e, item.id, 'left', batch.prompt),
                                isExpanded: expandedNodeId === item.id,
                                onExpand: () => setExpandedNodeId(item.id),
                                isLocked: lockedNodeIds.has(item.id)
                            };
                            if (batch.mode === 'image' || batch.mode === 'image-to-image') return <ImageResultNode key={item.id} item={item as any} {...commonProps} onImageClick={setLightboxImage} onExtend={() => {}} onUpdateScript={(idx, txt) => handleUpdateImageScript(batch.id, item.id, idx, txt)} />;
                            if (batch.mode === 'story' || batch.mode === 'comic') return <TextResultNode key={item.id} item={item as any} {...commonProps} onUpdate={(c) => handleUpdateTextInBatch(batch.id, item.id, c)} onApplyToPrompt={setPrompt} onExtend={() => {}} />;
                            if (batch.mode === 'video' || batch.mode === 'video-multiframe') return <VideoResultNode key={item.id} item={item as any} {...commonProps} />;
                            if (batch.mode === 'audio') return <AudioResultNode key={item.id} item={item as any} {...commonProps} />;
                            return null;
                        })}
                    </React.Fragment>;
                })}
            </CanvasWorkspace>
        </div>
    </div>
  );
}

export default App;
