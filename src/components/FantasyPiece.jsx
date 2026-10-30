import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationClip, AnimationMixer, LoopOnce, LoopRepeat } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { normalizeIvoryActor } from './ivoryNormalize.js'
import { DRACO_PATH, MODEL_TURN, PROP_URLS, UNITS } from '../battle/units.js'
import { attachProps } from '../battle/propAttach.js'
import { useUnit } from '../battle/useUnit.js'

/** ChessBoard3D square top sits at y ≈ 0.04 (mesh at -0.02, height 0.12). */
const BOARD_SURFACE_Y = 0.04

/**
 * OrbitControls sit between ~7–13 from origin. Beyond this distance, idle
 * mixers tick at half rate — cheap LOD without a second mesh set.
 */
const IDLE_LOD_DISTANCE = 11

const teamColor = {
  w: '#f2ddad',
  b: '#5978b8',
}

export function FantasyPiece({ piece, selected = false, action = 'idle', yaw }) {
  const { scene, animations, props, propScenes } = useUnit(piece)
  const { camera } = useThree()
  const lodTick = useRef(0)

  const { actor, crownY } = useMemo(() => {
    const instance = clone(scene)

    instance.traverse((node) => {
      if (!node.isMesh) return
      // Shadows stay off — board already runs without a shadow map.
      node.castShadow = false
      node.receiveShadow = false
      if (node.material) {
        node.material = node.material.clone()
        // Slightly cheaper default lighting response for 32 humanoids.
        if ('metalness' in node.material) {
          node.material.metalness = Math.min(node.material.metalness ?? 0, 0.35)
          node.material.envMapIntensity = 0.55
        }
      }
    })

    // Size the body first, so a tall spear doesn't shrink the unit holding it.
    const { height } = normalizeIvoryActor(instance, piece.type)
    attachProps(instance, props, propScenes)
    return { actor: instance, crownY: height + 0.08 }
  }, [scene, piece.type, props, propScenes])

  const mixer = useMemo(() => new AnimationMixer(actor), [actor])

  useEffect(() => {
    const clip = AnimationClip.findByName(animations, action)
    if (!clip) return undefined

    mixer.stopAllAction()
    const clipAction = mixer.clipAction(clip)
    clipAction.reset()
    // Idle and walk loop; attack/hit/death play once and hold.
    const looping = action === 'idle' || action === 'walk'
    clipAction.clampWhenFinished = !looping
    clipAction.setLoop(looping ? LoopRepeat : LoopOnce, looping ? Infinity : 1)
    // Desync idle so the army does not breathe in lockstep.
    if (action === 'idle') {
      clipAction.time = Math.random() * Math.min(0.45, clip.duration)
    }
    clipAction.play()

    return () => clipAction.stop()
  }, [action, animations, mixer])

  useFrame((_, delta) => {
    // Cheap distance LOD: half-rate idle ticks when the camera is pulled back.
    // Capture / selection always run at full rate so fights stay crisp.
    if (action === 'idle' && !selected) {
      const dist = camera.position.length()
      if (dist > IDLE_LOD_DISTANCE) {
        lodTick.current += 1
        if (lodTick.current % 2 === 1) return
        mixer.update(delta * 2)
        return
      }
    }
    mixer.update(delta)
  })

  // Ring radii in world units (group is unscaled — actor carries the normalize).
  const ringInner = 0.28
  const ringOuter = 0.36

  const facing = yaw ?? (piece.color === 'b' ? Math.PI : 0)

  return (
    <group
      position-y={BOARD_SURFACE_Y}
      rotation-y={facing}
    >
      {/* The generated models' front is the far side from Ivory's; turn them round
          here so idle, walk and capture yaw all stay as they were. */}
      <group rotation-y={MODEL_TURN}>
        <primitive object={actor} dispose={null} />
      </group>
      <mesh position-y={0.01} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[ringInner, ringOuter, 24]} />
        <meshBasicMaterial
          color={selected ? '#ffd45a' : teamColor[piece.color]}
          transparent
          opacity={selected ? 0.95 : 0.72}
        />
      </mesh>
      {(piece.type === 'q' || piece.type === 'k') && (
        <mesh position-y={crownY} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.14, 0.04, 8, 16]} />
          <meshStandardMaterial
            color={piece.type === 'k' ? '#ffd45a' : '#d995ff'}
            emissive={piece.type === 'k' ? '#9b6512' : '#682c86'}
            emissiveIntensity={0.45}
          />
        </mesh>
      )}
    </group>
  )
}

// Preload every unit and prop, so the first capture doesn't stall on a download.
Object.values(UNITS).forEach((unit) => useGLTF.preload(unit.model, DRACO_PATH))
useGLTF.preload(PROP_URLS, DRACO_PATH)
