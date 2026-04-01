export interface Config {
  geminiKey: string;
  projectName: string;
  brandName: string;
  imageSize: string;
  imageStyle: string;
  poseDuration: number;
  timerStyle: string;
  globalBackground: string;
  videoTitle: string;
  videoIdea: string;
  voiceLanguage: string;
  tone: string;
  poseCount: number;
  flowType: string;
  introDuration: number;
  outroDuration: number;
  ctaText: string;
  specialNotes: string;
  char1Name: string;
  char1Desc: string;
  char1Ref: string | null;
  char2Name: string;
  char2Desc: string;
  char2Ref: string | null;
  showPoseTitle: boolean;
  showBrand: boolean;
  geminiVoice: string;
  roomPrompt: string;
  matPrompt: string;
}

export interface Scene {
  id: number;
  section: 'intro' | 'pose' | 'outro';
  name: string;
  duration_seconds: number;
  screen_text: string;
  voiceover: string;
  visual_prompt: string;
  capcut_note: string;
  transition: string;
  timer_value: number | null;
}

export interface SavedCharacter {
  id: string;
  name: string;
  desc: string;
  ref: string | null;
}

export interface AppState {
  config: Config;
  scenes: Scene[];
  images: Record<string, string>;
  audio: Record<string, string>;
  savedCharacters?: SavedCharacter[];
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

