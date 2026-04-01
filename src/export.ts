import JSZip from 'jszip';
import { AppState } from './types';

export async function downloadProjectZip(state: AppState) {
  const zip = new JSZip();
  
  // JSON
  zip.file('project.json', JSON.stringify(state, null, 2));
  
  // CSVs
  const shotlistRows = [['id', 'section', 'name', 'screen_text', 'duration_seconds', 'timer_value', 'transition', 'capcut_note', 'image_ready', 'audio_ready']];
  state.scenes.forEach(s => {
    shotlistRows.push([
      s.id.toString(), s.section, s.name, s.screen_text, s.duration_seconds.toString(), 
      s.timer_value?.toString() || '', s.transition, s.capcut_note, 
      state.images[s.id] ? 'yes' : 'no', state.audio[s.id] ? 'yes' : 'no'
    ]);
  });
  const shotlistCsv = shotlistRows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
  zip.file('capcut_shotlist.csv', shotlistCsv);

  const captionsRows = [['id', 'section', 'screen_text']];
  state.scenes.forEach(s => captionsRows.push([s.id.toString(), s.section, s.screen_text]));
  const captionsCsv = captionsRows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
  zip.file('on_screen_text.csv', captionsCsv);

  // TXTs
  const voTxt = state.scenes.map(s => `${s.id}. ${s.name}\n${s.voiceover}\n`).join('\n');
  zip.file('voiceover.txt', voTxt);

  const promptsTxt = state.scenes.map(s => `${s.id}. ${s.name}\n${s.visual_prompt}\n`).join('\n');
  zip.file('prompts.txt', promptsTxt);

  // Media
  const imgFolder = zip.folder('images');
  const audFolder = zip.folder('audio');

  const pad = (n: number) => String(n).padStart(2, '0');
  const safe = (str: string) => String(str || 'file').replace(/[^a-zA-Z0-9а-яА-Я_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  state.scenes.forEach(s => {
    const img = state.images[s.id];
    const aud = state.audio[s.id];
    
    if (img && imgFolder) {
      const base64Data = img.split(',')[1];
      imgFolder.file(`${pad(s.id)}_${safe(s.name)}.png`, base64Data, { base64: true });
    }
    
    if (aud && audFolder) {
      const base64Data = aud.split(',')[1];
      audFolder.file(`${pad(s.id)}_${safe(s.name)}.wav`, base64Data, { base64: true });
    }
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe(state.config.projectName || 'kids_yoga_project')}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
