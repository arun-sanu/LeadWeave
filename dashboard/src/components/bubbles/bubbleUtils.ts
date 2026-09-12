import { formatPhoneForDisplay } from '../../utils/formatPhone';

export function getBubbleDisplayName(chatId: string, name?: string): string {
  if (!name) return formatPhoneForDisplay(chatId) || chatId.split('@')[0];
  if (!/^\+?\d+$/.test(name.replace(/[\s()-]/g, '')) && !name.includes('@')) {
    return name;
  }
  return formatPhoneForDisplay(name) || formatPhoneForDisplay(chatId) || name;
}
