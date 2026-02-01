/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState, useEffect } from 'react';

interface CanvasWorkspaceProps {
  children: React.ReactNode;
  onSelectionEnd?: (rect: { x: number, y: number, width: number, height: number }) => void;
  onBackgroundClick?: () => void;
}

const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({ children, onSelectionEnd, onBackgroundClick }) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, curX: number, curY: number } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSensitivity = 0.0015;
    const delta = -e.deltaY * zoomSensitivity;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const canvasX = (mouseX - transform.x) / transform.k;
    const canvasY = (mouseY - transform.y) / transform.k;
    const newScale = Math.min(Math.max(0.05, transform.k * Math.exp(delta)), 10);
    const newX = mouseX - canvasX * newScale;
    const newY = mouseY - canvasY * newScale;

    setTransform({ x: newX, y: newY, k: newScale });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const isMiddleClick = e.button === 1;
    const isBackground = e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-bg');

    if (isMiddleClick || (isBackground && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      lastPos.current = { x: e.clientX, y: e.clientY };
      containerRef.current?.setPointerCapture(e.pointerId);
    } else if (isBackground && e.button === 0) {
      // Left click on background - Selection or Deselect
      onBackgroundClick?.();
      setIsSelecting(true);
      setSelectionBox({ startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY });
      containerRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning && lastPos.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    } else if (isSelecting && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, curX: e.clientX, curY: e.clientY } : null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isSelecting && selectionBox) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && onSelectionEnd) {
        // Convert screen coords to canvas internal coords for marquee math
        const x1 = (Math.min(selectionBox.startX, selectionBox.curX) - rect.left - transform.x) / transform.k;
        const y1 = (Math.min(selectionBox.startY, selectionBox.curY) - rect.top - transform.y) / transform.k;
        const x2 = (Math.max(selectionBox.startX, selectionBox.curX) - rect.left - transform.x) / transform.k;
        const y2 = (Math.max(selectionBox.startY, selectionBox.curY) - rect.top - transform.y) / transform.k;
        
        if (Math.abs(x2 - x1) > 5 && Math.abs(y2 - y1) > 5) {
          onSelectionEnd({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
        }
      }
    }

    setIsPanning(false);
    setIsSelecting(false);
    setSelectionBox(null);
    lastPos.current = null;
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-ai-dark relative touch-none canvas-bg select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    >
      {/* Background Gradient */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900/20 via-ai-dark to-ai-dark" />
      
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: `${40 * transform.k}px ${40 * transform.k}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
      />
      {/* Dots for extra texture */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: `${40 * transform.k}px ${40 * transform.k}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
      />

      <div 
        className="absolute inset-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          cursor: isPanning ? 'grabbing' : isSelecting ? 'crosshair' : 'default'
        }}
      >
        {children}
      </div>

      {/* Marquee UI */}
      {isSelecting && selectionBox && (
        <div 
          className="fixed pointer-events-none border border-ai-accent bg-ai-accent/10 z-[1000] rounded-lg backdrop-blur-[1px]"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.curX),
            top: Math.min(selectionBox.startY, selectionBox.curY),
            width: Math.abs(selectionBox.curX - selectionBox.startX),
            height: Math.abs(selectionBox.curY - selectionBox.startY)
          }}
        />
      )}

      {/* UI Controls */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-3 z-[100]">
        <div className="glass-panel rounded-2xl p-2 flex flex-col gap-2 shadow-2xl">
            <button onClick={() => setTransform(t => ({ ...t, k: Math.min(10, t.k * 1.2) }))} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"><svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg></button>
            <button onClick={() => setTransform({ x: 100, y: 100, k: 0.8 })} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-xl text-xs font-bold transition-all">1:1</button>
            <button onClick={() => setTransform(t => ({ ...t, k: Math.max(0.05, t.k / 1.2) }))} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"><svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
        </div>
      </div>
      
      <div className="absolute top-20 right-8 pointer-events-none opacity-30 text-[10px] text-gray-500 font-mono flex flex-col items-end gap-1 select-none">
          <div>[Alt + Left] or [Middle] to Pan</div>
          <div>[Drag] to Select</div>
          <div>[Wheel] to Zoom</div>
      </div>
    </div>
  );
};

export default CanvasWorkspace;