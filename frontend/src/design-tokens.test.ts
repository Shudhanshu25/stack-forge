import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard for "no component contains a hardcoded colour": colour literals may appear only in
 * the theme token blocks at the top of styles.css; components and the rest of the stylesheet
 * use tokens.
 */
const SRC = path.resolve(process.cwd(), 'src');
const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black)\b(?=\s*[;,)])/g;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

/** The stylesheet with its token blocks (":root…{ … }" holding custom properties) removed. */
function outsideTokenBlocks(css: string): string {
  return css.replace(/(^|\n):root[^{]*\{[^}]*--[^}]*\}/g, '\n');
}

describe('design tokens', () => {
  it('no component or style rule hardcodes a colour', () => {
    const offenders: string[] = [];
    for (const file of files(SRC)) {
      let text = readFileSync(file, 'utf8');
      if (file.endsWith('.css')) text = outsideTokenBlocks(text);
      // Comments may name colours.
      text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const match of text.matchAll(COLOR)) {
        offenders.push(`${path.relative(SRC, file)}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('both themes define the same colour tokens', () => {
    const css = readFileSync(path.join(SRC, 'styles.css'), 'utf8');
    const block = (selector: string) => {
      const start = css.indexOf(selector);
      const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
      return [...body.matchAll(/(--[\w-]+):/g)].map((m) => m[1]).sort();
    };
    const dark = block(":root[data-theme='dark'] {");
    const light = block(":root[data-theme='light'] {");
    expect(dark.length).toBeGreaterThan(20);
    expect(light).toEqual(dark);
  });
});
