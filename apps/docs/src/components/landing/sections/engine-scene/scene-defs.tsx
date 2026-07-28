import { GROUND_RX, GROUND_RY, sx, sy } from './iso';

/**
 * The paint servers the drawing needs: the ground's radial fade and anything
 * else that has to exist before it can be referenced.
 *
 * Split out because they are addressed by id from several places in the
 * drawing and have nothing to do with the geometry above them.
 */
export function SceneDefs() {
  return (
    <defs>
      {/* The lattice has to stop without having an edge. A hard rectangle of
        grid reads as a texture swatch someone pasted behind the object;
        faded out radially it reads as ground continuing past the frame. */}
      <radialGradient id="engine-ground" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fff" stopOpacity="1" />
        <stop offset="55%" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <mask id="engine-ground-mask">
        <rect
          x={sx(0, 0) - GROUND_RX}
          y={sy(0, 0, 0) - GROUND_RY}
          width={GROUND_RX * 2}
          height={GROUND_RY * 2}
          fill="url(#engine-ground)"
        />
      </mask>
      <radialGradient id="engine-contact" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#000" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}
