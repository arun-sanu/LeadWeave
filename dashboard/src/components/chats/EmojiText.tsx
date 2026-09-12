import { Twemoji } from 'react-emoji-render';

interface EmojiTextProps {
  text: string;
  className?: string;
}

const META_EMOJI_OPTIONS = {
  protocol: 'https' as const,
  baseUrl: '//cdn.jsdelivr.net/npm/emoji-datasource-facebook/img/facebook/64/',
  ext: 'png' as const,
  size: '',
  className: 'rendered-meta-emoji',
};

/**
 * Renders text containing emojis with colorful high-resolution Meta/Facebook graphics
 * guaranteeing colorful Meta/WhatsApp 3D emoji rendering across any operating system or browser.
 */
export function EmojiText({ text, className }: EmojiTextProps) {
  if (!text) return null;
  return <Twemoji text={text} className={className} options={META_EMOJI_OPTIONS} />;
}

export default EmojiText;
