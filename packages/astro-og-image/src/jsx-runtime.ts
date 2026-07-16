export type OgStyle = Record<string, string | number | undefined>;

export type OgNode = {
  type: string | typeof Fragment;
  props: Record<string, unknown> & { style?: OgStyle; children?: unknown };
};

export const Fragment = Symbol.for('astro-og-image.fragment');

const h = (type: string | typeof Fragment, props: Record<string, unknown> | null): OgNode => ({
  type,
  props: props ?? {},
});

export const jsx = h;
export const jsxs = h;
export const jsxDEV = h;

type Props = {
  style?: OgStyle;
  children?: unknown;
  src?: string;
  width?: number | string;
  height?: number | string;
  [key: string]: unknown;
};

type OgTag =
  | 'div'
  | 'span'
  | 'p'
  | 'img'
  | 'b'
  | 'i'
  | 'em'
  | 'strong'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'ul'
  | 'ol'
  | 'li'
  | 'blockquote'
  | 'pre'
  | 'code'
  | 'a'
  | 'br'
  | 'hr'
  | 'svg';

export namespace JSX {
  export type Element = OgNode;
  export interface ElementChildrenAttribute {
    children: object;
  }
  export type IntrinsicElements = Record<OgTag, Props>;
}
