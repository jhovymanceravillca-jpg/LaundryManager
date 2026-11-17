import { FONT_OPTIONS, type Appearance } from '../types';

export function applyAppearance(appearance: Appearance) {
  const font = FONT_OPTIONS.find((option) => option.id === appearance.fontFamily);
  if (!font) throw new Error('La tipografía guardada no es válida.');
  const root = document.documentElement;
  root.dataset.theme = appearance.backgroundMode;
  root.style.setProperty('--theme-accent', appearance.accentColor);
  root.style.setProperty('--theme-accent-hover', `color-mix(in srgb, ${appearance.accentColor} 84%, black)`);
  root.style.setProperty('--theme-accent-soft', `color-mix(in srgb, ${appearance.accentColor} 9%, white)`);
  root.style.setProperty('--theme-accent-border', `color-mix(in srgb, ${appearance.accentColor} 20%, white)`);
  root.style.setProperty('--theme-font-family', font.stack);
}
