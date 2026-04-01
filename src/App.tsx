import { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { Settings, Folder, FileText, Image as ImageIcon, Mic, LayoutTemplate, Download, Upload, X, Loader2, Play, Sparkles } from 'lucide-react';
import { Config, Scene, AppState } from './types';
import { generateScript, generateImage, generateAudio } from './api';
import { downloadProjectZip } from './export';

const DEFAULT_CONFIG: Config = {
  geminiKey: '',
  projectName: 'Kids Yoga Builder', brandName: 'Yoga Heroes',
  imageSize: '1536x1024', imageStyle: 'stylized 3D cartoon render, polished kids animation look, soft clean lighting',
  poseDuration: 12, timerStyle: 'circle',
  globalBackground: 'plain light gray seamless studio background with subtle gradient, clean floor, soft studio lighting, children yoga visual style',
  videoTitle: 'Duo Energy Yoga with Rumi & Zoey', videoIdea: 'Wake Up Power Flow for Kids',
  voiceLanguage: 'English', tone: 'warm, playful, encouraging', poseCount: 10, flowType: 'duo',
  introDuration: 10, outroDuration: 10, ctaText: 'Like and subscribe for more kids yoga!',
  specialNotes: 'No repeated poses. Keep visual variety high. Poses must be readable in a single still frame. All scenes should be easy to assemble in CapCut with minimal editing. Add a short intro and outro with CTA. Pose names should be very short and strong.',
  char1Name: 'Rumi', char1Desc: 'girl with long purple braided hair, purple sports outfit, barefoot, stylized 3D character', char1Ref: null,
  char2Name: 'Zoey', char2Desc: 'girl with dark blue hair in a bun, teal sports outfit, barefoot, stylized 3D character', char2Ref: null,
  showPoseTitle: true, showBrand: true,
  geminiVoice: 'Kore'
};

const TABS = [
  { id: 'setup', icon: Settings, label: 'Настройки' },
  { id: 'project', icon: Folder, label: 'Формат ролика' },
  { id: 'script', icon: FileText, label: 'Сценарий' },
  { id: 'images', icon: ImageIcon, label: 'Картинки' },
  { id: 'voice', icon: Mic, label: 'Озвучка' },
  { id: 'storyboard', icon: LayoutTemplate, label: 'Сторибоард' },
  { id: 'export', icon: Download, label: 'Экспорт' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('setup');
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [images, setImages] = useState<Record<number, string>>({});
  const [audio, setAudio] = useState<Record<number, string>>({});
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  const [generatingAudio, setGeneratingAudio] = useState<Record<number, boolean>>({});
  const [hasPaidKey, setHasPaidKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasPaidKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleSelectPaidKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setHasPaidKey(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Load from IndexedDB
  useEffect(() => {
    const loadData = async () => {
      try {
        // Clear old localStorage to free up space and prevent QuotaExceededError
        localStorage.removeItem('kids_yoga_v3');
        
        const saved = await get('kids_yoga_v3');
        if (saved) {
          if (saved.config) setConfig(saved.config);
          if (saved.scenes) setScenes(saved.scenes);
          if (saved.images) setImages(saved.images);
          if (saved.audio) setAudio(saved.audio);
        }
      } catch (e) {
        console.error('Failed to load from IndexedDB', e);
      }
    };
    loadData();
  }, []);

  // Save to IndexedDB
  useEffect(() => {
    set('kids_yoga_v3', { config, scenes, images, audio }).catch(e => {
      console.error('Failed to save to IndexedDB', e);
    });
  }, [config, scenes, images, audio]);

  const updateConfig = (key: keyof Config, value: any) => setConfig(prev => ({ ...prev, [key]: value }));
  const updateScene = (id: number, key: keyof Scene, value: any) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s));
  };

  const handleImageUpload = (key: 'char1Ref' | 'char2Ref', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => updateConfig(key, reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerateScript = async () => {
    setIsGeneratingScript(true);
    try {
      const newScenes = await generateScript(config);
      setScenes(newScenes);
      setImages({});
      setAudio({});
      setActiveTab('script');
    } catch (e: any) {
      alert('Ошибка: ' + e.message);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleGenerateImage = async (scene: Scene) => {
    setGeneratingImages(prev => ({ ...prev, [scene.id]: true }));
    try {
      const url = await generateImage(config, scene);
      setImages(prev => ({ ...prev, [scene.id]: url }));
    } catch (e: any) {
      alert('Ошибка генерации картинки: ' + e.message);
    } finally {
      setGeneratingImages(prev => ({ ...prev, [scene.id]: false }));
    }
  };

  const handleGenerateAudio = async (scene: Scene) => {
    setGeneratingAudio(prev => ({ ...prev, [scene.id]: true }));
    try {
      const url = await generateAudio(config, scene);
      setAudio(prev => ({ ...prev, [scene.id]: url }));
    } catch (e: any) {
      alert('Ошибка генерации аудио: ' + e.message);
    } finally {
      setGeneratingAudio(prev => ({ ...prev, [scene.id]: false }));
    }
  };

  const handleExport = () => {
    downloadProjectZip({ config, scenes, images, audio });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-800 bg-neutral-900/50 flex flex-col h-screen sticky top-0">
        <div className="p-6 flex items-center gap-3 border-b border-neutral-800">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20">🧘</div>
          <div>
            <h1 className="font-semibold text-sm leading-tight">Kids Yoga<br/>Builder</h1>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-indigo-500/10 text-indigo-400' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'}`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-neutral-800">
          <div className="text-xs text-neutral-500 space-y-1">
            <p>Сцен: {scenes.length}</p>
            <p>Картинок: {Object.keys(images).length}</p>
            <p>Аудио: {Object.keys(audio).length}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto bg-neutral-950">
        <div className="max-w-5xl mx-auto p-8">
          
          {/* SETUP PANEL */}
          {activeTab === 'setup' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Настройки API</h2>
                <p className="text-neutral-400 text-sm">Ключи для генерации контента.</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-300">Gemini API Key (для текста, картинок и озвучки)</label>
                    <input type="password" value={config.geminiKey} onChange={e => updateConfig('geminiKey', e.target.value)} placeholder="AIza..." className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                  {window.aistudio && (
                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-3">
                      <p className="text-xs text-indigo-200">
                        Для генерации картинок через Gemini 3.1 Flash Image требуется платный ключ Google Cloud.
                      </p>
                      <button
                        onClick={handleSelectPaidKey}
                        className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {hasPaidKey ? '✓ Платный ключ выбран' : 'Выбрать платный ключ Google Cloud'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">Голос озвучки (Gemini TTS)</label>
                  <select value={config.geminiVoice} onChange={e => updateConfig('geminiVoice', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                    <option value="Kore">Kore (Женский, спокойный)</option>
                    <option value="Aoede">Aoede (Женский)</option>
                    <option value="Puck">Puck (Мужской, энергичный)</option>
                    <option value="Charon">Charon (Мужской, глубокий)</option>
                    <option value="Fenrir">Fenrir (Мужской)</option>
                    <option value="Zephyr">Zephyr (Мужской)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* PROJECT PANEL */}
          {activeTab === 'project' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Формат ролика и Персонажи</h2>
                <p className="text-neutral-400 text-sm">Настройте общую идею и загрузите референсы персонажей.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">Название ролика</label>
                  <input type="text" value={config.videoTitle} onChange={e => updateConfig('videoTitle', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">Количество поз</label>
                  <select value={config.poseCount} onChange={e => updateConfig('poseCount', Number(e.target.value))} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                    <option value={6}>6</option><option value={8}>8</option><option value={10}>10</option><option value={12}>12</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-neutral-800">
                {/* Char 1 */}
                <div className="space-y-4 bg-neutral-900/30 p-6 rounded-2xl border border-neutral-800/50">
                  <h3 className="font-medium text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-400"/> Персонаж 1</h3>
                  <div className="space-y-2">
                    <label className="text-sm text-neutral-400">Имя</label>
                    <input type="text" value={config.char1Name} onChange={e => updateConfig('char1Name', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-neutral-400">Описание (Промпт)</label>
                    <textarea value={config.char1Desc} onChange={e => updateConfig('char1Desc', e.target.value)} className="w-full h-24 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-neutral-400">Референс (Изображение)</label>
                    {config.char1Ref ? (
                      <div className="relative aspect-square rounded-xl overflow-hidden border border-neutral-700 group">
                        <img src={config.char1Ref} alt="Char 1" className="w-full h-full object-cover" />
                        <button onClick={() => updateConfig('char1Ref', null)} className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 rounded-lg text-white transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-neutral-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 cursor-pointer transition-colors">
                        <Upload className="w-6 h-6 text-neutral-500 mb-2" />
                        <span className="text-xs text-neutral-500">Загрузить референс</span>
                        <input type="file" accept="image/*" onChange={e => handleImageUpload('char1Ref', e)} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>

                {/* Char 2 */}
                <div className="space-y-4 bg-neutral-900/30 p-6 rounded-2xl border border-neutral-800/50">
                  <h3 className="font-medium text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-teal-400"/> Персонаж 2</h3>
                  <div className="space-y-2">
                    <label className="text-sm text-neutral-400">Имя</label>
                    <input type="text" value={config.char2Name} onChange={e => updateConfig('char2Name', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-neutral-400">Описание (Промпт)</label>
                    <textarea value={config.char2Desc} onChange={e => updateConfig('char2Desc', e.target.value)} className="w-full h-24 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-neutral-400">Референс (Изображение)</label>
                    {config.char2Ref ? (
                      <div className="relative aspect-square rounded-xl overflow-hidden border border-neutral-700 group">
                        <img src={config.char2Ref} alt="Char 2" className="w-full h-full object-cover" />
                        <button onClick={() => updateConfig('char2Ref', null)} className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 rounded-lg text-white transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-neutral-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 cursor-pointer transition-colors">
                        <Upload className="w-6 h-6 text-neutral-500 mb-2" />
                        <span className="text-xs text-neutral-500">Загрузить референс</span>
                        <input type="file" accept="image/*" onChange={e => handleImageUpload('char2Ref', e)} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCRIPT PANEL */}
          {activeTab === 'script' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Сценарий</h2>
                  <p className="text-neutral-400 text-sm">Сгенерируйте структуру ролика с помощью Gemini.</p>
                </div>
                <button 
                  onClick={handleGenerateScript} 
                  disabled={isGeneratingScript}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium rounded-xl transition-all flex items-center gap-2"
                >
                  {isGeneratingScript ? <><Loader2 className="w-4 h-4 animate-spin"/> Генерируем...</> : <><Sparkles className="w-4 h-4"/> Сгенерировать сценарий</>}
                </button>
              </div>

              <div className="space-y-4">
                {scenes.length === 0 ? (
                  <div className="p-12 border-2 border-dashed border-neutral-800 rounded-2xl text-center text-neutral-500">
                    Нажмите кнопку выше, чтобы создать сценарий.
                  </div>
                ) : (
                  scenes.map(scene => (
                    <div key={scene.id} className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">{scene.id}</span>
                          <input value={scene.name} onChange={e => updateScene(scene.id, 'name', e.target.value)} className="bg-transparent font-semibold text-lg focus:outline-none focus:border-b border-indigo-500" />
                        </div>
                        <span className="px-3 py-1 rounded-full bg-neutral-800 text-xs font-medium text-neutral-300 uppercase tracking-wider">{scene.section}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs text-neutral-500 uppercase tracking-wider">Текст на экране</label>
                          <input value={scene.screen_text} onChange={e => updateScene(scene.id, 'screen_text', e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-neutral-500 uppercase tracking-wider">Длительность (сек)</label>
                          <input type="number" value={scene.duration_seconds} onChange={e => updateScene(scene.id, 'duration_seconds', Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-neutral-500 uppercase tracking-wider">Озвучка (TTS)</label>
                          <textarea value={scene.voiceover} onChange={e => updateScene(scene.id, 'voiceover', e.target.value)} className="w-full h-20 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-neutral-500 uppercase tracking-wider">Промпт для картинки</label>
                          <textarea value={scene.visual_prompt} onChange={e => updateScene(scene.id, 'visual_prompt', e.target.value)} className="w-full h-20 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* IMAGES PANEL */}
          {activeTab === 'images' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Картинки</h2>
                  <p className="text-neutral-400 text-sm">Генерация изображений с учетом референсов.</p>
                </div>
                <button 
                  onClick={async () => {
                    for (const scene of scenes) {
                      if (!images[scene.id]) await handleGenerateImage(scene);
                    }
                  }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all flex items-center gap-2"
                >
                  <ImageIcon className="w-4 h-4"/> Сгенерировать недостающие
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {scenes.map(scene => (
                  <div key={scene.id} className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col">
                    <div className="aspect-video bg-neutral-950 relative flex items-center justify-center">
                      {images[scene.id] ? (
                        <img src={images[scene.id]} alt={scene.name} className="w-full h-full object-cover" />
                      ) : generatingImages[scene.id] ? (
                        <div className="flex flex-col items-center gap-3 text-indigo-400">
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <span className="text-sm font-medium">Генерация...</span>
                        </div>
                      ) : (
                        <ImageIcon className="w-8 h-8 text-neutral-700" />
                      )}
                      
                      {/* Overlay text preview */}
                      {images[scene.id] && config.showPoseTitle && (
                        <div className="absolute top-4 left-4 max-w-[60%] font-black text-xl leading-tight uppercase text-white drop-shadow-md">
                          {scene.screen_text}
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex items-center justify-between bg-neutral-900">
                      <div className="font-medium text-sm truncate pr-4">{scene.name}</div>
                      <button 
                        onClick={() => handleGenerateImage(scene)}
                        disabled={generatingImages[scene.id]}
                        className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                      >
                        {images[scene.id] ? 'Переделать' : 'Создать'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VOICE PANEL */}
          {activeTab === 'voice' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Озвучка</h2>
                  <p className="text-neutral-400 text-sm">Генерация голоса через MiniMax.</p>
                </div>
                <button 
                  onClick={async () => {
                    for (const scene of scenes) {
                      if (!audio[scene.id]) await handleGenerateAudio(scene);
                    }
                  }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all flex items-center gap-2"
                >
                  <Mic className="w-4 h-4"/> Озвучить недостающие
                </button>
              </div>

              <div className="space-y-4">
                {scenes.map(scene => (
                  <div key={scene.id} className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 flex items-center gap-6">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-sm shrink-0">
                      {scene.id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium mb-1 truncate">{scene.name}</div>
                      <div className="text-sm text-neutral-400 truncate">{scene.voiceover}</div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {audio[scene.id] ? (
                        <audio controls src={audio[scene.id]} className="h-10 w-48" />
                      ) : generatingAudio[scene.id] ? (
                        <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium w-48 justify-center">
                          <Loader2 className="w-4 h-4 animate-spin" /> Озвучиваем...
                        </div>
                      ) : (
                        <div className="w-48 text-center text-sm text-neutral-600">Нет аудио</div>
                      )}
                      <button 
                        onClick={() => handleGenerateAudio(scene)}
                        disabled={generatingAudio[scene.id]}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-sm font-medium rounded-xl transition-colors"
                      >
                        {audio[scene.id] ? 'Переделать' : 'Озвучить'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STORYBOARD PANEL */}
          {activeTab === 'storyboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Сторибоард</h2>
                  <p className="text-neutral-400 text-sm">Предварительный просмотр сцен.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {scenes.map(scene => (
                  <div key={scene.id} className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col">
                    <div className="aspect-video bg-neutral-950 relative flex items-center justify-center">
                      {images[scene.id] ? (
                        <img src={images[scene.id]} alt={scene.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-neutral-700" />
                      )}
                      
                      {/* Overlays */}
                      {images[scene.id] && config.showPoseTitle && (
                        <div className="absolute top-4 left-4 max-w-[60%] font-black text-xl leading-tight uppercase text-white drop-shadow-md">
                          {scene.screen_text}
                        </div>
                      )}
                      
                      {images[scene.id] && config.showBrand && (
                        <div className="absolute top-4 right-4 bg-white/90 text-black px-3 py-1 rounded-full font-bold text-xs shadow-lg">
                          {config.brandName}
                        </div>
                      )}

                      {images[scene.id] && scene.timer_value && (
                        <div className="absolute bottom-4 right-4 w-12 h-12 rounded-full border-4 border-white/20 border-t-white flex items-center justify-center font-bold text-white shadow-lg bg-black/20 backdrop-blur-sm">
                          {scene.timer_value}
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-neutral-900 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm truncate pr-4">{scene.name}</div>
                        <div className="text-xs text-neutral-500">{scene.duration_seconds}s</div>
                      </div>
                      <div className="text-xs text-neutral-400 line-clamp-2">
                        {scene.voiceover}
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                        <div className={`w-2 h-2 rounded-full ${images[scene.id] ? 'bg-green-500' : 'bg-neutral-700'}`} title="Картинка" />
                        <div className={`w-2 h-2 rounded-full ${audio[scene.id] ? 'bg-green-500' : 'bg-neutral-700'}`} title="Аудио" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EXPORT PANEL */}
          {activeTab === 'export' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Экспорт проекта</h2>
                <p className="text-neutral-400 text-sm">Скачайте готовые материалы для сборки в CapCut.</p>
              </div>
              
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
                  <Download className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Готово к скачиванию</h3>
                  <p className="text-neutral-400 text-sm max-w-md mx-auto">
                    Архив будет содержать все сгенерированные картинки, аудиофайлы, а также CSV-таблицы с текстами и таймингами для удобной сборки.
                  </p>
                </div>
                <button 
                  onClick={handleExport}
                  className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                >
                  Скачать ZIP архив
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
