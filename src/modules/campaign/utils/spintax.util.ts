export function parseSpintax(text: string): string {
  if (!text) return '';
  let result = text;
  // Match single-brace spintax choices like {hi|hello|hey}, avoiding double braces {{variable}}
  const spintaxRegex = /(?<!\{)\{([^{}]+)\}(?!\})/g;
  let iterations = 0;
  while (spintaxRegex.test(result) && iterations < 20) {
    iterations++;
    const prev = result;
    result = result.replace(spintaxRegex, (_match, group) => {
      if (!group.includes('|')) return _match;
      const options = group.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
    if (result === prev) break;
  }
  return result;
}
