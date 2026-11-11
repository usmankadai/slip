import { useLayoutEffect, useState } from 'react';

/** Reads a token's value from the page, so stories never repeat a raw value. */
export function useTokenValue(name: string): string {
  const [value, setValue] = useState('');
  useLayoutEffect(() => {
    setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  }, [name]);
  return value;
}
