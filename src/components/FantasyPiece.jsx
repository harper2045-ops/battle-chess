import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationClip, AnimationMixer, LoopOnce, LoopRepeat } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { normalizeIvoryActor } from './ivoryNormalize.js'

const PIECE_TYPES = ['k', 'q', 'b', 'n', 'r', 'p']

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

function assetPath(type, file) {
  return `/models/kings-gambit-ivory/${type}/${file}.glb`
}

/** Pull the first clip from an anim-only GLB and rename it for the mixer. */
function renameClip(gltf, name) {
  const source = gltf?.animations?.[0]
  if (!source) return null
  const clip = source.clone()
  clip.name = name
  return clip
}

/**
 * King's Gambit ships a rigged mesh GLB plus separate anim GLBs (one clip each).
 * Load the mesh from rigged.glb, then merge renamed clips from idle/attack/death/walk.
 * There is no dedicated hit take — reuse a short slice of idle (death as fallback).
 */
function useIvoryPiece(type) {
  const rigged = useGLTF(assetPath(type, 'rigged'))
  const idleGltf = useGLTF(assetPath(type, 'idle'))
  const attackGltf = useGLTF(assetPath(type, 'attack'))
  const deathGltf = useGLTF(assetPath(type, 'death'))
  const walkGltf = useGLTF(assetPath(type, 'walk'))

  const animations = useMemo(() => {
    const idle = renameClip(idleGltf, 'idle')
    const attack = renameClip(attackGltf, 'attack')
    const death = renameClip(deathGltf, 'death')
    const walk = renameClip(walkGltf, 'walk')

    let hit = null
    const hitSource = idle ?? death
    if (hitSource) {
      hit = hitSource.clone()
      hit.name = 'hit'
      // Short flinch for capture mid-beat (see getCaptureActions).
      hit.duration = Math.min(0.4, hit.duration)
    }

    return [idle, attack, death, hit, walk].filter(Boolean)
  }, [idleGltf, attackGltf, deathGltf, walkGltf])

  return { scene: rigged.scene, animations }
}

export function FantasyPiece({ piece, selected = false, action = 'idle' }) {
  const { scene, animations } = useIvoryPiece(piece.type)
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

    const { height } = normalizeIvoryActor(instance, piece.type)
    return { actor: instance, crownY: height + 0.08 }
  }, [scene, piece.type])

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

  return (
    <group
      position-y={BOARD_SURFACE_Y}
      rotation-y={piece.color === 'b' ? Math.PI : 0}
    >
      <primitive object={actor} dispose={null} />
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

// Preload all six rigged meshes and their clip GLBs.
PIECE_TYPES.forEach((type) => {
  ;['rigged', 'idle', 'attack', 'death', 'walk'].forEach((file) => {
    useGLTF.preload(assetPath(type, file))
  })
})
