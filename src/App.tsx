import React, { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { Settings, Folder, FileText, Image as ImageIcon, Mic, LayoutTemplate, Download, Upload, X, Loader2, Play, Sparkles } from 'lucide-react';
import { Config, Scene, AppState, SavedCharacter } from './types';
import { generateScript, generateImage, generateAudio, generateCharacterPrompt } from './api';
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
  geminiVoice: 'Kore',
  roomPrompt: 'A bright, clean kids yoga studio room, front view, flat wall facing the camera, completely empty, no details, no furniture, simple clean background',
  matPrompt: 'A single solid color kids yoga mat lying flat on the floor, viewed horizontally from the side, wide orientation parallel to the camera, completely empty, no people'
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
  const [images, setImages] = useState<Record<string, string>>({});
  const [audio, setAudio] = useState<Record<string, string>>({});
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatingImages, setGeneratingImages] = useState<Record<string, string>>({});
  const [generatingAudio, setGeneratingAudio] = useState<Record<string, boolean>>({});
  const [generatingPrompt, setGeneratingPrompt] = useState<Record<number, boolean>>({});
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);
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
      } catch (e: any) {
        console.error(e);
        alert('Ошибка при выборе ключа: ' + (e.message || 'Неизвестная ошибка'));
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
          if (saved.savedCharacters) setSavedCharacters(saved.savedCharacters);
        }
      } catch (e) {
        console.error('Failed to load from IndexedDB', e);
      }
    };
    loadData();
  }, []);

  // Save to IndexedDB
  useEffect(() => {
    set('kids_yoga_v3', { config, scenes, images, audio, savedCharacters }).catch(e => {
      console.error('Failed to save to IndexedDB', e);
    });
  }, [config, scenes, images, audio, savedCharacters]);

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

  const handleGenerateImage = async (scene: Scene | null, type: 'room' | 'mat' | 'character' = 'character') => {
    const key = type === 'character' && scene ? scene.id.toString() : type;
    setGeneratingImages(prev => ({ ...prev, [key]: 'Генерация...' }));
    try {
      const url = await generateImage(config, scene, type);
      setImages(prev => ({ ...prev, [key]: url }));
    } catch (e: any) {
      alert('Ошибка генерации картинки: ' + e.message);
    } finally {
      setGeneratingImages(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleGenerateCharPrompt = async (charNum: 1 | 2) => {
    const ref = charNum === 1 ? config.char1Ref : config.char2Ref;
    if (!ref) return;
    setGeneratingPrompt(prev => ({ ...prev, [charNum]: true }));
    try {
      const prompt = await generateCharacterPrompt(config, ref);
      updateConfig(charNum === 1 ? 'char1Desc' : 'char2Desc', prompt);
    } catch (e: any) {
      alert('Ошибка: ' + e.message);
    } finally {
      setGeneratingPrompt(prev => ({ ...prev, [charNum]: false }));
    }
  };

  const handleSaveCharacter = (charNum: 1 | 2) => {
    const name = charNum === 1 ? config.char1Name : config.char2Name;
    const desc = charNum === 1 ? config.char1Desc : config.char2Desc;
    const ref = charNum === 1 ? config.char1Ref : config.char2Ref;
    if (!name) return alert('Введите имя персонажа');
    
    const newChar: SavedCharacter = { id: Date.now().toString(), name, desc, ref };
    setSavedCharacters(prev => [...prev, newChar]);
    alert('Персонаж сохранен!');
  };

  const handleLoadCharacter = (charNum: 1 | 2, id: string) => {
    if (!id) return;
    const char = savedCharacters.find(c => c.id === id);
    if (!char) return;
    updateConfig(charNum === 1 ? 'char1Name' : 'char2Name', char.name);
    updateConfig(charNum === 1 ? 'char1Desc' : 'char2Desc', char.desc);
    updateConfig(charNum === 1 ? 'char1Ref' : 'char2Ref', char.ref);
  };

  const handleGenerateAudio = async (scene: Scene) => {
    const key = scene.id.toString();
    setGeneratingAudio(prev => ({ ...prev, [key]: true }));
    try {
      const url = await generateAudio(config, scene);
      setAudio(prev => ({ ...prev, [key]: url }));
    } catch (e: any) {
      alert('Ошибка генерации аудио: ' + e.message);
    } finally {
      setGeneratingAudio(prev => ({ ...prev, [key]: false }));
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
                  <label className="text-sm font-medium text-neutral-300">Формат (Количество персонажей)</label>
                  <select value={config.flowType} onChange={e => updateConfig('flowType', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                    <option value="solo">Соло (1 персонаж)</option>
                    <option value="duo">Дуо (2 персонажа)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300 flex justify-between">
                    <span>Количество поз</span>
                    <span className="text-indigo-400">{config.poseCount}</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input type="range" min="1" max="20" value={config.poseCount} onChange={e => updateConfig('poseCount', Number(e.target.value))} className="w-full accent-indigo-500" />
                    <input type="number" min="1" max="20" value={config.poseCount} onChange={e => updateConfig('poseCount', Number(e.target.value))} className="w-16 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-neutral-800">
                {/* Char 1 */}
                <div className="space-y-4 bg-neutral-900/30 p-6 rounded-2xl border border-neutral-800/50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-400"/> Персонаж 1</h3>
                    <div className="flex items-center gap-2">
                      <select onChange={(e) => handleLoadCharacter(1, e.target.value)} className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="">Загрузить...</option>
                        {savedCharacters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button onClick={() => handleSaveCharacter(1)} className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs transition-colors">Сохранить</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-neutral-400">Имя</label>
                    <input type="text" value={config.char1Name} onChange={e => updateConfig('char1Name', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-neutral-400">Описание (Промпт)</label>
                      {config.char1Ref && (
                        <button onClick={() => handleGenerateCharPrompt(1)} disabled={generatingPrompt[1]} className="text-xs text-indigo-400 hover:text-indigo-300 disabled:text-neutral-500 flex items-center gap-1">
                          {generatingPrompt[1] ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                          {generatingPrompt[1] ? 'Генерация...' : 'Сгенерировать по фото'}
                        </button>
                      )}
                    </div>
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
                {config.flowType === 'duo' && (
                  <div className="space-y-4 bg-neutral-900/30 p-6 rounded-2xl border border-neutral-800/50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-teal-400"/> Персонаж 2</h3>
                    <div className="flex items-center gap-2">
                      <select onChange={(e) => handleLoadCharacter(2, e.target.value)} className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="">Загрузить...</option>
                        {savedCharacters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button onClick={() => handleSaveCharacter(2)} className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs transition-colors">Сохранить</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm text-neutral-400">Имя</label>
                      <input type="text" value={config.char2Name} onChange={e => updateConfig('char2Name', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-neutral-400">Описание (Промпт)</label>
                        {config.char2Ref && (
                          <button onClick={() => handleGenerateCharPrompt(2)} disabled={generatingPrompt[2]} className="text-xs text-indigo-400 hover:text-indigo-300 disabled:text-neutral-500 flex items-center gap-1">
                            {generatingPrompt[2] ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                            {generatingPrompt[2] ? 'Генерация...' : 'Сгенерировать по фото'}
                          </button>
                        )}
                      </div>
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
                )}
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
                    if (!images['room']) await handleGenerateImage(null, 'room');
                    if (!images['mat']) await handleGenerateImage(null, 'mat');
                    for (const scene of scenes) {
                      if (!images[scene.id.toString()]) await handleGenerateImage(scene, 'character');
                    }
                  }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all flex items-center gap-2"
                >
                  <ImageIcon className="w-4 h-4"/> Сгенерировать недостающие
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Room and Mat Generation */}
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col">
                  <div className="aspect-video bg-neutral-950 relative flex items-center justify-center">
                    {images['room'] ? (
                      <img src={images['room']} alt="Room" className="w-full h-full object-cover" />
                    ) : generatingImages['room'] ? (
                      <div className="flex flex-col items-center gap-3 text-indigo-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-sm font-medium">{generatingImages['room']}</span>
                      </div>
                    ) : (
                      <ImageIcon className="w-8 h-8 text-neutral-700" />
                    )}
                    {images['room'] && generatingImages['room'] && (
                      <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 shadow-lg z-10">
                        <Loader2 className="w-3 h-3 animate-spin" /> Генерация...
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-3 bg-neutral-900">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">Комната (Фон)</div>
                      <button 
                        onClick={() => handleGenerateImage(null, 'room')}
                        disabled={!!generatingImages['room']}
                        className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2"
                      >
                        {generatingImages['room'] ? <><Loader2 className="w-3 h-3 animate-spin"/> Генерация...</> : images['room'] ? 'Переделать' : 'Создать'}
                      </button>
                    </div>
                    <textarea value={config.roomPrompt || ''} onChange={e => updateConfig('roomPrompt', e.target.value)} placeholder="Промпт для комнаты..." className="w-full h-16 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 resize-none" />
                  </div>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col">
                  <div className="aspect-video bg-neutral-950 relative flex items-center justify-center" style={{ backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/ENB4w8hOQ/AZEA8Gg8EwDBSwAAB+6wQhG/p1lwAAAABJRU5ErkJggg==")' }}>
                    {images['mat'] ? (
                      <img src={images['mat']} alt="Mat" className="w-full h-full object-contain" />
                    ) : generatingImages['mat'] ? (
                      <div className="flex flex-col items-center gap-3 text-indigo-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-sm font-medium">{generatingImages['mat']}</span>
                      </div>
                    ) : (
                      <ImageIcon className="w-8 h-8 text-neutral-700" />
                    )}
                    {images['mat'] && generatingImages['mat'] && (
                      <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 shadow-lg z-10">
                        <Loader2 className="w-3 h-3 animate-spin" /> Генерация...
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-3 bg-neutral-900">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">Коврик для йоги</div>
                      <button 
                        onClick={() => handleGenerateImage(null, 'mat')}
                        disabled={!!generatingImages['mat']}
                        className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2"
                      >
                        {generatingImages['mat'] ? <><Loader2 className="w-3 h-3 animate-spin"/> Генерация...</> : images['mat'] ? 'Переделать' : 'Создать'}
                      </button>
                    </div>
                    <textarea value={config.matPrompt || ''} onChange={e => updateConfig('matPrompt', e.target.value)} placeholder="Промпт для коврика..." className="w-full h-16 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 resize-none" />
                  </div>
                </div>

                {/* Character Scenes */}
                {scenes.map(scene => (
                  <div key={scene.id} className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col">
                    <div className="aspect-video bg-neutral-950 relative flex items-center justify-center" style={{ backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/ENB4w8hOQ/AZEA8Gg8EwDBSwAAB+6wQhG/p1lwAAAABJRU5ErkJggg==")' }}>
                      {images[scene.id.toString()] ? (
                        <img src={images[scene.id.toString()]} alt={scene.name} className="w-full h-full object-contain" />
                      ) : generatingImages[scene.id.toString()] ? (
                        <div className="flex flex-col items-center gap-3 text-indigo-400">
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <span className="text-sm font-medium">{generatingImages[scene.id.toString()]}</span>
                        </div>
                      ) : (
                        <ImageIcon className="w-8 h-8 text-neutral-700" />
                      )}
                      
                      {/* Overlay text preview */}
                      {images[scene.id.toString()] && config.showPoseTitle && (
                        <div className="absolute top-4 left-4 max-w-[60%] font-black text-xl leading-tight uppercase text-white drop-shadow-md">
                          {scene.screen_text}
                        </div>
                      )}
                      {images[scene.id.toString()] && generatingImages[scene.id.toString()] && (
                        <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 shadow-lg z-10">
                          <Loader2 className="w-3 h-3 animate-spin" /> Генерация...
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex items-center justify-between bg-neutral-900">
                      <div className="font-medium text-sm truncate pr-4">{scene.name}</div>
                      <button 
                        onClick={() => handleGenerateImage(scene, 'character')}
                        disabled={!!generatingImages[scene.id.toString()]}
                        className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2"
                      >
                        {generatingImages[scene.id.toString()] ? <><Loader2 className="w-3 h-3 animate-spin"/> Генерация...</> : images[scene.id.toString()] ? 'Переделать' : 'Создать'}
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
                  <p className="text-neutral-400 text-sm">Генерация голоса через Gemini TTS.</p>
                </div>
                <button 
                  onClick={async () => {
                    for (const scene of scenes) {
                      if (!audio[scene.id.toString()]) await handleGenerateAudio(scene);
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
                      {audio[scene.id.toString()] ? (
                        <audio controls src={audio[scene.id.toString()]} className="h-10 w-48" />
                      ) : generatingAudio[scene.id.toString()] ? (
                        <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium w-48 justify-center">
                          <Loader2 className="w-4 h-4 animate-spin" /> Озвучиваем...
                        </div>
                      ) : (
                        <div className="w-48 text-center text-sm text-neutral-600">Нет аудио</div>
                      )}
                      <button 
                        onClick={() => handleGenerateAudio(scene)}
                        disabled={generatingAudio[scene.id.toString()]}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
                      >
                        {generatingAudio[scene.id.toString()] ? <><Loader2 className="w-4 h-4 animate-spin"/> Генерация...</> : audio[scene.id.toString()] ? 'Переделать' : 'Озвучить'}
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
                      {images[scene.id.toString()] ? (
                        <img src={images[scene.id.toString()]} alt={scene.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-neutral-700" />
                      )}
                      
                      {/* Overlays */}
                      {images[scene.id.toString()] && config.showPoseTitle && (
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
