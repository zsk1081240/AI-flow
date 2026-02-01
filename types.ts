
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Candidate {
  name: string; 
}

export interface Attribute {
  name:string;
  presence_in_prompt: boolean;
  value: Candidate[];
}

export interface Entity {
  name: string;
  presence_in_prompt: boolean;
  description: string;
  alternatives: Candidate[] | null;
  attributes: Attribute[];
}

export interface Relationship {
  source: string;
  target: string;
  label: string;
  alternatives?: Candidate[];
}

export interface BeliefState {
  entities: Entity[];
  relationships: Relationship[];
  prompt?: string;
}

export interface Clarification {
  question: string;
  options: string[];
}

export type GraphUpdate = 
  | { type: 'attribute'; entity: string; attribute: string; value: string }
  | { type: 'relationship'; source: string; target: string; oldLabel: string; newLabel: string };

export interface ImageGenerationItem {
  id: string;
  timestamp: number;
  prompt: string;
  aspectRatio: string;
  images: string[];
  referenceImages?: string[];
  scripts?: Record<number, string>; // Map image index to script text
}

export interface AudioGenerationItem {
  id: string;
  timestamp: number;
  prompt: string;
  audioUrl?: string;
  voice?: string;
  subType: 'speech' | 'music';
  musicScore?: string;
}

export interface TextHistoryItem { 
  id: string; 
  type: 'story' | 'comic' | 'note'; 
  content: string; 
  timestamp: number; 
}

export interface VideoHistoryItem { 
  id: string; 
  url: string; 
  prompt: string; 
  timestamp: number; 
}

export interface GenerationBatch {
  id: string;
  timestamp: number;
  mode: Mode;
  prompt: string;
  isExpanded: boolean;
  items: (ImageGenerationItem | AudioGenerationItem | TextHistoryItem | VideoHistoryItem)[];
}

export interface NodeConnection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface EntityStyle {
  color?: string;
  textColor?: string;
  width?: number;
  height?: number;
}

export interface RelationshipStyle {
  color?: string;
  width?: number;
  dash?: string;
}

export interface GraphStyles {
  entities: Record<string, EntityStyle>;
  relationships: Record<string, RelationshipStyle>;
}

export type Mode = 'image' | 'story' | 'video' | 'image-to-image' | 'video-multiframe' | 'audio' | 'comic' | 'note';

export interface GenerationSettings {
  aspectRatio: string;
  resolution: '720p' | '1080p';
  imageCount: number;
  imageStyle: string;
  imageSize: '1K' | '2K' | '4K';
  negativePrompt: string;
  cameraDetail: string;
  audioVoice: string;
  audioMode: 'speech' | 'music';
  musicStyle: string;
  referenceImages: string[];
}
