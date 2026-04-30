import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RubyWord } from './RubyWord';
import type { KaraokeWord } from '../types';

function buildWord(surface: string, reading: string): KaraokeWord {
  return {
    id: 'w1',
    surface,
    reading,
    status: 'pending',
    lineIndex: 0,
    wordIndex: 0,
  };
}

describe('RubyWord', () => {
  it('shows katakana ruby reading for alphabetic tokens even when lengths match', () => {
    render(<RubyWord word={buildWord('AWS', 'アウス')} />);

    const ruby = screen.getByText('AWS').closest('ruby');
    expect(ruby).not.toBeNull();
    expect(screen.getByText('アウス')).toBeInTheDocument();
  });

  it('shows hiragana ruby reading for kanji tokens', () => {
    render(<RubyWord word={buildWord('意識', 'イシキ')} />);

    const ruby = screen.getByText('意識').closest('ruby');
    expect(ruby).not.toBeNull();
    expect(screen.getByText('いしき')).toBeInTheDocument();
  });
});
