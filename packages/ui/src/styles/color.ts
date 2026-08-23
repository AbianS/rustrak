/**
 * Just enough colour maths to check the palette in a test.
 *
 * It exists because the palette is written in two notations -- hex for the
 * neutrals, oklch for the severity and chart ramps -- and a contrast check
 * has to compare them
 * against each other. Nothing here is used at runtime by a component; the
 * browser does all of this itself.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
  /** 0-1. Anything below 1 has to be composited before it means anything. */
  a: number;
}

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;

  return {
    r: Number.parseInt(full.slice(0, 2), 16) / 255,
    g: Number.parseInt(full.slice(2, 4), 16) / 255,
    b: Number.parseInt(full.slice(4, 6), 16) / 255,
    a: 1,
  };
}

/** oklch -> linear sRGB, by way of OKLab and the LMS cone space. */
function oklchToRgb(l: number, c: number, hDeg: number, alpha: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  const lr = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const lg = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const lb = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;

  const gamma = (x: number) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, v));
  };

  return { r: gamma(lr), g: gamma(lg), b: gamma(lb), a: alpha };
}

/** Parses the three notations the token file actually uses. */
export function parseColor(value: string): Rgb {
  const input = value.trim();

  if (input.startsWith('#')) {
    return hexToRgb(input);
  }

  const oklch = input.match(
    /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/,
  );
  if (oklch) {
    return oklchToRgb(
      Number(oklch[1]),
      Number(oklch[2]),
      Number(oklch[3]),
      oklch[4] == null ? 1 : Number(oklch[4]),
    );
  }

  const rgb = input.match(
    /^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/,
  );
  if (rgb) {
    return {
      r: Number(rgb[1]) / 255,
      g: Number(rgb[2]) / 255,
      b: Number(rgb[3]) / 255,
      a: rgb[4] == null ? 1 : Number(rgb[4]),
    };
  }

  throw new Error(`Unparseable colour: ${value}`);
}

/** Paints a translucent colour over an opaque one. */
export function composite(top: Rgb, bottom: Rgb): Rgb {
  return {
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (x: number) =>
    x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio, 1 to 21. */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const front =
    foreground.a < 1 ? composite(foreground, background) : foreground;
  const a = relativeLuminance(front);
  const b = relativeLuminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];

  return (light + 0.05) / (dark + 0.05);
}
