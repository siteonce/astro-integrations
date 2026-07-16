// Converts project template output into fixed-size PNGs while inlining public assets.
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import type { OgContext, Template } from './context.ts';
import type { SatoriFont } from './fonts.ts';
import { Fragment, type OgNode } from './jsx-runtime.ts';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const TRANSPARENT_PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function mimeFor(file: string): string {
  const extension = extname(file).slice(1).toLowerCase();
  if (extension === 'jpg') return 'image/jpeg';
  if (extension === 'svg') return 'image/svg+xml';
  return `image/${extension}`;
}

function inlineImages(node: unknown, publicDir: string, log: (message: string) => void): void {
  if (!node || typeof node !== 'object') return;
  const current = node as OgNode;
  if (!current.props) return;

  if (current.type === 'img' && typeof current.props.src === 'string') {
    const source = current.props.src;
    if (!/^(data:|https?:)/.test(source)) {
      const absolute = resolve(publicDir, source.replace(/^\/+/, ''));
      if (existsSync(absolute)) {
        current.props.src = `data:${mimeFor(absolute)};base64,${readFileSync(absolute).toString('base64')}`;
      } else {
        log(`image not found; rendering a blank slot: ${source} (looked in ${absolute})`);
        current.props.src = TRANSPARENT_PX;
      }
    }
  }

  const { children } = current.props;
  if (Array.isArray(children)) {
    for (const child of children) inlineImages(child, publicDir, log);
  } else {
    inlineImages(children, publicDir, log);
  }
}

export async function renderImage(options: {
  template: Template;
  context: OgContext;
  fonts: SatoriFont[];
  publicDir: string;
  log?: (message: string) => void;
}): Promise<Buffer> {
  const { template, context, fonts, publicDir } = options;
  let node = template(context);
  if (node.type === Fragment) {
    node = { type: 'div', props: { style: { display: 'flex' }, children: node.props.children } };
  }
  inlineImages(node, publicDir, options.log ?? (() => {}));

  const svg = await satori(node as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: fonts as Parameters<typeof satori>[1]['fonts'],
  });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
