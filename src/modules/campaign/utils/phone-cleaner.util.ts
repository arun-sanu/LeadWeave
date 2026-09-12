export function cleanPhoneNumber(raw: string): { cleaned: string; chatId: string } {
  const digitsOnly = (raw || '').replace(/\D/g, '');
  return {
    cleaned: digitsOnly,
    chatId: `${digitsOnly}@c.us`,
  };
}

