import { GoogleGenAI, Modality } from '@google/genai';
import { Config, Scene } from './types';

export async function generateScript(config: Config): Promise<Scene[]> {
  const apiKey = config.geminiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API Key is required');

  const ai = new GoogleGenAI({ apiKey });

  const duo = (config.flowType !== 'solo' && config.char2Desc) 
    ? `Character 1: ${config.char1Name} — ${config.char1Desc}. Character 2: ${config.char2Name} — ${config.char2Desc}.` 
    : `Single character: ${config.char1Name} — ${config.char1Desc}.`;

  const prompt = `You are creating a kids yoga video production pack for CapCut. Return only valid JSON.
Schema:
{
  "project_title":"string",
  "project_subtitle":"string",
  "duration_minutes": number,
  "scenes":[
    {
      "id": number,
      "section": "intro|pose|outro",
      "name": "UPPERCASE SHORT NAME",
      "duration_seconds": number,
      "screen_text": "short on-screen text",
      "voiceover": "${config.voiceLanguage} text",
      "visual_prompt": "English prompt",
      "capcut_note": "editing note",
      "transition": "cut|fade|pop|zoom",
      "timer_value": number|null
    }
  ]
}

Create exactly one intro, ${config.poseCount} pose scenes, and exactly one outro.
Theme: ${config.videoTitle}
Subtitle idea: ${config.videoIdea}
Flow type: ${config.flowType}
Tone: ${config.tone}
Audience: kids yoga beginners
Intro duration: ${config.introDuration}
Pose duration: ${config.poseDuration}
Outro duration: ${config.outroDuration}
CTA: ${config.ctaText}
${duo}
Global background: ${config.globalBackground}
Visual style: ${config.imageStyle}
Special notes: ${config.specialNotes}

Rules:
1. scene names must be very short and strong.
2. screen_text should be optimized for on-screen overlay.
3. visual_prompt must mention composition, pose details, and keep the frame clean for text overlays.
4. intro and outro prompts should be separate from pose scenes.
5. ALL scenes (including intro and outro) MUST feature the character(s). The visual_prompt for intro and outro must describe the character's action (e.g., waving hello, bowing), NOT the room.
6. capcut_note must be practical and simple.
7. timer_value should be null for intro and outro, and equal to pose duration for pose scenes.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.7,
    }
  });

  if (!response.text) throw new Error('Empty response from Gemini');
  
  let text = response.text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  
  const data = JSON.parse(text);
  return data.scenes.map((s: any, i: number) => ({
    id: s.id || i + 1,
    section: s.section || 'pose',
    name: s.name || `SCENE ${i + 1}`,
    duration_seconds: Number(s.duration_seconds || config.poseDuration),
    screen_text: s.screen_text || s.name || '',
    voiceover: s.voiceover || '',
    visual_prompt: s.visual_prompt || '',
    capcut_note: s.capcut_note || 'Clean cut.',
    transition: s.transition || 'cut',
    timer_value: s.timer_value === undefined ? null : s.timer_value
  }));
}

export async function generateCharacterPrompt(config: Config, imageBase64: string): Promise<string> {
  const apiKey = config.geminiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API Key is required');

  const ai = new GoogleGenAI({ apiKey });
  const [mime, data] = imageBase64.split(',');
  const mimeType = mime.split(':')[1].split(';')[0];

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [
      { inlineData: { data, mimeType } },
      { text: "Describe this character in detail for an image generation prompt. Focus on physical appearance, clothing, hair, and style. Keep it under 30 words." }
    ]
  });

  return response.text || '';
}

function removeGreenScreen(base64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64);
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        
        // Simple green screen removal
        if (g > 100 && g > r * 1.3 && g > b * 1.3) {
          data[i+3] = 0; // Set alpha to 0 (transparent)
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = base64;
  });
}

export async function generateImage(config: Config, scene: Scene | null, type: 'room' | 'mat' | 'character' = 'character'): Promise<string> {
  const apiKey = config.geminiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API Key is required');

  const ai = new GoogleGenAI({ apiKey });

  let prompt = '';
  const parts: any[] = [];

  if (type === 'room') {
    prompt = `${config.roomPrompt || 'A bright, clean kids yoga studio room, front view, flat wall facing the camera, completely empty, no details, no furniture, simple clean background'}, ${config.imageStyle}, empty room, no characters, clean background`;
  } else if (type === 'mat') {
    prompt = `${config.matPrompt || 'A single solid color kids yoga mat lying flat on the floor, viewed from the front, perspective receding towards the horizon, completely empty, no people'}, ${config.imageStyle}, isolated on a solid bright green background #00FF00, no characters`;
  } else {
    // Character
    prompt = `${scene?.visual_prompt}, character centered in the frame, full body visible, ${config.imageStyle}, isolated on a solid bright green background #00FF00, no text rendered into the image`;
    
    // Add reference images if they exist
    if (config.char1Ref) {
      const [mime, data] = config.char1Ref.split(',');
      const mimeType = mime.split(':')[1].split(';')[0];
      parts.push({ inlineData: { data, mimeType } });
    }
    if (config.char2Ref && config.flowType !== 'solo') {
      const [mime, data] = config.char2Ref.split(',');
      const mimeType = mime.split(':')[1].split(';')[0];
      parts.push({ inlineData: { data, mimeType } });
    }
  }
  
  // Add a random variation seed to ensure "Remake" generates a new image
  prompt += `\n\n(Variation seed: ${Math.random()})`;
  
  parts.push({ text: prompt });

  const ratioMap: Record<string, string> = {
    '1536x1024': '16:9', // closest supported
    '1024x1024': '1:1',
    '1024x1536': '9:16'  // closest supported
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: ratioMap[config.imageSize] || '16:9',
        imageSize: '1K'
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64 = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      if (type === 'character' || type === 'mat') {
        return await removeGreenScreen(base64);
      }
      return base64;
    }
  }

  throw new Error('No image returned from Gemini');
}

function pcmToBase64Wav(base64Pcm: string, sampleRate: number = 24000): string {
  const binaryString = atob(base64Pcm);
  const pcmData = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pcmData[i] = binaryString.charCodeAt(i);
  }

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmData.length, true);

  const wavBytes = new Uint8Array(44 + pcmData.length);
  wavBytes.set(new Uint8Array(wavHeader), 0);
  wavBytes.set(pcmData, 44);

  let binary = '';
  for (let i = 0; i < wavBytes.byteLength; i++) {
    binary += String.fromCharCode(wavBytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

export async function generateAudio(config: Config, scene: Scene): Promise<string> {
  const apiKey = config.geminiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API Key is required');

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Read the following text with a ${config.tone} tone:\n\n${scene.voiceover}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: config.geminiVoice || 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('No audio returned from Gemini');
  }

  return pcmToBase64Wav(base64Audio, 24000);
}
