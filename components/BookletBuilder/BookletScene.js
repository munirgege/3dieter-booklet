import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  CameraControls,
  ContactShadows,
  Environment,
  Lightformer,
  RoundedBox
} from '@react-three/drei';
import * as THREE from 'three';

import {
  drawBackCover,
  drawFrontCover,
  drawPrintTexture,
  ensureBookletFont
} from '../../util/bookletUtils';
import {
  BOOKLET_DIMENSIONS,
  findBookletColor,
  findBookletFont
} from '../../data/bookletData';

/*
 * Procedural model of the GetGoing × 3Dieter booklet, in millimetres.
 *
 * Model space is the "reading" orientation: the spine runs along +Y at x = 0,
 * the back cover lies in x > 0 at z < 0 and the front cover closes over it at
 * z > 0. The six photo frames form an accordion strip hinged to the back
 * cover's spine edge; each frame's child hangs off its far edge and folds onto
 * alternating faces, so the strip stacks between the covers when closed and
 * lies flat over the opened front cover when open.
 *
 * Photo slots: side A (+z) of frame k shows photo k + 1, side B shows photo
 * 12 - k, so flipping the unfolded strip over continues the sequence.
 *
 * Details follow the sample booklet: every frame has short knuckle segments at
 * both ends of its long edges, each folded pair shares one long hinge barrel
 * in the middle, the spine panel's knuckles sit in notches cut into both
 * covers' spine edge, and the closed booklet stands in a U-channel stand
 * whose walls hide the bottom ~20 mm of the covers.
 */

const D = BOOKLET_DIMENSIONS;
const C = D.coverThickness;
const FT = D.frameThickness;
const FW = D.frameWidth;
const FH = D.frameHeight;
const B = D.frameBorder;
const L = D.coverLength;
const GAP = D.frameCount * FT + 2;
const HALF_GAP = GAP / 2;
const SPINE = GAP + C;
const FRAME_Y = (L - FH) / 2;
// The strip's hinge to the back cover sits just clear of the spine panel.
const ROOT_X = 4.5;
const ROOT_Z = -HALF_GAP + FT / 2 + 0.5;
const STAND = {
  ...D.stand,
  depth: GAP + C * 2 + 2 + D.stand.wall * 2
};

const quat = (axis, angle) =>
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis), angle);

/**
 * Pose per view. `spine` / `cover` are 1 when closed, `fold` 1 when the strip
 * is stacked, `rootFold` lifts the strip off the back cover. `view` is the
 * camera direction and the box (w × h) it has to fit.
 */
export const BOOKLET_VIEWS = {
  closed: {
    label: 'Tertutup',
    spine: 1,
    cover: 1,
    fold: 1,
    rootFold: 1,
    quaternion: quat([0, 0, 1], Math.PI / 2),
    // spine resting on the stand's channel floor
    position: [L / 2, STAND.floor + C / 2, 0],
    target: [0, 52, 0],
    direction: [0.3, 0.32, 1],
    fit: [140, 125]
  },
  open: {
    label: 'Terbuka',
    spine: 0,
    cover: 0,
    fold: 0.42,
    rootFold: 0.21,
    quaternion: quat([1, 0, 0], -Math.PI / 2),
    position: [130, C + HALF_GAP, L / 2],
    target: [0, 20, 0],
    direction: [0, 1.25, 1],
    fit: [470, 200]
  },
  strip: {
    label: 'Strip Foto',
    spine: 0,
    cover: 0,
    fold: 0.55,
    rootFold: 0.275,
    quaternion: new THREE.Quaternion(),
    position: [144 - ROOT_X, -FRAME_Y + 0.5, -(ROOT_Z + 29)],
    target: [0, 56, 0],
    direction: [0.25, 0.22, 1],
    // wide enough for the strip at any turntable angle
    fit: [400, 170]
  }
};

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Rectangle from x0..x0+w, y0..y0+h with separate left / right radii. */
const panelPath = (path, x0, y0, w, h, rLeft, rRight = rLeft) => {
  path.moveTo(x0 + rLeft, y0);
  path.lineTo(x0 + w - rRight, y0);
  path.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + rRight);
  path.lineTo(x0 + w, y0 + h - rRight);
  path.quadraticCurveTo(x0 + w, y0 + h, x0 + w - rRight, y0 + h);
  path.lineTo(x0 + rLeft, y0 + h);
  path.quadraticCurveTo(x0, y0 + h, x0, y0 + h - rLeft);
  path.lineTo(x0, y0 + rLeft);
  path.quadraticCurveTo(x0, y0, x0 + rLeft, y0);
  return path;
};

const extrude = (shape, depth) => {
  const bevel = Math.min(0.6, depth / 4);
  const core = depth - bevel * 2;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: core,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments: 10
  });
  geometry.translate(0, 0, -core / 2);
  return geometry;
};

/**
 * Cover outline, spine edge at x = 0, running towards +x (`side` 1, back
 * cover) or -x (`side` -1, front cover). The spine edge carries the notches
 * the spine panel's hinge knuckles sit in; the back cover also gets the
 * folder tab along the far end of its outer edge.
 */
const coverShape = (width, side, withTab) => {
  const { tabDepth: tab, cornerRadius: r, spineCornerRadius: r0, hingeNotchDepth: notch } = D;
  const s = new THREE.Shape();
  const at = (x, y) => [side * x, y];
  const line = (x, y) => s.lineTo(...at(x, y));
  const curve = (cx, cy, x, y) => s.quadraticCurveTo(...at(cx, cy), ...at(x, y));

  s.moveTo(...at(0, r0));
  D.hingeNotches.forEach(([from, to]) => {
    line(0, from * L);
    line(notch, from * L);
    line(notch, to * L);
    line(0, to * L);
  });
  line(0, L - r0);
  curve(0, L, r0, L);
  if (withTab) {
    const tabStart = L * (1 - D.tabLength);
    line(width + tab - r, L);
    curve(width + tab, L, width + tab, L - r);
    line(width + tab, tabStart + 8);
    s.bezierCurveTo(
      ...at(width + tab, tabStart + 2),
      ...at(width, tabStart + 2),
      ...at(width, tabStart - 3)
    );
  } else {
    line(width - r, L);
    curve(width, L, width, L - r);
  }
  line(width, r);
  curve(width, 0, width - r, 0);
  line(r0, 0);
  curve(0, 0, 0, r0);
  return s;
};

/** Cross-section of the U-channel stand (x = depth, y = height). */
const standShape = () => {
  const d = STAND.depth / 2;
  const { wall: w, height: h, floor: f } = STAND;
  const r = 2.5;
  const s = new THREE.Shape();
  s.moveTo(-d + r, 0);
  s.lineTo(d - r, 0);
  s.quadraticCurveTo(d, 0, d, r);
  s.lineTo(d, h - r);
  s.quadraticCurveTo(d, h, d - r, h);
  s.lineTo(d - w + r, h);
  s.quadraticCurveTo(d - w, h, d - w, h - r);
  s.lineTo(d - w, f);
  s.lineTo(-d + w, f);
  s.lineTo(-d + w, h - r);
  s.quadraticCurveTo(-d + w, h, -d + w - r, h);
  s.lineTo(-d + r, h);
  s.quadraticCurveTo(-d, h, -d, h - r);
  s.lineTo(-d, r);
  s.quadraticCurveTo(-d, 0, -d + r, 0);
  return s;
};

const useBookletGeometry = () =>
  useMemo(() => {
    const frameShape = panelPath(new THREE.Shape(), -FW, FRAME_Y, FW, FH, 4);
    frameShape.holes.push(
      panelPath(new THREE.Path(), -FW + B, FRAME_Y + B, FW - 2 * B, FH - 2 * B, 3)
    );
    const stand = extrude(standShape(), STAND.length);
    stand.rotateY(Math.PI / 2);
    return {
      backCover: extrude(coverShape(D.backCoverWidth, 1, true), C),
      frontCover: extrude(coverShape(D.frontCoverWidth, -1, false), C),
      stand,
      frame: extrude(frameShape, FT),
      plate: new THREE.BoxGeometry(FW - 2 * B + 2, FH - 2 * B + 2, 0.8),
      photo: new THREE.PlaneGeometry(FW - 2 * B + 1.5, FH - 2 * B + 1.5),
      // Hinge between a folded frame pair: one barrel spanning both frames.
      barrel: new THREE.CylinderGeometry(FT * 0.75, FT * 0.75, FH * 0.48, 20),
      // Each frame's own knuckle segments at both ends of its long edges.
      edgeKnuckle: new THREE.CylinderGeometry(FT / 2 + 0.2, FT / 2 + 0.2, FH * 0.1, 14),
      spineKnuckles: D.hingeNotches.map(
        ([from, to]) => new THREE.CylinderGeometry(1.7, 1.7, (to - from) * L - 0.8, 16)
      ),
      magnet: new THREE.CylinderGeometry(4, 4, 0.6, 24),
      frontArt: new THREE.PlaneGeometry(L, D.frontCoverWidth),
      backArt: new THREE.PlaneGeometry(L, D.backCoverWidth)
    };
  }, []);

/** Orientation that lays a plane's +x / +y / +z on the given axes. */
const basis = (right, up, normal) =>
  new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...right),
      new THREE.Vector3(...up),
      new THREE.Vector3(...normal)
    )
  );

// Artwork reads upright when the closed booklet stands on its spine.
const FRONT_ART_QUATERNION = basis([0, -1, 0], [-1, 0, 0], [0, 0, -1]);
const BACK_ART_QUATERNION = basis([0, 1, 0], [1, 0, 0], [0, 0, -1]);
const SIDE_B_QUATERNION = quat([0, 1, 0], Math.PI);

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

const canvasTexture = (width, height, draw) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const result = draw(canvas);
  if (result?.then) {
    result.then(() => {
      texture.needsUpdate = true;
    });
  }
  return texture;
};

const placeholderTexture = number =>
  canvasTexture(400, 600, canvas => {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e9e7e2';
    ctx.fillRect(0, 0, 400, 600);
    ctx.fillStyle = '#a8a39a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 56px Manrope, sans-serif';
    ctx.fillText(`Foto ${number}`, 200, 300);
  });

const usePhotoTextures = photos => {
  const [textures, setTextures] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const created = [];

    Promise.all(
      photos.map(
        (photo, index) =>
          new Promise(resolve => {
            if (!photo?.previewUrl) {
              const texture = placeholderTexture(index + 1);
              created.push(texture);
              resolve(texture);
              return;
            }
            loader.load(
              photo.previewUrl,
              texture => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = 8;
                created.push(texture);
                resolve(texture);
              },
              undefined,
              () => {
                const texture = placeholderTexture(index + 1);
                created.push(texture);
                resolve(texture);
              }
            );
          })
      )
    ).then(result => {
      if (!cancelled) setTextures(result);
    });

    return () => {
      cancelled = true;
      created.forEach(texture => texture.dispose());
    };
  }, [photos]);

  return textures;
};

const useCoverTextures = design => {
  const [fontReady, setFontReady] = useState(0);
  const font = findBookletFont(design.fontId);

  useEffect(() => {
    let cancelled = false;
    ensureBookletFont(font).then(() => !cancelled && setFontReady(n => n + 1));
    return () => {
      cancelled = true;
    };
  }, [font]);

  const front = useMemo(
    () =>
      canvasTexture(1160, Math.round((1160 * D.frontCoverWidth) / L), canvas =>
        drawFrontCover(canvas, design, { background: false })
      ),
    // fontReady re-draws once the web font has arrived
    [design.title, design.subtitle, design.fontId, design.colorId, design.textColorId, fontReady]
  );

  const back = useMemo(
    () =>
      canvasTexture(1160, Math.round((1160 * D.backCoverWidth) / L), canvas =>
        drawBackCover(canvas, design, { background: false })
      ),
    [design.colorId, design.textColorId]
  );

  const printLines = useMemo(() => {
    const texture = canvasTexture(256, 256, drawPrintTexture);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / 40, 1 / 40);
    return texture;
  }, []);

  useEffect(() => () => front.dispose(), [front]);
  useEffect(() => () => back.dispose(), [back]);
  useEffect(() => () => printLines.dispose(), [printLines]);

  return { front, back, printLines };
};

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const coverFinish = finishId =>
  finishId === 'glossy'
    ? { roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.12, bumpScale: 0.08 }
    : { roughness: 0.82, clearcoat: 0, clearcoatRoughness: 0, bumpScale: 0.6 };

const EDGE_KNUCKLE_Y = [0.06, 0.17, 0.83, 0.94].map(t => FRAME_Y + FH * t);

const FrameBody = ({ index, geometry, textures, materials }) => {
  const sideA = textures[index];
  const sideB = textures[11 - index];
  return (
    <group>
      <mesh geometry={geometry.frame} material={materials.frame} castShadow />
      {[0, -FW].map(x =>
        EDGE_KNUCKLE_Y.map(y => (
          <mesh
            key={`${x}:${y}`}
            geometry={geometry.edgeKnuckle}
            material={materials.frame}
            position={[x, y, 0]}
          />
        ))
      )}
      <mesh geometry={geometry.plate} material={materials.frame} position={[-FW / 2, L / 2, 0]} />
      {sideA && (
        <mesh geometry={geometry.photo} position={[-FW / 2, L / 2, 0.45]}>
          <meshStandardMaterial map={sideA} roughness={0.35} />
        </mesh>
      )}
      {sideB && (
        <mesh
          geometry={geometry.photo}
          position={[-FW / 2, L / 2, -0.45]}
          quaternion={SIDE_B_QUATERNION}
        >
          <meshStandardMaterial map={sideB} roughness={0.35} />
        </mesh>
      )}
    </group>
  );
};

/** Frame `index` and, recursively, the frames hanging off its far edge. */
const FrameLink = ({ index, side, pivot, offsetZ, linkRefs, ...props }) => {
  const childSide = (index - 1) % 2 === 0 ? -1 : 1;
  return (
    <group
      ref={node => {
        linkRefs.current[index] = node ? { node, side } : null;
      }}
      position={pivot}
    >
      <group position={[0, 0, offsetZ]}>
        <FrameBody index={index} {...props} />
        {index > 0 && (
          <>
            <mesh
              geometry={props.geometry.barrel}
              material={props.materials.frame}
              position={[-FW, L / 2, (childSide * FT) / 2]}
            />
            <FrameLink
              index={index - 1}
              side={childSide}
              pivot={[-FW, 0, (childSide * FT) / 2]}
              offsetZ={(-childSide * FT) / 2}
              linkRefs={linkRefs}
              {...props}
            />
          </>
        )}
      </group>
    </group>
  );
};

const damp = (current, target, delta, speed = 4.5) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));

const Booklet = ({ design, photos, view, autoRotate }) => {
  const geometry = useBookletGeometry();
  const textures = usePhotoTextures(photos);
  const art = useCoverTextures(design);
  const color = findBookletColor(design.colorId);
  const finish = coverFinish(design.finishId);

  const turntable = useRef();
  const display = useRef();
  const spine = useRef();
  const frontCover = useRef();
  const linkRefs = useRef([]);
  const pose = useRef({ ...BOOKLET_VIEWS[view] });
  const placed = useRef(false);

  const materials = useMemo(
    () => ({
      frame: new THREE.MeshStandardMaterial({ color: '#f4f2ed', roughness: 0.55 }),
      stand: new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.5, metalness: 0.15 }),
      magnet: new THREE.MeshStandardMaterial({ color: '#d0d0d0', roughness: 0.25, metalness: 1 })
    }),
    []
  );

  useEffect(() => () => Object.values(materials).forEach(m => m.dispose()), [materials]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const target = BOOKLET_VIEWS[view];
    const current = pose.current;

    ['spine', 'cover', 'fold', 'rootFold'].forEach(key => {
      current[key] = damp(current[key], target[key], delta);
    });

    spine.current.rotation.y = (Math.PI / 2) * current.spine;
    frontCover.current.rotation.y = (Math.PI / 2) * current.cover;
    linkRefs.current.forEach((link, index) => {
      if (!link) return;
      link.node.rotation.y =
        index === D.frameCount - 1
          ? Math.PI * current.rootFold
          : link.side * Math.PI * current.fold;
    });

    // Open straight into the first view; animate only later view changes.
    if (!placed.current) {
      display.current.quaternion.copy(target.quaternion);
      display.current.position.set(...target.position);
      placed.current = true;
    }
    display.current.quaternion.slerp(target.quaternion, 1 - Math.exp(-4.5 * delta));
    display.current.position.lerp(
      new THREE.Vector3(...target.position),
      1 - Math.exp(-4.5 * delta)
    );

    turntable.current.rotation.y = autoRotate
      ? turntable.current.rotation.y + delta * 0.25
      : damp(turntable.current.rotation.y, 0, delta, 2);
  });

  const coverMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: color.hex,
        bumpMap: art.printLines,
        ...coverFinish(design.finishId)
      }),
    [color.hex, art.printLines, design.finishId]
  );
  useEffect(() => () => coverMaterial.dispose(), [coverMaterial]);

  /** Spine knuckles in the notches of the cover hinged at spine-local x. */
  const spineKnuckles = x =>
    D.hingeNotches.map(([from, to], index) => (
      <mesh
        key={`${x}:${from}`}
        geometry={geometry.spineKnuckles[index]}
        material={coverMaterial}
        position={[x, ((from + to) / 2) * L, 0]}
      />
    ));

  const showCovers = view !== 'strip';

  return (
    <group ref={turntable}>
      <group ref={display}>
        {/* Back cover — fixed */}
        <group position={[0, 0, -HALF_GAP - C / 2]} visible={showCovers}>
          <mesh geometry={geometry.backCover} material={coverMaterial} castShadow />
          <mesh
            geometry={geometry.backArt}
            position={[D.backCoverWidth / 2, L / 2, -C / 2 - 0.05]}
            quaternion={BACK_ART_QUATERNION}
          >
            <meshPhysicalMaterial
              map={art.back}
              emissiveMap={art.back}
              emissive="#ffffff"
              emissiveIntensity={0.35}
              transparent
              {...finish}
              bumpScale={0}
              polygonOffset
              polygonOffsetFactor={-2}
            />
          </mesh>
        </group>

        {/* Spine and front cover */}
        <group ref={spine} position={[0, 0, -HALF_GAP - C / 2]} visible={showCovers}>
          <RoundedBox
            args={[SPINE, L, C]}
            radius={0.8}
            smoothness={3}
            position={[-SPINE / 2, L / 2, 0]}
            material={coverMaterial}
            castShadow
          />
          {spineKnuckles(0)}
          {spineKnuckles(-SPINE)}
          {[L * 0.3, L * 0.7].map(y => (
            <mesh
              key={y}
              geometry={geometry.magnet}
              material={materials.magnet}
              position={[-SPINE / 2, y, -C / 2 - 0.2]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          ))}
          <group ref={frontCover} position={[-SPINE, 0, 0]}>
            <mesh geometry={geometry.frontCover} material={coverMaterial} castShadow />
            <mesh
              geometry={geometry.frontArt}
              position={[-D.frontCoverWidth / 2, L / 2, -C / 2 - 0.05]}
              quaternion={FRONT_ART_QUATERNION}
            >
              <meshPhysicalMaterial
                map={art.front}
                emissiveMap={art.front}
                emissive="#ffffff"
                emissiveIntensity={0.35}
                transparent
                {...finish}
                bumpScale={0}
                polygonOffset
                polygonOffsetFactor={-2}
              />
            </mesh>
          </group>
        </group>

        {/* Accordion photo strip, hinged to the back cover's spine edge */}
        <FrameLink
          index={D.frameCount - 1}
          side={1}
          pivot={[ROOT_X, 0, ROOT_Z]}
          offsetZ={0}
          linkRefs={linkRefs}
          geometry={geometry}
          textures={textures}
          materials={materials}
        />
      </group>

      {view === 'closed' && (
        <mesh geometry={geometry.stand} material={materials.stand} castShadow />
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

const CameraRig = ({ view, onInteract }) => {
  const controls = useRef();
  const placed = useRef(false);
  const { size, camera } = useThree();

  useEffect(() => {
    if (!controls.current) return;
    const { target, direction, fit } = BOOKLET_VIEWS[view];
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const aspect = size.width / size.height;
    // Portrait phones would push wide views far away; crop their ends instead
    // (pinch-zoom still reaches everything).
    const fitWidth = aspect < 1 && fit[0] > 200 ? fit[0] * 0.75 : fit[0];
    const distance =
      Math.max(fit[1] / 2 / Math.tan(halfFov), fitWidth / 2 / (Math.tan(halfFov) * aspect)) *
      1.15;
    const dir = new THREE.Vector3(...direction).normalize().multiplyScalar(distance);
    controls.current.setLookAt(
      target[0] + dir.x,
      target[1] + dir.y,
      target[2] + dir.z,
      ...target,
      // the first placement is instant, so the preview opens already framed
      placed.current
    );
    placed.current = true;
  }, [view, size.width, size.height, camera]);

  return (
    <CameraControls
      ref={controls}
      minDistance={60}
      maxDistance={1600}
      maxPolarAngle={Math.PI * 0.49}
      onStart={onInteract}
    />
  );
};

const BookletScene = ({ design, photos, view, autoRotate, onInteract }) => (
  <Canvas
    dpr={[1, 2]}
    camera={{ fov: 32, near: 1, far: 8000, position: [120, 160, 520] }}
    gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
    style={{ touchAction: 'none' }}
  >
    <ambientLight intensity={0.35} />
    <directionalLight position={[180, 320, 260]} intensity={1.6} />
    <directionalLight position={[-240, 120, -200]} intensity={0.5} />
    <Environment resolution={256} frames={1}>
      <Lightformer intensity={2.2} position={[0, 5, -6]} scale={[12, 4, 1]} />
      <Lightformer intensity={1.4} position={[-6, 2, 4]} rotation-y={Math.PI / 3} scale={[6, 3, 1]} />
      <Lightformer intensity={1.8} position={[6, 3, 4]} rotation-y={-Math.PI / 3} scale={[4, 4, 1]} />
      <Lightformer intensity={0.8} position={[0, -4, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
    </Environment>

    <Booklet design={design} photos={photos} view={view} autoRotate={autoRotate} />

    <ContactShadows position={[0, 0, 0]} scale={1100} far={260} blur={2.6} opacity={0.42} resolution={1024} />
    <CameraRig view={view} onInteract={onInteract} />
  </Canvas>
);

export default BookletScene;
