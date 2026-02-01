/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useLayoutEffect } from 'react';
import { PlusIcon } from './icons';

interface DraggableNodeProps {
  id: string;
  initialX: number;
  initialY: number;
  width?: string;
  height?: string;
  title: string;
  tooltip?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  rightAction?: React.ReactNode;
  leftAction?: React.ReactNode;
  isSelected?: boolean;
  onSelect?: (id: string, multi: boolean) => void;
  onPositionChange?: (id: string, x: number, y: number) => void;
  onAddNext?: (e: React.MouseEvent) => void;
  onAddPrev?: (e: React.MouseEvent) => void;
  staticNode?: boolean; 
  hideHeader?: boolean; 
  isLocked?: boolean;
}

const DraggableNode: React.FC<DraggableNodeProps> = ({ 
  id,
  initialX, 
  initialY, 
  width = "w-96", 
  height = "h-auto", 
  title, 
  tooltip,
  icon,
  children,
  className = "",
  onClose,
  rightAction,
  leftAction,
  isSelected = false,
  onSelect,
  onPositionChange,
  onAddNext,
  onAddPrev,
  staticNode = false,
  hideHeader = false,
  isLocked = false
}) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const nodeRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ 
    pointerX: number; 
    pointerY: number; 
    nodeX: number; 
    nodeY: number;
    scale: number;
  } | null>(null);
  
  const currentPosRef = useRef({ x: initialX, y: initialY });

  useLayoutEffect(() => {
    if (!isDragging) {
        setPosition({ x: initialX, y: initialY });
        currentPosRef.current = { x: initialX, y: initialY };
        if (nodeRef.current) {
            nodeRef.current.style.transform = `translate3d(${initialX}px, ${initialY}px, 0)`;
        }
    }
  }, [initialX, initialY, isDragging]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect?.(id, e.shiftKey || e.ctrlKey || e.metaKey);
    if (staticNode || isLocked) return;

    const target = e.target as HTMLElement;
    const isHeader = target.closest('.node-header');
    const isContentDrag = hideHeader && !target.closest('button') && !target.closest('input') && !target.closest('textarea') && !target.closest('a');

    if (isHeader || isContentDrag) {
      e.currentTarget.setPointerCapture(e.pointerId);
      
      const canvasElement = e.currentTarget.closest('.origin-top-left') as HTMLElement;
      let scale = 1;
      if (canvasElement) {
         const style = window.getComputedStyle(canvasElement);
         const transform = style.transform;
         if (transform && transform !== 'none') {
             const match = transform.match(/matrix\((.+)\)/);
             if (match) {
                 scale = parseFloat(match[1].split(', ')[0]);
             }
         }
      }

      setIsDragging(true);
      setShowTooltip(false);
      
      dragStartRef.current = { 
          pointerX: e.clientX, 
          pointerY: e.clientY,
          nodeX: currentPosRef.current.x,
          nodeY: currentPosRef.current.y,
          scale 
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (staticNode || isLocked || !isDragging || !dragStartRef.current || !nodeRef.current) return;
    
    e.stopPropagation();
    e.preventDefault();

    const { pointerX, pointerY, nodeX, nodeY, scale } = dragStartRef.current;
    const dx = (e.clientX - pointerX) / scale;
    const dy = (e.clientY - pointerY) / scale;
    const newX = nodeX + dx;
    const newY = nodeY + dy;

    nodeRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
    currentPosRef.current = { x: newX, y: newY };
    onPositionChange?.(id, newX, newY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
      setPosition(currentPosRef.current);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      ref={nodeRef}
      data-node-id={id}
      className={`absolute flex flex-col glass-panel rounded-3xl group/node will-change-transform touch-none transition-shadow duration-200 ${
        isSelected 
          ? 'ring-1 ring-ai-accent border-ai-accent/50 shadow-glow' 
          : 'border-white/5 hover:border-white/10 shadow-2xl'
      } ${isDragging ? 'z-50 cursor-grabbing shadow-glow-lg transition-none' : 'z-auto'} ${width} ${height} ${className}`}
      style={{ 
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {!hideHeader && (
        <div 
            className={`node-header p-3.5 flex items-center gap-3 select-none relative rounded-t-3xl border-b border-white/5 ${
                staticNode || isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
            }`}
            onMouseEnter={() => !isDragging && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div className={`p-1.5 rounded-lg transition-colors ${isSelected ? "text-white bg-ai-accent" : "text-gray-400 bg-white/5"}`}>
                {icon || <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-ai-accent'}`} />}
            </div>
            <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 truncate pr-2 ${isSelected ? 'text-white' : 'text-gray-400 group-hover/node:text-gray-300'} transition-colors`}>{title}</h3>
            
            {isLocked && (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
               </svg>
            )}

            {tooltip && showTooltip && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max max-w-[240px] px-3 py-2 glass-panel-heavy rounded-xl shadow-xl z-[100] animate-slide-up pointer-events-none">
                <p className="text-[10px] leading-relaxed text-gray-300 font-medium">{tooltip}</p>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-[6px] border-transparent border-t-zinc-900"></div>
            </div>
            )}

            {onClose && !isLocked && (
                <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-gray-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5 opacity-0 group-hover/node:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
            )}
        </div>
      )}

      {hideHeader && isLocked && (
          <div className="absolute top-2 right-2 z-30 bg-black/50 rounded-full p-1.5 pointer-events-none">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white/50" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
               </svg>
          </div>
      )}

      <div className={`flex-1 min-h-0 relative ${hideHeader ? 'rounded-3xl' : 'rounded-b-3xl'} overflow-hidden`}>
        {children}
      </div>

      {leftAction && !hideHeader && <div className="absolute top-1/2 -left-3 transform -translate-y-1/2 -translate-x-1/2 z-20">{leftAction}</div>}
      {rightAction && !hideHeader && <div className="absolute top-1/2 -right-3 transform -translate-y-1/2 translate-x-1/2 z-20">{rightAction}</div>}

      {onAddPrev && !hideHeader && !isLocked && (
        <button 
          onClick={(e) => { e.stopPropagation(); onAddPrev(e); }}
          className="absolute top-1/2 -left-3 transform -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-ai-card border border-ai-border hover:border-ai-accent text-gray-400 hover:text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 z-30 opacity-0 group-hover/node:opacity-100"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </button>
      )}
      {onAddNext && !hideHeader && !isLocked && (
        <button 
          onClick={(e) => { e.stopPropagation(); onAddNext(e); }}
          className="absolute top-1/2 -right-3 transform -translate-y-1/2 translate-x-1/2 w-6 h-6 bg-ai-card border border-ai-border hover:border-ai-accent text-gray-400 hover:text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 z-30 opacity-0 group-hover/node:opacity-100"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default DraggableNode;