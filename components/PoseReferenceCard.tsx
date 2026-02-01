
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { generatePoseSuggestions } from '../services/geminiService';

interface Pose {
    category: string;
    label: string;
    prompt: string;
}

interface PoseReferenceCardProps {
    currentPrompt: string;
    mode: string;
    onApplyPose: (posePrompt: string) => void;
    handleStatusUpdate: (msg: string) => void;
}

const PoseReferenceCard: React.FC<PoseReferenceCardProps> = ({ 
    currentPrompt, 
    mode, 
    onApplyPose, 
    handleStatusUpdate 
}) => {
    const [poses, setPoses] = useState<Pose[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPose, setSelectedPose] = useState<string | null>(null);

    const fetchSuggestions = async () => {
        if (!currentPrompt.trim()) return;
        setIsLoading(true);
        try {
            const results = await generatePoseSuggestions(currentPrompt, mode);
            setPoses(results);
        } catch (error) {
            console.error("Failed to fetch poses", error);
            handleStatusUpdate("获取姿势建议失败");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (currentPrompt && poses.length === 0) {
            fetchSuggestions();
        }
    }, [currentPrompt]);

    const handleApply = (pose: Pose) => {
        setSelectedPose(pose.label);
        onApplyPose(pose.prompt);
        handleStatusUpdate(`已应用姿势提示词: ${pose.label}`);
    };

    return (
        <div className="bg-ai-dark/50 rounded-2xl h-full flex flex-col relative overflow-hidden group">
            {isLoading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
                    <div className="flex flex-col items-center gap-4">
                        <svg className="animate-spin h-10 w-10 text-ai-accent" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm font-medium text-gray-400 animate-pulse">正在构思最佳姿势...</span>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
                {poses.length === 0 && !isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-white/5 rounded-3xl m-2 text-center p-6">
                        <p className="text-sm font-medium">输入创意并点击下方按钮获取姿势建议</p>
                        <button 
                            onClick={fetchSuggestions}
                            className="mt-4 text-xs font-bold text-ai-accent border border-ai-accent/30 px-4 py-2 rounded-xl hover:bg-ai-accent/10 transition-all"
                        >
                            即刻获取
                        </button>
                    </div>
                ) : (
                    poses.map((pose, index) => (
                        <div 
                            key={index} 
                            className={`p-4 rounded-2xl border transition-all cursor-pointer group/item ${
                                selectedPose === pose.label 
                                    ? 'bg-ai-accent/20 border-ai-accent shadow-lg shadow-ai-accent/10' 
                                    : 'bg-white/5 border-white/5 hover:border-ai-accent/30'
                            }`}
                            onClick={() => handleApply(pose)}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-ai-accent/70 bg-ai-accent/10 px-2 py-0.5 rounded">
                                    {pose.category}
                                </span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 group-hover/item:text-ai-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <h4 className="text-sm font-bold text-gray-200 mb-1">{pose.label}</h4>
                            <p className="text-[10px] text-gray-500 italic font-mono line-clamp-2">{pose.prompt}</p>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 bg-black/40 border-t border-white/5 backdrop-blur-xl">
                <button 
                    onClick={fetchSuggestions}
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    刷新姿势库
                </button>
            </div>
        </div>
    );
};

export default PoseReferenceCard;
