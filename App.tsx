
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import PromptInput from './components/PromptInput';
import ClarificationCard from './components/ClarificationCard';
import BeliefGraph from './components/BeliefGraph';
import OutputDisplay from './components/OutputGallery';
import { TemplateSidebar } from './components/TemplateSidebar';
import { HandDrawnClapper, HandDrawnNodes, HandDrawnSettings } from './components/icons';
import {
  parsePromptToBeliefGraph,
  generateClarifications,
  generateImagesFromPrompt,
  generateStoryFromPrompt,
  generateVideosFromPrompt,
  refinePromptWithAllUpdates,
} from './services/geminiService';
import { BeliefState, Clarification, GraphUpdate, Attribute, ImageGenerationItem, Entity } from './types';

type Mode = 'image' | 'story' | 'video' | 'image-to-image';
type ToolTab = 'clarify' | 'graph' | 'attributes';
type MobileView = 'editor' | 'preview';

function App() {
  const [prompt, setPrompt] = useState('一只猫正在为它的动物朋友们举办派对');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [imageCount, setImageCount] = useState<number>(4);
  const [imageStyle, setImageStyle] = useState<string>('none');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [isAttributesLoading, setIsAttributesLoading] = useState(false);
  const [isClarificationsLoading, setIsClarificationsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState(false);
  
  const [isOutdated, setIsOutdated] = useState(false); 
  const [showModeChangePopup, setShowModeChangePopup] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [mode, setMode] = useState<Mode>('image');
  
  const modeRef = useRef<Mode>(mode);
  const analysisRequestIdRef = useRef(0);
  const generationRequestIdRef = useRef(0);

  const [imageHistory, setImageHistory] = useState<ImageGenerationItem[]>([]);
  const [story, setStory] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  
  const [galleryErrors, setGalleryErrors] = useState<Record<Mode, string | null>>({ image: null, story: null, video: null, 'image-to-image': null });
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
  
  const [activeToolTab, setActiveToolTab] = useState<ToolTab>('clarify');
  const [mobileView, setMobileView] = useState<MobileView>('editor');

  const [isDarkMode, setIsDarkMode] = useState(true); // Default to Dark
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  useEffect(() => {
    if (isGenerating) {
        setMobileView('preview');
    }
  }, [isGenerating]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
      // Enforce dark mode class on HTML element for this style
      document.documentElement.classList.add('dark');
      if (!isDarkMode) {
          document.documentElement.classList.remove('dark');
      }
  }, [isDarkMode]);

  const clearPendingUpdates = () => {
    setPendingAttributeUpdates({});
    setPendingRelationshipUpdates({});
    setPendingClarificationAnswers({});
  };

  const handleStatusUpdate = useCallback((msg: string) => {
    setStatusNotification(msg);
  }, []);

  const handleModeChange = (newMode: Mode) => {
    if (newMode === mode) return;
    analysisRequestIdRef.current += 1;
    generationRequestIdRef.current += 1;
    setMode(newMode);
    setIsGraphLoading(false);
    setIsAttributesLoading(false);
    setIsClarificationsLoading(false);
    setIsGenerating(false);
    setIsUpdatingPrompt(false);
    setShowModeChangePopup(true);
    setRequiresApiKey(false); 
  };

  const refreshAnalysis = useCallback(async (currentPrompt: string, currentAnsweredQuestions: string[], currentMode: Mode) => {
    const requestId = ++analysisRequestIdRef.current;
    const isCurrent = () => modeRef.current === currentMode && analysisRequestIdRef.current === requestId;
    const safeStatusUpdate = (msg: string) => { if (isCurrent()) handleStatusUpdate(msg); };

    setIsGraphLoading(true);
    setIsAttributesLoading(true);
    setIsClarificationsLoading(true);

    const graphPromise = parsePromptToBeliefGraph(currentPrompt, currentMode, safeStatusUpdate)
        .then(graphStructure => {
            if (isCurrent()) {
                if (graphStructure) setBeliefGraph(graphStructure);
            }
        })
        .catch(error => {
            console.error("Failed to parse belief graph:", error);
        })
        .finally(() => {
            if (isCurrent()) {
                setIsGraphLoading(false);
                setIsAttributesLoading(false);
            }
        });

    const clarificationPromise = generateClarifications(currentPrompt, currentAnsweredQuestions, currentMode, safeStatusUpdate)
        .then(generatedClarifications => {
            if (isCurrent()) setClarifications(generatedClarifications);
        })
        .catch(error => {
            console.error("Failed to generate clarifications:", error);
        })
        .finally(() => {
             if (isCurrent()) setIsClarificationsLoading(false);
        });

    if (isCurrent()) {
         setLastAnalyzedPrompt(currentPrompt);
         setLastAnalyzedMode(currentMode);
    }
    
    return Promise.all([graphPromise, clarificationPromise]);
  }, [handleStatusUpdate]);

  const handleRefreshClarifications = useCallback(() => {
    const requestId = ++analysisRequestIdRef.current;
    const requestMode = mode;
    const isCurrent = () => modeRef.current === requestMode && analysisRequestIdRef.current === requestId;
    const safeStatusUpdate = (msg: string) => { if (isCurrent()) handleStatusUpdate(msg); };

    setIsClarificationsLoading(true);
    setPendingClarificationAnswers({});
    setStatusNotification(null);
    
    const currentQuestions = clarifications.map(c => c.question);
    const newSkipped = [...skippedQuestions, ...currentQuestions];
    setSkippedQuestions(newSkipped);

    const currentPrompt = prompt;
    const excludeList = [...answeredQuestions, ...newSkipped];

    generateClarifications(currentPrompt, excludeList, requestMode, safeStatusUpdate)
        .then(newClarifications => {
            if (isCurrent()) setClarifications(newClarifications);
        })
        .catch(error => console.error("Failed to refresh clarifications:", error))
        .finally(() => {
             if (isCurrent()) {
                 setIsClarificationsLoading(false);
                 setStatusNotification(null);
             }
        });
  }, [prompt, answeredQuestions, mode, clarifications, skippedQuestions, handleStatusUpdate]);

  const processRequest = useCallback(async (
    currentPrompt: string, 
    currentAnsweredQuestions: string[], 
    currentMode: Mode,
    skipAnalysis: boolean = false,
    skipGeneration: boolean = false
  ) => {
    const genRequestId = ++generationRequestIdRef.current;
    const requestMode = currentMode;
    const isGenCurrent = () => modeRef.current === requestMode && generationRequestIdRef.current === genRequestId;
    const safeGenStatusUpdate = (msg: string) => { if (isGenCurrent()) handleStatusUpdate(msg); };

    setGalleryErrors(prev => ({ ...prev, [requestMode]: null }));
    setRequiresApiKey(false);

    if (!skipGeneration) {
        if (requestMode === 'story') setStory(null);
        else if (requestMode === 'video') setVideo(null);
    }
    
    setIsOutdated(false); 
    setStatusNotification(null);
    setShowModeChangePopup(false);
    
    if (!skipAnalysis) {
        setBeliefGraph(null); 
        setClarifications([]);
        clearPendingUpdates();
        setSkippedQuestions([]); 
    }
    
    const analysisPromise = !skipAnalysis 
        ? refreshAnalysis(currentPrompt, currentAnsweredQuestions, currentMode)
        : Promise.resolve();

    let generationPromise = Promise.resolve();

    if (!skipGeneration) {
        setIsGenerating(true);
        generationPromise = (async () => {
            try {
                if (requestMode === 'image' || requestMode === 'image-to-image') {
                    const refs = requestMode === 'image-to-image' ? referenceImages : [];
                    const generatedImages = await generateImagesFromPrompt(currentPrompt, aspectRatio, refs, imageCount, imageStyle, imageSize, safeGenStatusUpdate);
                    if (isGenCurrent()) {
                        const newItem: ImageGenerationItem = {
                            id: Date.now().toString(),
                            timestamp: Date.now(),
                            prompt: currentPrompt,
                            aspectRatio: aspectRatio,
                            images: generatedImages,
                            referenceImages: refs.length > 0 ? refs : undefined
                        };
                        setImageHistory(prev => [newItem, ...prev]);
                    }
                } else if (requestMode === 'story') {
                    const generatedStory = await generateStoryFromPrompt(currentPrompt, safeGenStatusUpdate);
                    if (isGenCurrent()) setStory(generatedStory);
                } else if (requestMode === 'video') {
                    const generatedVideo = await generateVideosFromPrompt(currentPrompt, aspectRatio, resolution, safeGenStatusUpdate);
                    if (isGenCurrent()) setVideo(generatedVideo);
                }
            } catch (error: any) {
                if (isGenCurrent()) {
                    console.error(`${requestMode} generation failed:`, error);
                    const message = error?.error?.message || error.message || `${requestMode} 生成过程中发生未知错误。`;
                    if (message.includes("请选择 API 密钥")) {
                         setRequiresApiKey(true);
                    } else {
                         setGalleryErrors(prev => ({ ...prev, [requestMode]: message }));
                    }
                }
            } finally {
                if (isGenCurrent()) {
                    setIsGenerating(false);
                    setStatusNotification(null);
                }
            }
        })();
    }

    await Promise.all([analysisPromise, generationPromise]).finally(() => {
        if (isGenCurrent() && !isGenerating) setStatusNotification(null);
    });

  }, [refreshAnalysis, handleStatusUpdate, aspectRatio, resolution, referenceImages, imageCount, imageStyle, imageSize]);

  const handlePromptSubmit = useCallback(() => {
    setHasGenerated(true);
    const shouldSkipAnalysis = prompt === lastAnalyzedPrompt && mode === lastAnalyzedMode;
    if (shouldSkipAnalysis) {
        processRequest(prompt, answeredQuestions, mode, true, false);
    } else {
        const newAnsweredQuestions: string[] = [];
        setAnsweredQuestions(newAnsweredQuestions);
        setClarifications([]); 
        processRequest(prompt, newAnsweredQuestions, mode, false, false);
    }
  }, [prompt, mode, lastAnalyzedPrompt, lastAnalyzedMode, answeredQuestions, processRequest]);

  const handleAnalyzeOnly = useCallback(() => {
     const newAnsweredQuestions: string[] = [];
     setAnsweredQuestions(newAnsweredQuestions);
     setClarifications([]);
     processRequest(prompt, newAnsweredQuestions, mode, false, true);
  }, [prompt, mode, processRequest]);

  const handleSelectApiKey = async () => {
      const win = window as any;
      if (win.aistudio && win.aistudio.openSelectKey) {
          await win.aistudio.openSelectKey();
          if (requiresApiKey) {
             setRequiresApiKey(false);
          }
      }
  };

  const handleAddEntity = (name: string) => {
    setBeliefGraph(prev => {
        if (!prev) return prev;
        if (prev.entities.some(e => e.name === name)) {
            handleStatusUpdate(`实体 "${name}" 已存在。`);
            return prev;
        }
        const newEntity: Entity = {
            name,
            presence_in_prompt: false,
            description: '用户自定义添加的新实体。',
            alternatives: [],
            attributes: [{ name: 'existence', presence_in_prompt: false, value: [{ name: 'true' }, { name: 'false' }] }]
        };
        return { ...prev, entities: [...prev.entities, newEntity] };
    });
  };

  const handleApplyAllUpdates = async () => {
    if (isUpdatingPrompt) return;
    const requestMode = mode;
    const isCurrent = () => modeRef.current === requestMode;
    const safeStatusUpdate = (msg: string) => { if (isCurrent()) handleStatusUpdate(msg); };
    setIsUpdatingPrompt(true);
    setStatusNotification(null);

    const qaPairs: {question: string, answer: string}[] = Object.entries(pendingClarificationAnswers).map(([q, a]) => ({question: q, answer: a as string}));
    const graphUpdates: GraphUpdate[] = [];
    Object.entries(pendingAttributeUpdates).forEach(([key, value]) => {
        const [entity, attribute] = key.split(':');
        graphUpdates.push({ type: 'attribute', entity, attribute, value: value as string });
    });
    Object.entries(pendingRelationshipUpdates).forEach(([key, value]) => {
        const [source, target] = key.split(':');
        const originalRel = beliefGraph?.relationships.find(r => r.source === source && r.target === target);
        if (originalRel) {
            graphUpdates.push({ type: 'relationship', source, target, oldLabel: originalRel.label, newLabel: value as string });
        }
    });

    const newAnsweredQuestions = [...answeredQuestions, ...qaPairs.map(a => a.question)];
    setAnsweredQuestions(newAnsweredQuestions);

    try {
        const newRefinedPrompt = await refinePromptWithAllUpdates(prompt, qaPairs, graphUpdates, safeStatusUpdate);
        if (!isCurrent()) return;
        setPrompt(newRefinedPrompt);
        setIsOutdated(true); 
        clearPendingUpdates(); 
        setSkippedQuestions([]); 
        refreshAnalysis(newRefinedPrompt, newAnsweredQuestions, requestMode);
    } catch(error) {
        console.error("Failed to handle updates:", error);
        if (isCurrent()) setGalleryErrors(prev => ({ ...prev, [requestMode]: "无法根据您的更改优化提示词。" }));
    } finally {
        if (isCurrent()) {
            setIsUpdatingPrompt(false);
            setStatusNotification(null);
        }
    }
  };
  
  const ToolTabButton = ({ label, tab, current, description, icon }: { label: string, tab: ToolTab, current: ToolTab, description: string, icon: React.ReactNode }) => (
      <button 
        onClick={() => setActiveToolTab(tab)}
        title={description}
        className={`px-4 py-3 text-sm font-medium transition-all focus:outline-none flex items-center gap-2 rounded-t-xl border-t border-x ${current === tab ? 'border-ai-border bg-ai-card text-ai-accent' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
      >
        {icon}
        {label}
      </button>
  );

  const pendingClarificationCount = Object.keys(pendingClarificationAnswers).length;
  const pendingGraphUpdatesCount = Object.keys(pendingAttributeUpdates).length + Object.keys(pendingRelationshipUpdates).length;
  const totalUpdateCount = pendingClarificationCount + pendingGraphUpdatesCount;

  return (
    <div className={`dark font-sans h-screen flex flex-col bg-ai-dark text-gray-200 transition-colors duration-200 overflow-hidden`}>
        <Header 
            isDarkMode={isDarkMode} 
            toggleDarkMode={() => setIsDarkMode(!isDarkMode)} 
            onShowInfo={() => setShowInfoModal(true)}
        />

        {statusNotification && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[2000] animate-fade-in-down px-4 w-full max-w-md">
                <div className="bg-ai-card/90 border border-ai-accent/30 text-ai-accent-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-pulse text-ai-accent" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium flex-1 text-gray-200">{statusNotification}</span>
                    <button 
                        onClick={() => setStatusNotification(null)} 
                        className="ml-auto text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        )}

        <div className="flex-1 flex overflow-hidden relative gap-2 p-2">
            <TemplateSidebar 
                onApply={setPrompt}
                mode={mode}
                setMode={handleModeChange}
                imageCount={imageCount}
                setImageCount={setImageCount}
                imageStyle={imageStyle}
                setImageStyle={setImageStyle}
                imageSize={imageSize}
                setImageSize={setImageSize}
                aspectRatio={aspectRatio}
                setAspectRatio={setAspectRatio}
                resolution={resolution}
                setResolution={setResolution}
                onSelectApiKey={handleSelectApiKey}
            />

            <main className="flex-1 flex w-full min-w-0 gap-2">
                
                {/* LEFT COLUMN: Creation & Refinement (33%) */}
                <div className={`flex-col bg-ai-card rounded-2xl border border-ai-border w-full xl:w-[33%] flex-shrink-0 z-10 overflow-hidden ${mobileView === 'editor' ? 'flex' : 'hidden xl:flex'}`}>
                    
                    {/* 1. Prompt Input (Fixed Top) */}
                    <div className="flex-shrink-0 p-4 pb-2 h-96">
                        <PromptInput
                            prompt={prompt}
                            setPrompt={setPrompt}
                            // Removed aspect ratio, resolution etc from here
                            onSubmit={handlePromptSubmit}
                            onAnalyze={handleAnalyzeOnly}
                            isLoading={isGenerating}
                            isGenerating={isGenerating}
                            isFirstRun={!hasGenerated}
                            mode={mode}
                            // Removed setMode
                            referenceImages={referenceImages}
                            setReferenceImages={setReferenceImages}
                        />
                    </div>

                    {/* 2. Workspace Navigation */}
                    <div className="flex-shrink-0 px-4 mt-2 border-b border-ai-border flex items-center justify-between">
                         <div className="flex space-x-1">
                            <ToolTabButton 
                                label="澄清" 
                                tab="clarify" 
                                current={activeToolTab} 
                                description="回答 AI 问题以完善提示词细节" 
                                icon={<HandDrawnClapper className="h-4 w-4" />}
                            />
                            <ToolTabButton 
                                label="图谱" 
                                tab="graph" 
                                current={activeToolTab} 
                                description="可视化编辑场景中的实体关系" 
                                icon={<HandDrawnNodes className="h-4 w-4" />}
                            />
                            <ToolTabButton 
                                label="属性" 
                                tab="attributes" 
                                current={activeToolTab} 
                                description="调整场景中各个对象的具体属性" 
                                icon={<HandDrawnSettings className="h-4 w-4" />}
                            />
                         </div>
                    </div>

                    {/* 3. Main Workspace (Flexible Content) */}
                    <div className="flex-1 relative overflow-hidden bg-ai-dark/30">
                        {/* Clarification Card Container */}
                        <div className={`absolute inset-0 p-4 overflow-y-auto ${activeToolTab === 'clarify' ? 'block' : 'hidden'}`}>
                            <ClarificationCard
                                clarifications={clarifications}
                                onRefresh={handleRefreshClarifications}
                                isLoading={isClarificationsLoading} 
                                pendingAnswers={pendingClarificationAnswers}
                                setPendingAnswers={setPendingClarificationAnswers}
                                prompt={prompt}
                            />
                        </div>

                        {/* Belief Graph / Attributes Container */}
                        <div className={`absolute inset-0 ${activeToolTab !== 'clarify' ? 'block' : 'hidden'}`}>
                            <BeliefGraph 
                                data={beliefGraph} 
                                isLoading={isGraphLoading} 
                                mode={mode} 
                                view={activeToolTab === 'attributes' ? 'attributes' : 'graph'}
                                isVisible={activeToolTab !== 'clarify'}
                                pendingAttributeUpdates={pendingAttributeUpdates}
                                setPendingAttributeUpdates={setPendingAttributeUpdates}
                                pendingRelationshipUpdates={pendingRelationshipUpdates}
                                setPendingRelationshipUpdates={setPendingRelationshipUpdates}
                                pendingClarificationCount={pendingClarificationCount}
                                currentPrompt={prompt}
                                onAddEntity={handleAddEntity}
                            />
                        </div>
                    </div>

                    {/* 4. Action Footer (Conditional) */}
                    <div className={`flex-shrink-0 border-t border-ai-border bg-ai-card px-6 py-4 transition-all duration-300 flex items-center justify-between ${totalUpdateCount > 0 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 h-0 p-0 overflow-hidden'}`}>
                        <div className="flex items-center gap-2 text-ai-accent text-sm font-medium">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ai-accent/20 text-xs font-bold">{totalUpdateCount}</span>
                            <span>项更改</span>
                        </div>
                        <button
                            onClick={handleApplyAllUpdates}
                            disabled={isUpdatingPrompt}
                            className="bg-ai-accent hover:bg-ai-accent-hover text-white font-bold py-2 px-4 rounded-xl shadow-lg shadow-ai-accent/20 flex items-center gap-2 transition-transform active:scale-95 text-xs"
                        >
                             {isUpdatingPrompt ? (
                                <>
                                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>优化中</span>
                                </>
                            ) : (
                                <span>更新重绘</span>
                            )}
                        </button>
                    </div>

                </div>
                
                {/* RIGHT COLUMN: Gallery & Output (67%) */}
                <div className={`flex-col flex-1 bg-ai-card w-full xl:w-[67%] min-w-0 ${mobileView === 'preview' ? 'flex' : 'hidden xl:flex'} rounded-2xl border border-ai-border shadow-lg overflow-hidden relative`}>
                    <OutputDisplay
                        imageHistory={imageHistory}
                        story={story}
                        video={video}
                        mode={mode}
                        isLoading={isGenerating}
                        error={galleryErrors[mode]}
                        isOutdated={isOutdated}
                        requiresApiKey={requiresApiKey}
                        onSelectKey={handleSelectApiKey}
                    />
                </div>

            </main>
        </div>

        {/* Mobile View Toggles (Fixed Bottom) */}
        <div className="xl:hidden bg-ai-card border-t border-ai-border flex justify-around p-2 shadow-2xl z-[200] fixed bottom-0 left-0 right-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
            <button onClick={() => setMobileView('editor')} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-colors ${mobileView === 'editor' ? 'text-ai-accent bg-ai-accent/10' : 'text-gray-500'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                <span className="text-[10px] font-bold uppercase tracking-wide">编辑</span>
            </button>
            <button onClick={() => setMobileView('preview')} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-colors ${mobileView === 'preview' ? 'text-ai-accent bg-ai-accent/10' : 'text-gray-500'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-[10px] font-bold uppercase tracking-wide">预览</span>
            </button>
        </div>

        {/* Info Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 z-[3000] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in" onClick={() => setShowInfoModal(false)}>
            <div className="bg-ai-card rounded-2xl shadow-2xl max-w-lg w-full p-6 relative border border-ai-border" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowInfoModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              <div className="text-center mb-6">
                 <h2 className="text-2xl font-bold text-white mb-2">主动共创助手</h2>
                 <p className="text-gray-400">感谢使用我们的应用！</p>
              </div>
              <div className="grid gap-4">
                  <a href="https://zi-wang.com/co-creator-feedback" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-xl bg-ai-dark border border-ai-border hover:border-ai-accent transition-all group">
                      <div className="flex items-center gap-3">
                          <div className="bg-ai-accent/10 p-2 rounded-full text-ai-accent"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg></div>
                          <div className="text-left"><h3 className="font-semibold text-white">提供反馈</h3><p className="text-sm text-gray-500">帮助我们改进体验</p></div>
                      </div>
                  </a>
              </div>
            </div>
          </div>
        )}

        {showModeChangePopup && (
            <div className="fixed bottom-4 right-4 z-[2000] animate-fade-in-up max-w-sm w-full mx-auto px-4 sm:px-0">
                <div className="bg-ai-card border-l-4 border-amber-500 rounded-r-xl shadow-2xl p-4 relative flex flex-col gap-1 border border-ai-border">
                     <button onClick={() => setShowModeChangePopup(false)} className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                    <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5"><svg className="h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg></div>
                        <div className="ml-3 pr-6">
                            <h3 className="text-sm font-bold text-white">模式已更改</h3>
                            <p className="mt-1 text-sm text-gray-400 leading-relaxed">信念图和澄清问题来自上一个模式。它们被保留以供参考，但可能已过时。</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}

export default App;
