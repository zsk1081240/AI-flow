
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Type, VideoGenerationReferenceType } from "@google/genai";
import { BeliefState, Clarification, GraphUpdate, Entity } from '../types';

export type StatusUpdateCallback = (message: string) => void;

const getApiKey = (): string => {
    const cachedKey = localStorage.getItem('gemini_api_key');
    return cachedKey?.trim() || process.env.API_KEY || "";
};

const getBaseUrl = (): string | undefined => {
    const url = localStorage.getItem('gemini_base_url');
    return url?.trim() || undefined;
};

const getGenAI = (): GoogleGenAI => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("未找到 API 密钥。请在侧边栏“设置”中配置。");
    return new GoogleGenAI({ apiKey, baseUrl: getBaseUrl() } as any);
};

// Robust JSON Cleaner and Parser
const cleanAndParseJson = (text: string | undefined, defaultValue: any = {}) => {
    if (!text) return defaultValue;
    try {
        // 1. Remove Markdown code blocks
        let cleaned = text.replace(/```json\n?|```/g, '').trim();

        // 2. Extract JSON object/array if there's extra text around it
        const firstBrace = cleaned.indexOf('{');
        const firstBracket = cleaned.indexOf('[');
        
        let startIndex = -1;
        let endIndex = -1;
        let isArray = false;

        // Determine if we are looking for an object or an array based on which comes first
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            startIndex = firstBrace;
            endIndex = cleaned.lastIndexOf('}');
        } else if (firstBracket !== -1) {
            startIndex = firstBracket;
            endIndex = cleaned.lastIndexOf(']');
            isArray = true;
        }

        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            cleaned = cleaned.substring(startIndex, endIndex + 1);
        }

        // 3. Attempt parse
        return JSON.parse(cleaned);
    } catch (e) {
        console.warn("JSON Parse Warning, falling back to default:", e);
        // Fallback: If it expects an array but got text, maybe try to wrap it?
        // For now, return default to ensure app stability.
        return defaultValue;
    }
};

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelay = 2000, 
  onStatusUpdate?: StatusUpdateCallback,
  actionName: string = "Request"
): Promise<T> => {
  let currentDelay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try { 
        return await fn(); 
    } catch (error: any) {
      const msg = error?.message || "";
      // Don't retry on Auth errors
      if (msg.includes("API key") || msg.includes("403")) throw error;

      if (i === retries - 1) throw error;
      
      const isRateLimit = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
      const logMsg = isRateLimit ? `${actionName} 频率限制，${currentDelay/1000}秒后重试...` : `${actionName} 遇到问题，重试中...`;
      
      onStatusUpdate?.(logMsg);
      await new Promise(r => setTimeout(r, currentDelay));
      currentDelay *= 2; // Exponential backoff
    }
  }
  throw new Error(`${actionName} failed after retries`);
};

export const parsePromptToBeliefGraph = async (prompt: string, mode: string, model: string = 'gemini-3-pro-preview', onStatusUpdate?: StatusUpdateCallback): Promise<BeliefState> => {
    const ai = getGenAI();
    try {
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model,
            contents: `分析提示词并生成信念图。模式: ${mode}。输入: "${prompt}"。
要求：
1. 识别 2-4 个核心实体(Entity)及其关键属性(Attribute)。
2. 识别实体之间的关系(Relationship)。
3. 输出纯 JSON。`,
            config: {
                thinkingConfig: { thinkingBudget: 1024 }, // Lower thinking budget for speed in analysis
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        entities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, presence_in_prompt: { type: Type.BOOLEAN }, attributes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, value: { type: Type.ARRAY, items: { type: Type.STRING } }, presence_in_prompt: { type: Type.BOOLEAN } } } } } } },
                        relationships: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { source: { type: Type.STRING }, target: { type: Type.STRING }, label: { type: Type.STRING } } } }
                    }
                }
            }
        }), 2, 1500, onStatusUpdate, "Graph Analysis");

        const raw = cleanAndParseJson(response.text, { entities: [], relationships: [] });
        
        // Safety checks for undefined arrays
        const rawEntities = Array.isArray(raw.entities) ? raw.entities : [];
        const rawRelationships = Array.isArray(raw.relationships) ? raw.relationships : [];

        return {
            entities: rawEntities.map((e: any) => ({ 
                ...e, 
                attributes: (Array.isArray(e.attributes) ? e.attributes : []).map((a: any) => ({ 
                    ...a, 
                    value: (Array.isArray(a.value) ? a.value : []).map((v: string) => ({ name: v })) 
                })) 
            })),
            relationships: rawRelationships,
            prompt
        };
    } catch (e) {
        console.error("Belief Graph Error:", e);
        // Return empty graph on failure instead of crashing
        return { entities: [], relationships: [], prompt };
    }
};

export const refinePromptWithAllUpdates = async (
    originalPrompt: string,
    clarifications: { question: string; answer: string }[],
    graphUpdates: GraphUpdate[],
    model: string = 'gemini-3-pro-preview',
    onStatusUpdate?: StatusUpdateCallback
  ): Promise<string> => {
    const ai = getGenAI();
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model,
        contents: `你是一位殿堂级 AI 提示词专家。任务：重构提示词。
原始输入: "${originalPrompt}"
变更点: ${JSON.stringify(graphUpdates)}
用户回答: ${JSON.stringify(clarifications)}

要求：
1. 整合所有信息。**将用户回答的澄清信息以中文的形式添加到提示词中**，与其他描述自然融合，确保语义准确。
2. 增加关于光影、构图、材质和氛围的描述（如 Cinematic lighting, 8k resolution）。
3. 仅返回重构后的新提示词文本，**不要**包含任何解释、前缀或Markdown格式。`,
        config: { thinkingConfig: { thinkingBudget: 4096 } }
    }), 2, 1000, onStatusUpdate, "Prompt Refinement");
    
    // Clean up response: remove quotes if the model wrapped the prompt in them
    let text = response.text || '';
    text = text.trim();
    if (text.startsWith('"') && text.endsWith('"')) {
        text = text.slice(1, -1);
    }
    return text;
};

export const generateImagesFromPrompt = async (
    prompt: string, aspectRatio: string, refs: string[], count: number, style: string, size: '1K'|'2K'|'4K', neg: string, cam: string, onStatusUpdate?: StatusUpdateCallback
): Promise<string[]> => {
    // Nano Banana Pro (gemini-3-pro-image-preview) supports 1K, 2K, 4K and googleSearch
    const model = 'gemini-3-pro-image-preview';
    const finalPrompt = `${prompt}${style !== 'none' ? `, style: ${style}` : ''}${neg ? `. Avoid: ${neg}` : ''}${cam ? `. Camera: ${cam}` : ''}`;
    
    // Generate serially or in small batches to avoid rate limits if count is high
    const generateOne = async () => {
        const ai = getGenAI();
        const parts: any[] = refs.map(r => {
            const m = r.match(/^data:(.+);base64,(.+)$/);
            return m ? { inlineData: { mimeType: m[1], data: m[2] } } : null;
        }).filter(Boolean);
        parts.push({ text: finalPrompt });

        const tools = [{ googleSearch: {} }];

        try {
            const res = await ai.models.generateContent({
                model,
                contents: { parts },
                config: { 
                    imageConfig: { aspectRatio, imageSize: size },
                    tools
                }
            });
            
            for (const part of res.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
        } catch (e: any) {
            console.error("Image Gen Error:", e);
            throw e; // Propagate to let caller handle or retry
        }
        return null;
    };

    // Parallel requests but capped
    const results = await Promise.all(Array(count).fill(0).map(() => generateOne()));
    return results.filter((i): i is string => !!i);
};

export const generateClarifications = async (prompt: string, asked: string[], mode: string, model: string = 'gemini-3-pro-preview', onStatusUpdate?: StatusUpdateCallback): Promise<Clarification[]> => {
    const ai = getGenAI();
    try {
        const response = await ai.models.generateContent({
            model,
            contents: `任务：针对提示词 "${prompt}" 生成澄清问题。
    1. 提出 3 个**简短**的问题来明确意图（不要问废话）。
    2. 每个问题提供 4-6 个**简短**的选项。
    3. 输出纯 JSON 数组。
    已忽略问题：${asked.join(',')}`,
            config: {
                thinkingConfig: { thinkingBudget: 2048 },
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } } } } }
            }
        });
        const res = cleanAndParseJson(response.text, []);
        return Array.isArray(res) ? res : [];
    } catch (e) {
        console.error("Clarification Error:", e);
        return [];
    }
};

export const generatePoseSuggestions = async (prompt: string, mode: string, model: string = 'gemini-3-pro-preview'): Promise<any[]> => {
    const ai = getGenAI();
    try {
        const res = await ai.models.generateContent({
            model,
            contents: `创意: "${prompt}"。推荐6个专业角色姿势。输出 JSON。`,
            config: {
                thinkingConfig: { thinkingBudget: 2048 },
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, label: { type: Type.STRING }, prompt: { type: Type.STRING } } } }
            }
        });
        const parsed = cleanAndParseJson(res.text, []);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

export const generateStoryFromPrompt = async (p: string) => {
    try {
        return (await getGenAI().models.generateContent({ model: 'gemini-3-pro-preview', contents: `写个故事: ${p}`, config: { thinkingConfig: { thinkingBudget: 4096 } } })).text || '';
    } catch (e) { return "故事生成失败，请重试。"; }
};

export const generateComicScript = async (p: string) => {
    try {
        return (await getGenAI().models.generateContent({ model: 'gemini-3-pro-preview', contents: `分镜剧本: ${p}`, config: { thinkingConfig: { thinkingBudget: 4096 } } })).text || '';
    } catch (e) { return "脚本生成失败，请重试。"; }
};

export const generateMusicScore = async (p: string, s: string) => {
    try {
        return (await getGenAI().models.generateContent({ model: 'gemini-3-pro-preview', contents: `配乐方案: ${p}, style: ${s}`, config: { thinkingConfig: { thinkingBudget: 4096 } } })).text || '';
    } catch (e) { return "配乐方案生成失败。"; }
};

export const generateVideosFromPrompt = async (p: string, refs: string[], ar: string, res: any, onStatusUpdate?: any) => {
    const ai = getGenAI();
    
    const config: any = { 
        numberOfVideos: 1, 
        resolution: res, 
        aspectRatio: ar === '9:16' ? '9:16' : '16:9' 
    };
    
    const request: any = {
        model: 'veo-3.1-fast-generate-preview',
        config
    };
    
    // Add prompt if present (Veo can work with Image-only, but prompt is recommended)
    if (p) request.prompt = p;

    // Handle Start and End Frames
    if (refs && refs.length > 0) {
        // Ref 0 -> Start Frame
        const startMatch = refs[0].match(/^data:(.+);base64,(.+)$/);
        if (startMatch) {
            request.image = { mimeType: startMatch[1], imageBytes: startMatch[2] };
        }

        // Ref 1 -> End Frame
        if (refs.length > 1) {
             const endMatch = refs[1].match(/^data:(.+);base64,(.+)$/);
             if (endMatch) {
                 config.lastFrame = { mimeType: endMatch[1], imageBytes: endMatch[2] };
             }
        }
    }

    let op = await ai.models.generateVideos(request);
    
    // Safety break loop
    let attempts = 0;
    while (!op.done) { 
        if (attempts > 30) throw new Error("Video generation timed out"); // 5 minutes max
        await new Promise(r => setTimeout(r, 10000)); 
        op = await ai.operations.getVideosOperation({ operation: op }); 
        onStatusUpdate?.("视频渲染中...");
        attempts++;
    }
    
    const uri = op.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) throw new Error("Video generation completed but no URI returned");
    
    const key = getApiKey();
    return URL.createObjectURL(await (await fetch(`${uri}&key=${key}`)).blob());
};

export const generateSpeech = async (text: string, voice: string) => {
    const res = await getGenAI().models.generateContent({ model: "gemini-2.5-flash-preview-tts", contents: [{ parts: [{ text }] }], config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } });
    const data = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) throw new Error("Audio gen failed");
    return URL.createObjectURL(new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: 'audio/pcm' })); 
};

export const generateSmartMultiFrameVideo = async (prompt: string, refs: string[], ar: string, onStatusUpdate?: any) => {
    const ai = getGenAI();
    let op = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: prompt,
        config: { 
            numberOfVideos: 1, 
            resolution: '720p', 
            aspectRatio: ar === '9:16' ? '9:16' : '16:9',
            referenceImages: refs.slice(0, 3).map(r => ({ image: { mimeType: 'image/png', imageBytes: r.split(',')[1] }, referenceType: VideoGenerationReferenceType.ASSET }))
        }
    });
    
    let attempts = 0;
    while (!op.done) { 
        if (attempts > 60) throw new Error("Multi-frame video generation timed out"); 
        await new Promise(r => setTimeout(r, 10000)); 
        op = await ai.operations.getVideosOperation({ operation: op }); 
        onStatusUpdate?.("智能多帧视频生成中..."); 
        attempts++;
    }
    return URL.createObjectURL(await (await fetch(`${op.response?.generatedVideos?.[0]?.video?.uri}&key=${getApiKey()}`)).blob());
};
