
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, GenerateImagesResponse, Modality, Type } from "@google/genai";
import { BeliefState, Clarification, Relationship, Candidate, GraphUpdate, Entity, Attribute } from '../types';

export type StatusUpdateCallback = (message: string) => void;

// Helper to retrieve API Key dynamically
// Priority: Local Storage (User Input) -> Environment Variable
const getApiKey = (): string => {
    const cachedKey = localStorage.getItem('gemini_api_key');
    if (cachedKey && cachedKey.trim().length > 0) {
        return cachedKey.trim();
    }
    return process.env.API_KEY || "";
};

// Helper to get an authenticated AI client instance
const getGenAI = (): GoogleGenAI => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("未找到 API 密钥。请点击左下角“管理 API 密钥”进行配置，或检查环境变量。");
    }
    return new GoogleGenAI({ apiKey });
};

const isRetryableError = (error: any): boolean => {
  const errorMessage = typeof error?.message === 'string' ? error.message : JSON.stringify(error);
  return (
    errorMessage.includes('"code":503') || 
    errorMessage.includes('"status":"UNAVAILABLE"') ||
    errorMessage.includes('"code":500') ||
    errorMessage.includes('"status":"UNKNOWN"') ||
    errorMessage.includes('Rpc failed') ||
    errorMessage.includes('xhr error') ||
    errorMessage.includes('502') || 
    errorMessage.includes('Bad Gateway') ||
    errorMessage.includes('504') ||
    errorMessage.includes('Gateway Timeout') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('"code":429') ||
    errorMessage.includes('429') ||
    errorMessage.includes('"status":"RESOURCE_EXHAUSTED"')
  );
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelay = 1500, // Increased initial delay
  onStatusUpdate?: StatusUpdateCallback,
  actionName: string = "Request"
): Promise<T> => {
  let lastError: any;
  let currentDelay = initialDelay;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || JSON.stringify(error);
      
      // Check for specific quota exhaustion
      if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("429")) {
        const quotaMsg = `${actionName} 触发了 API 频率限制。正在尝试避让...`;
        if (onStatusUpdate) onStatusUpdate(quotaMsg);
        
        // If it's the last attempt, throw a more user-friendly error
        if (i === retries - 1) {
            throw new Error("API 配额暂时耗尽，请稍后再试或检查您的 Google AI Studio 计划。");
        }
        
        await delay(currentDelay);
        currentDelay = currentDelay * 2.5 + Math.floor(Math.random() * 1000); // More aggressive backoff for 429s
        continue;
      }

      if (isRetryableError(error)) {
        const msg = `${actionName} 期间连接不稳定。正在重试 (${i + 1}/${retries})...`;
        console.warn(msg);
        if (onStatusUpdate) onStatusUpdate(msg);
        await delay(currentDelay);
        currentDelay = currentDelay * 2 + Math.floor(Math.random() * 1000);
      } else {
        throw error;
      }
    }
  }
  throw lastError;
};

export const parsePromptToBeliefGraph = async (prompt: string, mode: 'image' | 'story' | 'video' | 'image-to-image', onStatusUpdate?: StatusUpdateCallback): Promise<BeliefState> => {
    let specificInstructions = "";
    if (mode === 'image' || mode === 'image-to-image') {
        specificInstructions = `
        - **图片实体:** 包含名为 "图片" 的实体。必需属性: 天气, 地点, 时间, 氛围, 镜头角度, 风格。
        - **人物主体:** 如果是人类，包含: 年龄, 性别, 种族, 发型, 服装, 表情, 姿势。
        - **物体:** 包含: 颜色, 材质, 形状, 尺寸, 纹理, 光照。`;
    } else if (mode === 'video') {
         specificInstructions = `
        - **视频实体:** 包含名为 "视频" 的实体。必需属性: 运镜, 光照, 氛围, 视频风格, 节奏, 时长感。
        - **主体:** 如果活动，包含: 动作, 表情, 动作速度, 服装。
        - **场景:** 包含: 地点, 天气, 时间, 环境音效。`;
    } else {
        specificInstructions = `
        - **故事实体:** 包含名为 "故事" 的实体。必需属性: 流派, 基调, 叙事视角, 节奏, 核心冲突。
        - **角色:** 包含: 性格, 动机, 角色定位, 年龄, 背景, 情绪状态。`;
    }

    const generationPrompt = `
    分析提示词并生成完整信念图。中文输出。唯独 'existence' 属性名保持英文。
    实体类型: 显式和隐式(2-3个)。
    属性规则: 1. 每个实体必须有 'existence' (true/false)。 2. 3-4个描述性属性: ${specificInstructions} 3. 2-3个候选值。 4. 推断非显式属性并设 presence_in_prompt 为 false。
    关系: 实体间的逻辑关系，标签和替代项。
    输入: { "prompt": "${prompt}" }
    输出 JSON:`;

    const attributeSchema = { type: Type.OBJECT, properties: { name: { type: Type.STRING }, presence_in_prompt: { type: Type.BOOLEAN }, value: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['name', 'presence_in_prompt', 'value'] };
    const entitySchema = { type: Type.OBJECT, properties: { name: { type: Type.STRING }, presence_in_prompt: { type: Type.BOOLEAN }, description: { type: Type.STRING }, alternatives: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true }, attributes: { type: Type.ARRAY, items: attributeSchema } }, required: ['name', 'presence_in_prompt', 'description', 'attributes'] };
    const relationshipSchema = { type: Type.OBJECT, properties: { source: { type: Type.STRING }, target: { type: Type.STRING }, label: { type: Type.STRING }, alternatives: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true } }, required: ['source', 'target', 'label'] };

    try {
        const ai = getGenAI();
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Upgraded for better stability
            contents: generationPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        entities: { type: Type.ARRAY, items: entitySchema },
                        relationships: { type: Type.ARRAY, items: relationshipSchema }
                    },
                    required: ['entities', 'relationships']
                }
            }
        }), 4, 2000, onStatusUpdate, "Belief Graph Generation");

        const rawGraph = JSON.parse(response.text);
        const entities = rawGraph.entities.map((e: any) => ({
            ...e,
            alternatives: e.alternatives ? e.alternatives.map((s: string) => ({ name: s })) : [],
            attributes: e.attributes.map((a: any) => ({
                ...a,
                value: a.value.map((s: string) => ({ name: s }))
            }))
        }));
        const relationships = rawGraph.relationships.map((r: any) => ({
            ...r,
            alternatives: r.alternatives ? r.alternatives.map((s: string) => ({ name: s })) : []
        }));
        return { entities, relationships, prompt };
    } catch (error) {
        console.error("Error generating belief graph:", error);
        throw error; // Propagate error so UI can show it
    }
};

export const generateClarifications = async (prompt: string, askedQuestions: string[], mode: 'image' | 'story' | 'video' | 'image-to-image', onStatusUpdate?: StatusUpdateCallback): Promise<Clarification[]> => {
    let specificPrompt = `你是一位文生图提示词专家。目标是通过澄清性问题完善提示词。`;
    if (mode === 'story') specificPrompt = `你是一位创意写作助手。目标是通过澄清性问题发展故事构思。`;
    if (mode === 'video') specificPrompt = `你是一位 AI 视频生成专家。目标是通过澄清性问题识别动作和镜头。`;

    const finalPrompt = specificPrompt + `
1. 生成 3 个问题。 2. 简洁直接。 3. 3-5个中文答案选项。 4. 避免重复: ${askedQuestions.join(', ') || '无'}
用户提示词: "${prompt}"
以 JSON 数组形式返回。`;

    try {
        const ai = getGenAI();
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Upgraded for better stability
            contents: finalPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ['question', 'options'],
                    },
                },
            },
        }), 4, 2000, onStatusUpdate, "Clarification Generation"); 
        return JSON.parse(response.text) as Clarification[];
    } catch (error) {
        console.error("Error generating clarifications:", error);
        throw error; // Propagate error
    }
};

export const refinePromptWithAllUpdates = async (
    originalPrompt: string,
    clarifications: { question: string; answer: string }[],
    graphUpdates: GraphUpdate[],
    onStatusUpdate?: StatusUpdateCallback
  ): Promise<string> => {
    let updatesPromptSection = "";
    if (graphUpdates.length > 0) {
        updatesPromptSection += `\n编辑:\n${graphUpdates.map(u => u.type === 'attribute' ? `- ${u.entity}: ${u.attribute}=${u.value}` : `- ${u.source}->${u.target}: ${u.newLabel}`).join('\n')}\n`;
    }
    if (clarifications.length > 0) {
        updatesPromptSection += `\n回答:\n${clarifications.map(c => `- ${c.question}: ${c.answer}`).join('\n')}\n`;
    }
  
    const prompt = `提示词专家。重写提示词融入更新并保留现有细节。
  原始: "${originalPrompt}"
  ${updatesPromptSection}
  说明: 整合属性、更新关系、融入回答。若 existence 为 false 则删除该实体。不要总结，要补全。只返回字符串。`;
  
    try {
      const ai = getGenAI();
      const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      }), 3, 1000, onStatusUpdate, "Prompt Refinement");
      return response.text;
    } catch (error) {
      return originalPrompt;
    }
  };

/**
 * Maps style internal IDs to actual prompt modifiers.
 */
const STYLE_PROMPT_MAP: Record<string, string> = {
  'realistic': 'realistic, highly detailed, photorealistic photograph, 8k resolution',
  'illustration': 'digital illustration, clean lines, artistic composition, stylized',
  '3d': '3d render, octane render, unreal engine 5, cinematic lighting, masterpiece',
  'anime': 'anime style, vibrant colors, expressive character, high quality anime art',
  'oil': 'oil painting, textured brushstrokes, classical fine art style, masterpiece',
  'cyberpunk': 'cyberpunk style, neon lights, high tech, futuristic, moody atmosphere',
};

export const generateImagesFromPrompt = async (
    prompt: string, 
    aspectRatio: string, 
    referenceImages: string[] = [], 
    numImages: number = 4, 
    style: string = 'none',
    imageSize: '1K' | '2K' | '4K' = '1K',
    onStatusUpdate?: StatusUpdateCallback
): Promise<string[]> => {
    
    const styleModifier = STYLE_PROMPT_MAP[style] || '';
    const finalPrompt = styleModifier ? `${styleModifier}. ${prompt}` : prompt;

    // Determine model based on quality/size
    const useProModel = imageSize === '2K' || imageSize === '4K';
    const modelName = useProModel ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

    const generateOne = async (): Promise<string | null> => {
        try {
            const parts: any[] = [];
            referenceImages.forEach(img => {
                 const matches = img.match(/^data:(.+);base64,(.+)$/);
                 if (matches) {
                    parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
                 }
            });
            parts.push({ text: finalPrompt });

            // Ensure we have a client instance
            const currentAi = getGenAI();

            const config: any = { 
                imageConfig: { 
                    aspectRatio: aspectRatio 
                } 
            };
            
            if (useProModel) {
                config.imageConfig.imageSize = imageSize;
            }

            const response = await withRetry<GenerateContentResponse>(() => currentAi.models.generateContent({
                model: modelName,
                contents: { parts: parts },
                config: config
            }), 3, 2000, onStatusUpdate, "Image Generation");
            
            if (!response.candidates?.[0]?.content?.parts) return null;

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
            return null;
        } catch (err: any) {
            // Propagate the API key error explicitly or Log
            console.error(err);
            return null;
        }
    };

    let images: string[] = [];
    let attempts = 0;
    
    // Attempt generation
    while (images.length < numImages && attempts < 2) {
        const needed = numImages - images.length;
        const results = await Promise.all(Array(needed).fill(null).map(() => generateOne()));
        images = [...images, ...results.filter((img): img is string => img !== null)];
        attempts++;
    }
    
    if (images.length === 0) throw new Error("图片生成失败。请检查 API Key 配额或网络连接。");
    return images;
};

export const generateVideosFromPrompt = async (prompt: string, aspectRatio: string, resolution: '720p' | '1080p', onStatusUpdate?: StatusUpdateCallback): Promise<string> => {
    let targetRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
    try {
        const freshAi = getGenAI();
        let operation = await freshAi.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: { numberOfVideos: 1, resolution: resolution, aspectRatio: targetRatio }
        });
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await freshAi.operations.getVideosOperation({operation: operation});
        }
        if (operation.error) throw new Error(`失败: ${operation.error.message}`);
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        
        // Append API Key manually for the fetch request
        const apiKey = getApiKey();
        const response = await fetch(`${videoUri}&key=${apiKey}`);
        
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error: any) {
        if (error.message.includes("Requested entity was not found") || error.message.includes("请选择 API 密钥")) {
            throw new Error("视频生成需要有效的 API 密钥。");
        }
        throw error;
    }
};

export const generateStoryFromPrompt = async (prompt: string, onStatusUpdate?: StatusUpdateCallback): Promise<string> => {
    try {
        const ai = getGenAI();
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `基于想法写个短篇故事: "${prompt}"`,
            config: { temperature: 0.8 }
        }), 3, 1000, onStatusUpdate, "Story Generation");
        return response.text;
    } catch (error) {
        throw error;
    }
};
