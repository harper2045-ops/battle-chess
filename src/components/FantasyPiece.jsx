import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationClip, AnimationMixer, LoopOnce, LoopRepeat } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

const PIECE_TYPES = ['k', 'q', 'b', 'n', 'r', 'p']

/**
 * Scale tuned for King's Gambit Ivory humanoids on a 1-unit square board.
 * Generated sculpts are roughly human height (~1.6–1.8 m). Target on-board
 * heights: pawn ~0.8, officers ~0.95, royals ~1.05–1.1 (similar to the
 * ainan9274/rork-medieval-3d-chess PIECE_HEIGHT tiers).
 */
const scaleByType = {
  p: 0.48,
  n: 0.56,
  b: 0.56,
  r: 0.55,
  q: 0.58,
  k: 0.62,
}

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
  const actor = useMemo(() => {
    const instance = clone(scene)

    instance.traverse((node) => {
      if (!node.isMesh) return
      node.castShadow = false
      node.receiveShadow = false
      if (node.material) {
        node.material = node.material.clone()
      }
    })

    return instance
  }, [scene])
  const mixer = useMemo(() => new AnimationMixer(actor), [actor])

  useEffect(() => {
    const clip = AnimationClip.findByName(animations, action)
    if (!clip) return undefined

    mixer.stopAllAction()
    const clipAction = mixer.clipAction(clip)
    clipAction.reset()
    clipAction.clampWhenFinished = action !== 'idle'
    clipAction.setLoop(
      action === 'idle' ? LoopRepeat : LoopOnce,
      action === 'idle' ? Infinity : 1,
    )
    // Desync idle so the army does not breathe in lockstep.
    if (action === 'idle') {
      clipAction.time = Math.random() * Math.min(0.45, clip.duration)
    }
    clipAction.play()

    return () => clipAction.stop()
  }, [action, animations, mixer])

  useFrame((_, delta) => {
    mixer.update(delta)
  })

  return (
    <group
      position-y={0.02}
      rotation-y={piece.color === 'b' ? Math.PI : 0}
      scale={scaleByType[piece.type]}
    >
      <primitive object={actor} dispose={null} />
      {/* Ring radii retuned for ~0.5–0.6 scale (was sized for Quaternius ~0.35). */}
      <mesh position-y={0.02} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.52, 0.64, 24]} />
        <meshBasicMaterial
          color={selected ? '#ffd45a' : teamColor[piece.color]}
          transparent
          opacity={selected ? 0.95 : 0.72}
        />
      </mesh>
      {(piece.type === 'q' || piece.type === 'k') && (
        // Crown marker sits just above a ~1.7-unit humanoid (was 4.2 for taller Quaternius units).
        <mesh position-y={1.95} rotation-x={Math.PI / 2}>
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
