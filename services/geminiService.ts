/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, GenerateImagesResponse, Modality, Type } from "@google/genai";
import { BeliefState, Clarification, Relationship, Candidate, GraphUpdate, Entity, Attribute } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

// Global instance for standard calls
const ai = new GoogleGenAI({ apiKey: API_KEY });

export type StatusUpdateCallback = (message: string) => void;

// --- START: Retry Logic for API Calls ---
const isRetryableError = (error: any): boolean => {
  // Try to extract error message or stringify the error object
  const errorMessage = typeof error?.message === 'string' ? error.message : JSON.stringify(error);
  
  // The Gemini API can return 503 errors when overloaded. These are safe to retry.
  // We also want to retry on 500 (Internal Server Error) and RPC/XHR errors which are often transient.
  // We also retry on 429 (Resource Exhausted) as this often indicates temporary rate limiting.
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
  initialDelay = 1000,
  onStatusUpdate?: StatusUpdateCallback,
  actionName: string = "Request"
): Promise<T> => {
  let lastError: any;
  let currentDelay = initialDelay;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isRetryableError(error)) {
        const msg = `${actionName} 期间连接不稳定或受限。正在重试 (${i + 1}/${retries})...`;
        console.warn(msg);
        if (onStatusUpdate) onStatusUpdate(msg);

        await delay(currentDelay);
        currentDelay = currentDelay * 2 + Math.floor(Math.random() * 1000);
      } else {
        console.error("Encountered a non-retryable error:", error);
        throw error;
      }
    }
  }

  console.error("All retry attempts failed for the request.");
  throw lastError;
};
// --- END: Retry Logic for API Calls ---

/**
 * Generates the complete Belief Graph including Entities, Relationships, AND Rich Attributes in a single pass.
 */
export const parsePromptToBeliefGraph = async (prompt: string, mode: 'image' | 'story' | 'video' | 'image-to-image', onStatusUpdate?: StatusUpdateCallback): Promise<BeliefState> => {
    console.log(`Generating Full Belief Graph (Structure + Attributes) for ${mode}:`, prompt);

    let specificInstructions = "";

    if (mode === 'image' || mode === 'image-to-image') {
        specificInstructions = `
        - **图片实体:** 始终包含一个名为 "图片" (Image) 的实体。必需属性: 天气 (weather), 地点 (location), 时间 (time of day), 氛围 (atmosphere), 镜头角度 (camera angle), 风格 (image style)。
        - **人物主体:** 如果实体是人类，包含属性: 年龄 (age), 性别 (gender), 种族 (ethnicity), 发型 (hair_style), 服装 (clothing), 表情 (expression), 姿势 (pose)。
        - **物体:** 包含属性: 颜色 (color), 材质 (material), 形状 (shape), 尺寸 (size), 纹理 (texture), 光照 (lighting)。
        `;
    } else if (mode === 'video') {
         specificInstructions = `
        - **视频实体:** 始终包含一个名为 "视频" (Video) 的实体。必需属性: 运镜 (camera_movement), 光照 (lighting), 氛围 (atmosphere), 视频风格 (video_style), 节奏 (pacing), 时长感 (duration_feel)。
        - **主体:** 如果实体是活动的，包含属性: 动作 (movement), 表情 (expression), 动作速度 (action_speed), 服装 (clothing)。
        - **场景:** 包含属性: 地点 (location), 天气 (weather), 时间 (time_of_day), 环境音效 (ambience)。
        `;
    } else {
        specificInstructions = `
        - **故事实体:** 始终包含一个名为 "故事" (Story) 的实体。必需属性: 流派 (genre), 基调 (tone), 叙事视角 (narrative_perspective), 节奏 (pacing), 核心冲突 (central_conflict)。
        - **角色:** 包含属性: 性格 (personality), 动机 (motivation), 角色定位 (role), 年龄 (age), 背景 (background), 情绪状态 (emotional_state)。
        `;
    }

    const generationPrompt = `
    分析提示词并生成场景或故事的完整**信念图** (Belief Graph)。
    识别所有实体、详细属性及其关系。**请使用中文输出实体名称、属性名称、值和关系标签。唯独 'existence' 属性名必须保持为英文 'existence'，值为 'true' 或 'false'。**

    实体类型:
    - **显式实体:** 提示词中明确提到的 (presence_in_prompt: True)。
    - **隐式实体:** 未提及但在逻辑上必要的 (presence_in_prompt: False)。限制在 2-3 个关键隐式实体。
    
    属性规则:
    1.  **Existence:** 对于每个实体，**必须**包含一个名为 'existence' 的属性（值为 "true" 或 "false"）。
    2.  **丰富属性:** 对于每个实体，根据以下规则生成 3-4 个描述性属性：
        ${specificInstructions}
    3.  **值:** 对于每个属性，提供 2-3 个合理的替代候选值（字符串列表）。第一个值应是最可能的。
    4.  **推断:** 如果属性未明确说明，请推断一个可能的值，并将 "presence_in_prompt" 设置为 false。

    关系:
    - 识别实体之间的逻辑关系（例如，“持有”，“旁边”，“属于”）。
    - 提供标签和替代项（作为字符串）。

    输入: { "prompt": "${prompt}" }
    输出 JSON:`;

    // Optimization: Request arrays of strings instead of arrays of objects for values/alternatives to reduce token count.
    const attributeSchema = { 
        type: Type.OBJECT, 
        properties: { 
            name: { type: Type.STRING }, 
            presence_in_prompt: { type: Type.BOOLEAN }, 
            value: { type: Type.ARRAY, items: { type: Type.STRING } } 
        }, 
        required: ['name', 'presence_in_prompt', 'value'] 
    };
    
    const entitySchema = { 
        type: Type.OBJECT, 
        properties: { 
            name: { type: Type.STRING }, 
            presence_in_prompt: { type: Type.BOOLEAN }, 
            description: { type: Type.STRING }, 
            alternatives: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true }, 
            attributes: { type: Type.ARRAY, items: attributeSchema } 
        }, 
        required: ['name', 'presence_in_prompt', 'description', 'attributes'] 
    };
    
    const relationshipSchema = { 
        type: Type.OBJECT, 
        properties: { 
            source: { type: Type.STRING }, 
            target: { type: Type.STRING }, 
            label: { type: Type.STRING }, 
            alternatives: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true } 
        }, 
        required: ['source', 'target', 'label'] 
    };

    try {
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
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
        }), 5, 2000, onStatusUpdate, "Belief Graph Generation");

        let jsonText = response.text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
        }

        const rawGraph = JSON.parse(jsonText);
        
        // Transform raw string arrays back to Candidate objects expected by the application
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

        const graph: BeliefState = { entities, relationships, prompt };
        return graph;
    } catch (error) {
        console.error("Error generating belief graph:", error);
        return { entities: [], relationships: [], prompt };
    }
};

export const generateClarifications = async (prompt: string, askedQuestions: string[], mode: 'image' | 'story' | 'video' | 'image-to-image', onStatusUpdate?: StatusUpdateCallback): Promise<Clarification[]> => {
    console.log(`Generating clarifications for ${mode} mode from prompt:`, prompt);
    
    const imagePrompt = `你是一位文生图提示词专家。你的目标是通过提出澄清性问题来帮助用户完善他们的提示词。
首先，推理用户的提示词以识别实体、属性和视觉不确定区域。
然后，生成针对这些不确定性的问题，以收集更具体的视觉细节。

关注点：
- 隐式实体（未明确提及但在场景中可能存在的物体）。
- 模糊属性（例如，如果提到“汽车”，询问颜色或型号）。
- 模棱两可的场景属性（例如，地点、时间、风格）。`;

    const videoPrompt = `你是一位 AI 视频生成提示词专家。你的目标是通过提出澄清性问题来帮助用户完善他们的提示词。
首先，推理用户的提示词以识别视觉叙事、运镜和时间动态。
然后，生成针对这些不确定性的问题。

关注点：
- 动作和运动（例如，“角色如何移动？”，“动作是快还是慢？”）。
- 镜头动态（例如，“镜头应该缩放、平移还是保持静止？”）。
- 随时间变化的氛围和光照。`;

    const storyPrompt = `你是一位创意写作助手。你的目标是通过基于初始提示词提出有见地的澄清性问题，帮助用户发展他们的故事构思。
首先，推理提示词以识别潜在的角色、背景、情节和主题。
然后，生成探索能丰富叙事领域的问题。

关注点：
- 角色动机或背景故事。
- 情节发展或潜在冲突。
- 可能影响情绪的设定细节。
- 故事的整体基调或主题。`;

    let specificPrompt = imagePrompt;
    if (mode === 'story') specificPrompt = storyPrompt;
    if (mode === 'video') specificPrompt = videoPrompt;
    // For 'image-to-image', we reuse the imagePrompt as the base is still visual generation.

    const finalPrompt = specificPrompt + `
    
请严格遵循以下说明：
1.  **数量：** 准确生成 3 个问题。
2.  **清晰简洁：** 问题必须非常清晰、简洁且直接。
3.  **易于回答：** 问题应易于人类回答，最好通过从预定义选项中选择。
4.  **信息多样性：** 这三个问题必须互不相同，旨在收集不同方面的信息。
5.  **答案选项：** 为每个问题提供 3-5 个合理且独特的**中文**答案选项。
6.  **避免重复：** 不要问以下任何问题（或语义相同的问题），因为用户已经回答或拒绝了它们：
    ${askedQuestions.map(q => `- "${q}"`).join('\n') || '无'}

用户提示词: "${prompt}"

以 JSON 对象数组的形式返回输出，其中每个对象都有 'question'（问题）和 'options'（选项数组）。确保所有文本为中文。`;

    try {
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: finalPrompt,
            config: {
                // thinkingConfig removed
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
        }), 5, 2000, onStatusUpdate, "Clarification Generation"); 

        let jsonText = response.text.trim();
        // Robust markdown stripping
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
        }
        const clarifications = JSON.parse(jsonText);
        return clarifications as Clarification[];

    } catch (error) {
        console.error("Error generating clarifications with Gemini:", error);
        return [];
    }
};

export const refinePromptWithClarification = async (
  originalPrompt: string,
  question: string,
  answer: string
): Promise<string> => {
  // ... (No changes here, keeping existing implementation)
  console.log("Refining prompt with clarification:", { originalPrompt, question, answer });
  const prompt = `You are an expert prompt engineer.
Your task is to update a given prompt based on the answer to a clarification question.
Integrate the answer naturally and concisely into the prompt to improve the final output.
Do not add any extra explanations, just return the updated prompt string.

Original Prompt: "${originalPrompt}"
Clarification Question: "${question}"
User's Answer: "${answer}"

Updated Prompt:`;

  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    }));
    return response.text;
  } catch (error) {
    console.error("Error refining prompt:", error);
    return originalPrompt;
  }
};

export const refinePromptWithMultipleClarifications = async (
  originalPrompt: string,
  clarifications: { question: string; answer: string }[]
): Promise<string> => {
  // ... (No changes here, keeping existing implementation)
  console.log("Refining prompt with multiple clarifications:", { originalPrompt, clarifications });
  const prompt = `You are an expert prompt engineer.
Your task is to update a given prompt based on the user's answers to several clarification questions.
Integrate ALL the answers naturally and concisely into the prompt to improve the final output.
Do not add any extra explanations, just return the updated prompt string.

Original Prompt: "${originalPrompt}"

Clarifications:
${clarifications.map((c, i) => `${i+1}. Question: "${c.question}" Answer: "${c.answer}"`).join('\n')}

Updated Prompt:`;

  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    }));
    return response.text;
  } catch (error) {
    console.error("Error refining prompt:", error);
    return originalPrompt;
  }
};

export const refinePromptWithAllUpdates = async (
    originalPrompt: string,
    clarifications: { question: string; answer: string }[],
    graphUpdates: GraphUpdate[],
    onStatusUpdate?: StatusUpdateCallback
  ): Promise<string> => {
    console.log("Refining prompt with combined updates:", { originalPrompt, clarifications, graphUpdates });
  
    let updatesPromptSection = "";
    
    if (graphUpdates.length > 0) {
        const graphList = graphUpdates.map((u, i) => {
            if (u.type === 'attribute') {
                return `- 对于实体 "${u.entity}", 将属性 "${u.attribute}" 设置为 "${u.value}".`;
            } else {
                return `- 将 "${u.source}" 和 "${u.target}" 之间的关系从 "${u.oldLabel}" 更改为 "${u.newLabel}".`;
            }
        }).join('\n');
        updatesPromptSection += `\n需要应用的具体编辑:\n${graphList}\n`;
    }
  
    if (clarifications.length > 0) {
        const qaList = clarifications.map((c, i) => `- 用户对 "${c.question}" 的回答: "${c.answer}"`).join('\n');
        updatesPromptSection += `\n问答中的新信息:\n${qaList}\n`;
    }
  
    const prompt = `你是一位提示词专家。你的目标是重写提示词，无缝地融入用户的具体编辑，同时严格保留所有其他现有细节。
    
  原始提示词: "${originalPrompt}"
  
  ${updatesPromptSection}
  
  说明:
  1.  **整合属性:** 当设置属性（例如，“颜色”为“蓝色”）时，确保在叙述中明确描述具有该属性的实体。
  2.  **更新关系:** 如果关系发生变化，重写实体之间的交互以反映新状态。
  3.  **融入回答:** 将用户的澄清回答视为确定的事实，并将其编织到场景中。
  4.  **保留上下文:** 关键：不要删除、总结或压缩“原始提示词”中的任何现有细节、实体或风格元素。目标是增补和修改，而不是总结。只有在编辑明确反驳细节时才删除细节。
  5.  **排除:** 关键：如果编辑将 "existence"（存在性）设置为 "false"（或“不存在”），你必须完全删除该实体及其相关描述。
  6.  **风格:** 保持原始基调（例如，如果是故事，保持叙事性；如果是图片提示词，保持描述性）。
  
  不要添加任何额外的解释，只返回更新后的提示词字符串。
  
  更新后的提示词:`;
  
    try {
      const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      }), 3, 1000, onStatusUpdate, "Prompt Refinement");
      return response.text;
    } catch (error) {
      console.error("Error refining prompt with all updates:", error);
      return originalPrompt;
    }
  };

export const generateImagesFromPrompt = async (prompt: string, aspectRatio: string, referenceImage: string | null = null, onStatusUpdate?: StatusUpdateCallback): Promise<string[]> => {
    console.log("Generating images for prompt:", prompt, "Ratio:", aspectRatio, "HasRefImage:", !!referenceImage);
    
    // Helper to generate one image using gemini-2.5-flash-image
    const generateOne = async (): Promise<string | null> => {
        try {
            const parts: any[] = [];
            
            // Add reference image if present
            if (referenceImage) {
                 const matches = referenceImage.match(/^data:(.+);base64,(.+)$/);
                 if (matches) {
                    parts.push({
                        inlineData: {
                            mimeType: matches[1],
                            data: matches[2]
                        }
                    });
                 }
            }
            
            // Add prompt text
            parts.push({ text: prompt });

            const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: parts
                },
                config: {
                    imageConfig: {
                        aspectRatio: aspectRatio,
                    }
                }
            }), 3, 2000, onStatusUpdate, "Image Generation"); // Increased initial delay
            
            if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        return `data:image/png;base64,${part.inlineData.data}`;
                    }
                }
            }
            return null;
        } catch (err) {
            console.warn("Single image generation failed:", err);
            return null;
        }
    };

    // Execute multiple requests to ensure we get 4 images
    let images: string[] = [];
    let attempts = 0;
    const maxAttempts = 2; // Allow one retry pass for missing images

    while (images.length < 4 && attempts < maxAttempts) {
        const needed = 4 - images.length;
        if (needed === 0) break;
        
        console.log(`Generating ${needed} images, attempt ${attempts + 1}`);
        if (attempts > 0 && onStatusUpdate) {
             onStatusUpdate(`正在生成剩余图片... 尝试 ${attempts + 1}`);
        }
        
        const promises = Array(needed).fill(null).map(() => generateOne());
        const results = await Promise.all(promises);
        
        // Filter out any nulls from failed requests
        const newImages = results.filter((img): img is string => img !== null);
        images = [...images, ...newImages];
        
        attempts++;
    }

    if (images.length === 0) {
        throw new Error("图片生成失败。请重试。");
    }

    return images;
};

export const generateVideosFromPrompt = async (prompt: string, aspectRatio: string, onStatusUpdate?: StatusUpdateCallback): Promise<string> => {
    console.log("Generating video for prompt:", prompt, "Ratio:", aspectRatio);
    
    // Validate ratio for video. Veo usually supports 16:9 or 9:16.
    let targetRatio = aspectRatio;
    if (targetRatio !== '16:9' && targetRatio !== '9:16') {
        console.warn(`Video generation only supports 16:9 or 9:16. Defaulting '${targetRatio}' to '16:9'.`);
        targetRatio = '16:9';
    }

    try {
        // Check for API Key selection (Veo requirement)
        const win = window as any;
        if (win.aistudio && win.aistudio.hasSelectedApiKey) {
            const hasKey = await win.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                throw new Error("请选择 API 密钥以继续生成视频。");
            }
        }

        // Veo requires creating a new instance right before call to capture API key from window selection
        const freshAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        if (onStatusUpdate) onStatusUpdate("正在初始化视频生成...");

        let operation = await freshAi.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: targetRatio
            }
        });

        if (onStatusUpdate) onStatusUpdate("视频生成已开始（可能需要一分钟）...");

        // Polling loop
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10s
            if (onStatusUpdate) onStatusUpdate("正在生成视频帧...");
            operation = await freshAi.operations.getVideosOperation({operation: operation});
        }
        
        if (operation.error) {
             throw new Error(`视频生成失败: ${operation.error.message || JSON.stringify(operation.error)}`);
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error("未返回视频 URI");

        // The response.body contains the MP4 bytes. You must append an API key when fetching from the download link.
        const downloadUrl = `${videoUri}&key=${process.env.API_KEY}`;
        
        if (onStatusUpdate) onStatusUpdate("正在下载视频...");
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        return URL.createObjectURL(blob);

    } catch (error) {
        console.error("Error generating video:", error);
        throw error;
    }
};

export const generateStoryFromPrompt = async (prompt: string, onStatusUpdate?: StatusUpdateCallback): Promise<string> => {
    console.log("Generating story for prompt:", prompt);
    const storyGenerationPrompt = `基于以下想法，写一个简短、有创意的故事。故事应引人入胜且结构良好。
    
    想法: "${prompt}"
    
    故事:`;
    try {
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: storyGenerationPrompt,
            config: { temperature: 0.8 }
        }), 3, 1000, onStatusUpdate, "Story Generation");
        return response.text;
    } catch (error) {
        console.error("Error generating story with Gemini:", error);
        throw error;
    }
};

export const refinePromptWithGraphUpdates = async (
  originalPrompt: string,
  updates: GraphUpdate[]
): Promise<string> => {
   // ... (Keeping existing implementation)
   // Logic merged into refinePromptWithAllUpdates, but keeping this for safety if referenced elsewhere.
  console.log("Refining prompt with batched graph updates:", { originalPrompt, updates });

  const updatesList = updates.map((u, i) => {
      if (u.type === 'attribute') {
          return `${i+1}. 对于实体 "${u.entity}", 将属性 "${u.attribute}" 设置为 "${u.value}".`;
      } else {
          return `${i+1}. 将 "${u.source}" 和 "${u.target}" 之间的关系从 "${u.oldLabel}" 更改为 "${u.newLabel}".`;
      }
  }).join('\n');

  const prompt = `你是一位提示词专家。你的目标是重写提示词，无缝地融入用户的具体编辑，同时严格保留所有其他现有细节。
  
原始提示词: "${originalPrompt}"

编辑列表:
${updatesList}

说明:
1.  **整合属性:** 当设置属性（例如，“颜色”为“蓝色”）时，确保在叙述中明确描述具有该属性的实体。
2.  **更新关系:** 如果关系发生变化，重写实体之间的交互以反映新状态。
3.  **保留上下文:** 关键：不要删除、总结或压缩“原始提示词”中的任何现有细节、实体或风格元素。目标是增补和修改，而不是总结。只有在编辑明确反驳细节时才删除细节。
4.  **排除:** 关键：如果编辑将 "existence"（存在性）设置为 "false"（或“不存在”），你必须完全删除该实体及其相关描述。
5.  **风格:** 保持原始基调（例如，如果是故事，保持叙事性；如果是图片提示词，保持描述性）。

不要添加任何额外的解释，只返回更新后的提示词字符串。

更新后的提示词:`;

  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    }));
    return response.text;
  } catch (error) {
    console.error("Error refining prompt with graph updates:", error);
    return originalPrompt;
  }
};