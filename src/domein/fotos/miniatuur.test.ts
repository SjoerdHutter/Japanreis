import { describe, expect, it } from 'vitest';
import { alsGrootte } from './miniatuur';

describe('alsGrootte', () => {
  it('schrijft kleine bestanden in bytes en kilobytes', () => {
    expect(alsGrootte(512)).toBe('512 B');
    expect(alsGrootte(40 * 1024)).toBe('40 kB');
  });

  it('schrijft grote bestanden in megabytes, met een decimaal tot honderd', () => {
    expect(alsGrootte(3.5 * 1024 * 1024)).toBe('3.5 MB');
    expect(alsGrootte(250 * 1024 * 1024)).toBe('250 MB');
  });
});
