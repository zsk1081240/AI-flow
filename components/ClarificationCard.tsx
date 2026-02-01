
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo } from 'react';
import { Clarification } from '../types';

interface ClarificationCardProps {
  clarifications: Clarification[];
  onRefresh: () => void;
  isLoading: boolean;
  pendingAnswers: {[key: string]: string};
  setPendingAnswers: React.Dispatch<React.SetStateAction<{[key: string]: string}>>;
  onApply: () => void;
  isApplying?: boolean;
  prompt?: string;
}

const ThinkingProcess = ({ prompt = "" }: { prompt: string }) => {
    const [step, setStep] = useState(0);
    const steps = useMemo(() => [
        "正在分析任务意图...",
        "正在识别指令中的模糊要素...",
        "正在评估信息完整度...",
        "正在构思关键澄清问题...",
        "正在准备专业选项...",
    ], []);

    useEffect(() => {
        const interval = setInterval(() => setStep((s) => (s + 1) % steps.length), 1800);
        return () => clearInterval(interval);
    }, [steps]);

    return (
        <span className="text-sm font-medium text-ai-accent animate-pulse min-w-[240px] text-center">
            {steps[step]}
        </span>
    );
};

const ClarificationCard: React.FC<ClarificationCardProps> = ({ 
    clarifications, 
    onRefresh,
    isLoading,
    pendingAnswers,
    setPendingAnswers,
    onApply,
    isApplying = false,
    prompt = ""
}) => {

  const handleSelectOption = (question: string, option: string) => {
      setPendingAnswers(prev => {
          if (prev[question] === option) {
              const newState = { ...prev };
              delete newState[question];
              return newState;
          }
          return { ...prev, [question]: option };
      });
  };

  const handleCustomAnswerChange = (question: string, value: string) => {
      setPendingAnswers(prev => {
          const newState = { ...prev, [question]: value };
          if (!value.trim()) delete newState[question];
          return newState;
      });
  };

  const pendingCount = Object.keys(pendingAnswers).length;
  const safeClarifications = Array.isArray(clarifications) ? clarifications : [];

  return (
    <div className="bg-ai-dark rounded-2xl h-full flex flex-col relative overflow-hidden group border border-ai-border/30">
      
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-ai-accent/30 border-t-ai-accent animate-spin"></div>
                <ThinkingProcess prompt={prompt} />
            </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
        {safeClarifications.length === 0 && !isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-ai-card border border-ai-border flex items-center justify-center opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium text-gray-400">任务分析专家</p>
                    <p className="text-xs text-gray-600 mt-2 max-w-[240px] leading-relaxed">
                        我不会立即执行模糊的指令。<br/>
                        点击“深度分析”，我将识别您意图中的缺失要素，并主动追问以确保高质量输出。
                    </p>
                </div>
            </div>
        ) : (
            safeClarifications.map((item, index) => (
                <div key={index} className="bg-ai-card border border-ai-border rounded-xl overflow-hidden animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="p-4 bg-gradient-to-r from-ai-accent/5 to-transparent border-b border-white/5">
                        <div className="flex gap-3">
                            <span className="flex-shrink-0 w-5 h-5 bg-ai-accent rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-ai-accent/20">Q{index + 1}</span>
                            <p className="font-bold text-gray-200 text-sm leading-relaxed">{item.question}</p>
                        </div>
                    </div>
                    
                    <div className="p-4 space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {(item.options || []).map(option => (
                                <button
                                    key={option}
                                    onClick={() => handleSelectOption(item.question, option)}
                                    className={`text-xs py-2 px-3 rounded-lg border transition-all active:scale-95 text-left ${
                                        pendingAnswers[item.question] === option
                                            ? 'bg-ai-accent border-ai-accent text-white shadow-md'
                                            : 'bg-white/5 border-white/5 text-gray-400 hover:border-ai-accent/30 hover:bg-white/10 hover:text-gray-200'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                        
                        <div className="relative">
                            <input
                                type="text"
                                value={pendingAnswers[item.question] && !(item.options || []).includes(pendingAnswers[item.question]) ? pendingAnswers[item.question] : ''}
                                onChange={(e) => handleCustomAnswerChange(item.question, e.target.value)}
                                placeholder="提供其他信息..."
                                className="w-full text-xs bg-black/20 border border-white/10 rounded-lg px-3 py-2 pl-8 focus:ring-1 focus:ring-ai-accent/50 outline-none text-gray-300 placeholder-gray-600 transition-all"
                            />
                            <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>

      <div className="p-4 bg-black/40 border-t border-white/5 backdrop-blur-xl flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
            <button 
                onClick={onRefresh}
                disabled={isLoading || isApplying}
                className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 hover:text-ai-accent transition-colors disabled:opacity-30 uppercase tracking-widest"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                重新分析
            </button>
            <div className="text-[10px] text-ai-accent font-bold">
                {pendingCount > 0 ? `已补充 ${pendingCount} 项信息` : ''}
            </div>
        </div>

        <button 
            onClick={onApply}
            disabled={isLoading || isApplying || pendingCount === 0}
            className={`w-full py-3 rounded-xl font-bold text-xs tracking-widest uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                pendingCount > 0 
                ? 'bg-ai-accent hover:bg-ai-accent-hover text-white shadow-ai-accent/20 active:scale-[0.98]' 
                : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
            }`}
        >
            {isApplying ? (
                <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    正在完善指令...
                </>
            ) : (
                <>
                    <span>信息完整，开始执行</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </>
            )}
        </button>
      </div>
    </div>
  );
};

export default ClarificationCard;
