
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { AlignLeftIcon, AlignTopIcon, GridIcon, HandDrawnNodes, TrashIcon } from './icons';

interface BatchActionBarProps {
    selectedCount: number;
    onAction: (action: 'align-left' | 'align-top' | 'distribute-grid' | 'group' | 'delete') => void;
}

const BatchActionBar: React.FC<BatchActionBarProps> = ({ selectedCount, onAction }) => {
    if (selectedCount < 2) return null;

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="bg-ai-card/80 backdrop-blur-xl border border-ai-border/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center p-2 gap-2">
                <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-white/10 flex items-center gap-2">
                    <span className="bg-ai-accent text-white rounded-full w-5 h-5 flex items-center justify-center">{selectedCount}</span>
                    <span>选中</span>
                </div>

                <div className="flex items-center gap-1">
                    <button onClick={() => onAction('align-left')} className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="左对齐">
                        <AlignLeftIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onAction('align-top')} className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="顶对齐">
                        <AlignTopIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onAction('distribute-grid')} className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="网格排列">
                        <GridIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="w-px h-8 bg-white/10 mx-1"></div>

                <button 
                    onClick={() => onAction('group')} 
                    className="flex items-center gap-2 px-4 py-2 bg-ai-accent hover:bg-ai-accent-hover text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wider shadow-lg shadow-ai-accent/20"
                >
                    <HandDrawnNodes className="w-4 h-4" />
                    <span>成组</span>
                </button>

                <div className="w-px h-8 bg-white/10 mx-1"></div>

                <button 
                    onClick={() => onAction('delete')} 
                    className="p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
                    title="删除"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default BatchActionBar;
