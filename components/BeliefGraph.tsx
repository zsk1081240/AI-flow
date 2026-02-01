
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { BeliefState, Entity, Attribute, Relationship, Candidate, GraphUpdate, EntityStyle, RelationshipStyle, GraphStyles, Mode } from '../types';

interface BeliefGraphProps {
  data: BeliefState | null;
  isLoading: boolean;
  mode: Mode;
  view: 'graph' | 'attributes';
  isVisible?: boolean;
  pendingAttributeUpdates: Record<string, string>;
  setPendingAttributeUpdates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pendingRelationshipUpdates: Record<string, string>;
  setPendingRelationshipUpdates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pendingClarificationCount: number;
  currentPrompt: string;
  onAddEntity?: (name: string) => void;
}

const getHighestProbabilityValue = (attribute: Attribute): string => {
    if (!attribute.value || attribute.value.length === 0) return 'Unknown';
    return attribute.value[0].name;
};

const ThinkingProcess = ({ prompt }: { prompt: string }) => {
    const [step, setStep] = useState(0);

    const steps = useMemo(() => {
        const cleanPrompt = prompt.toLowerCase().replace(/[^\w\s]/g, '');
        const words = cleanPrompt.split(/\s+/).filter(w => w.length > 0);
        
        const hasHuman = words.some(w => ['man', 'woman', 'boy', 'girl', 'person', 'people', 'child', 'kid', 'guy', 'lady', 'friends', 'family', 'couple'].includes(w));
        const hasAction = words.some(w => w.endsWith('ing')); 
        
        const stopWords = ['about', 'after', 'before', 'their', 'where', 'which', 'there', 'could', 'would', 'with', 'from', 'that', 'this', 'some', 'what'];
        const significantWord = words.find(w => w.length > 3 && !stopWords.includes(w)) || 'entities';
        const truncatedKeyword = significantWord.length > 10 ? significantWord.substring(0, 9) + '...' : significantWord;

        const generatedSteps = [
            "正在解析提示词语法...",
            `正在识别关键概念 '${truncatedKeyword}'...`,
        ];

        if (hasHuman) {
            generatedSteps.push("正在分析姿势和表情...");
        } else {
            generatedSteps.push("正在分析对象属性...");
        }

        generatedSteps.push("正在推断隐含环境...");
        
        if (hasAction) {
            generatedSteps.push("正在映射交互动态...");
        }

        return generatedSteps;
    }, [prompt]);

    useEffect(() => {
        const interval = setInterval(() => {
            setStep((s) => (s + 1) % steps.length);
        }, 2200);
        return () => clearInterval(interval);
    }, [steps]);

    return (
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300 animate-pulse min-w-[240px] text-center transition-all duration-300">
            {steps[step]}
        </span>
    );
};

const EmptyStatePlaceholder = ({ text }: { text: string }) => (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-8 max-w-lg w-full shadow-sm mx-auto my-auto">
        <p className="text-sm font-medium">{text}</p>
    </div>
);

const AttributeEditor: React.FC<any> = ({ attribute, entity, onChange, isLoading, pendingValue }) => {
    const isExistence = attribute.name === 'existence' || attribute.name === 'existence_in_image';
    let currentValue = pendingValue !== undefined ? pendingValue : (attribute.presence_in_prompt ? getHighestProbabilityValue(attribute) : 'Unknown');
    if (isExistence && currentValue === 'Unknown') currentValue = 'true';
    
    // Guard against undefined values
    const options = Array.isArray(attribute.value) ? attribute.value : [];

    return (
        <div className="flex justify-between items-center py-2 border-b border-white/5">
             <label className="text-xs text-gray-400">{attribute.name}</label>
             <select 
                value={currentValue}
                onChange={(e) => onChange(entity.name, attribute.name, e.target.value)}
                className="bg-black/20 text-xs text-gray-200 rounded px-2 py-1 border border-white/10 outline-none max-w-[120px]"
             >
                 {options.map((v: any) => <option key={v.name} value={v.name}>{v.name}</option>)}
             </select>
        </div>
    )
};


interface Node {
    id: string;
    width: number;
    height: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

const BeliefGraph: React.FC<BeliefGraphProps> = ({ 
    data, isLoading, mode, view, pendingAttributeUpdates, setPendingAttributeUpdates, 
    pendingRelationshipUpdates, setPendingRelationshipUpdates, currentPrompt
}) => {
  const [nodePositions, setNodePositions] = useState<{[key: string]: {x: number, y: number}}>({});
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Animation State
  const simulationRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<any[]>([]);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      const resizeObserver = new ResizeObserver((entries) => {
          for (let entry of entries) {
               setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
          }
      });
      resizeObserver.observe(node);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Filter entities
  const sceneEntityNames = ['image', 'the image', 'story', 'the story', 'video', 'the video'];
  const objectEntities = useMemo(() => data?.entities.filter(e => !sceneEntityNames.includes(e.name.toLowerCase())) || [], [data]);
  
  // Initialize Simulation
  useEffect(() => {
    if (!data || objectEntities.length === 0 || dimensions.width === 0) return;

    // Initialize nodes
    const existingNodes = new Map(nodesRef.current.map(n => [n.id, n]));
    const newNodes: Node[] = objectEntities.map((entity, i) => {
        const existing = existingNodes.get(entity.name);
        if (existing) return existing;
        const angle = (i / objectEntities.length) * 2 * Math.PI;
        const radius = Math.min(dimensions.width, dimensions.height) * 0.2;
        return {
            id: entity.name,
            width: 100, // Approx width
            height: 40,
            x: dimensions.width / 2 + radius * Math.cos(angle),
            y: dimensions.height / 2 + radius * Math.sin(angle),
            vx: 0,
            vy: 0
        };
    });
    nodesRef.current = newNodes;

    // Initialize links
    const nodeMap = new Map(newNodes.map(n => [n.id, n]));
    linksRef.current = (data.relationships || [])
        .filter(r => nodeMap.has(r.source) && nodeMap.has(r.target))
        .map(r => ({
            source: nodeMap.get(r.source)!,
            target: nodeMap.get(r.target)!,
            label: r.label
        }));

    // Start Animation Loop
    let alpha = 1;
    const tick = () => {
        if (alpha < 0.01) return; // Stop simulation when settled

        const nodes = nodesRef.current;
        const links = linksRef.current;
        const width = dimensions.width;
        const height = dimensions.height;
        const center = { x: width / 2, y: height / 2 };

        // Forces
        const k = Math.sqrt(width * height / (nodes.length + 1)); // Optimal distance
        const repulsion = 2000;
        
        // 1. Repulsion
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i];
                const b = nodes[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                let d2 = dx * dx + dy * dy;
                if (d2 === 0) { d2 = 0.1; } // prevent div by zero
                const d = Math.sqrt(d2);
                const force = repulsion / d2;
                const fx = (dx / d) * force;
                const fy = (dy / d) * force;
                a.vx += fx; a.vy += fy;
                b.vx -= fx; b.vy -= fy;
            }
        }

        // 2. Attraction (Springs)
        links.forEach(link => {
            const dx = link.target.x - link.source.x;
            const dy = link.target.y - link.source.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d === 0) return;
            const force = (d - k) * 0.05; // Spring constant
            const fx = (dx / d) * force;
            const fy = (dy / d) * force;
            link.source.vx += fx; link.source.vy += fy;
            link.target.vx -= fx; link.target.vy -= fy;
        });

        // 3. Center Gravity
        nodes.forEach(n => {
            n.vx += (center.x - n.x) * 0.01;
            n.vy += (center.y - n.y) * 0.01;
        });

        // Update positions
        let maxV = 0;
        nodes.forEach(n => {
            n.vx *= 0.6; // Friction
            n.vy *= 0.6;
            n.x += n.vx * alpha;
            n.y += n.vy * alpha;
            const v = Math.sqrt(n.vx*n.vx + n.vy*n.vy);
            if(v > maxV) maxV = v;

            // Bounds
            n.x = Math.max(50, Math.min(width - 50, n.x));
            n.y = Math.max(20, Math.min(height - 20, n.y));
        });

        alpha *= 0.99; // Decay
        if (maxV > 0.1) {
            // Only update react state if moving significantly to allow smooth 60fps
            // We can also just update every frame if node count is low (which it is)
            setNodePositions(nodes.reduce((acc, n) => ({ ...acc, [n.id]: {x: n.x, y: n.y} }), {}));
            simulationRef.current = requestAnimationFrame(tick);
        }
    };

    if (simulationRef.current) cancelAnimationFrame(simulationRef.current);
    simulationRef.current = requestAnimationFrame(tick);

    return () => {
        if (simulationRef.current) cancelAnimationFrame(simulationRef.current);
    };
  }, [data, objectEntities, dimensions]); // Re-run when data changes

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 w-full h-full flex flex-col relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="flex flex-col items-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <ThinkingProcess prompt={currentPrompt} />
            </div>
        </div>
      )}

      <div style={{ display: view === 'attributes' ? 'block' : 'none' }} className="flex-1 overflow-y-auto p-6">
         {/* Simple Attribute List View */}
         {objectEntities.map(e => (
             <div key={e.name} className="mb-6">
                 <h3 className="font-bold text-lg text-gray-200 mb-2 border-b border-gray-700 pb-1">{e.name}</h3>
                 {(e.attributes || []).map(a => (
                    <AttributeEditor 
                        key={`${e.name}-${a.name}`} 
                        attribute={a} 
                        entity={e} 
                        onChange={(en: string, at: string, v: string) => setPendingAttributeUpdates(prev => ({...prev, [`${en}:${at}`]: v}))}
                        pendingValue={pendingAttributeUpdates[`${e.name}:${a.name}`]}
                    />
                 ))}
             </div>
         ))}
      </div>

      <div 
        ref={containerRef}
        style={{ display: view === 'graph' ? 'block' : 'none' }} 
        className="w-full h-full relative"
      >
        {!data && !isLoading && <EmptyStatePlaceholder text="AI 分析后，信念图谱将在此呈现" />}
        
        {/* Render Graph */}
        <svg width="100%" height="100%">
            <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
                </marker>
            </defs>
            {data && linksRef.current.map((link, i) => (
                <g key={i}>
                    <line 
                        x1={nodePositions[link.source.id]?.x || 0} 
                        y1={nodePositions[link.source.id]?.y || 0} 
                        x2={nodePositions[link.target.id]?.x || 0} 
                        y2={nodePositions[link.target.id]?.y || 0} 
                        stroke="#4b5563" 
                        strokeWidth="2" 
                        markerEnd="url(#arrow)"
                    />
                    <text 
                        x={(nodePositions[link.source.id]?.x + nodePositions[link.target.id]?.x) / 2} 
                        y={(nodePositions[link.source.id]?.y + nodePositions[link.target.id]?.y) / 2}
                        fill="#9ca3af"
                        fontSize="10"
                        textAnchor="middle"
                        dy="-4"
                        className="bg-gray-900"
                    >{link.label}</text>
                </g>
            ))}
            {data && objectEntities.map((entity) => {
                const pos = nodePositions[entity.name];
                if (!pos) return null;
                return (
                    <g key={entity.name} transform={`translate(${pos.x}, ${pos.y})`}>
                        <rect x="-50" y="-20" width="100" height="40" rx="20" fill="#1e293b" stroke="#60a5fa" strokeWidth="2" />
                        <text textAnchor="middle" dy="5" fill="white" fontSize="12" fontWeight="bold">{entity.name}</text>
                    </g>
                );
            })}
        </svg>
      </div>
    </div>
  );
};

export default BeliefGraph;
