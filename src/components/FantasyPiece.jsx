import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationClip, AnimationMixer, LoopOnce, LoopRepeat } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

// The free CC0 RPG pack has one distinct, rigged class for each chess role.
const actorByType = {
  p: { model: 'Ranger', attack: 'Bow_Shoot' },
  n: { model: 'Rogue', attack: 'Dagger_Attack' },
  b: { model: 'Cleric', attack: 'Staff_Attack' },
  r: { model: 'Monk', attack: 'Attack' },
  q: { model: 'Wizard', attack: 'Spell2' },
  k: { model: 'Warrior', attack: 'Sword_Attack' },
}

const scaleByType = {
  p: 0.32,
  n: 0.34,
  b: 0.34,
  r: 0.35,
  q: 0.36,
  k: 0.37,
}

const teamColor = {
  w: '#f2ddad',
  b: '#5978b8',
}

const clipByAction = {
  idle: 'Idle',
  hit: 'RecieveHit',
  death: 'Death',
}

export function FantasyPiece({ piece, selected = false, action = 'idle' }) {
  const config = actorByType[piece.type]
  const path = `/models/quaternius/${config.model}.gltf`
  const { scene, animations } = useGLTF(path)
  const actor = useMemo(() => {
    const instance = clone(scene)

    instance.traverse((node) => {
      if (!node.isMesh) return
      node.castShadow = false
      node.receiveShadow = false
      node.material = node.material.clone()
    })

    return instance
  }, [scene])
  const mixer = useMemo(() => new AnimationMixer(actor), [actor])

  useEffect(() => {
    const clipName = action === 'attack' ? config.attack : clipByAction[action]
    const clip = AnimationClip.findByName(animations, clipName)
    if (!clip) return undefined

    mixer.stopAllAction()
    const clipAction = mixer.clipAction(clip)
    clipAction.reset()
    clipAction.clampWhenFinished = action !== 'idle'
    clipAction.setLoop(
      action === 'idle' ? LoopRepeat : LoopOnce,
      action === 'idle' ? Infinity : 1,
    )
    clipAction.play()

    if (action === 'idle') mixer.setTime(0.45)

    return () => clipAction.stop()
  }, [action, animations, config.attack, mixer])

  useFrame((_, delta) => {
    if (action !== 'idle') mixer.update(delta)
  })

  return (
    <group
      position-y={0.02}
      rotation-y={piece.color === 'b' ? Math.PI : 0}
      scale={scaleByType[piece.type]}
    >
      <primitive object={actor} dispose={null} />
      <mesh position-y={0.035} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.74, 0.88, 24]} />
        <meshBasicMaterial
          color={selected ? '#ffd45a' : teamColor[piece.color]}
          transparent
          opacity={selected ? 0.95 : 0.72}
        />
      </mesh>
      {(piece.type === 'q' || piece.type === 'k') && (
        <mesh position-y={4.2} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.22, 0.06, 8, 16]} />
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

Object.values(actorByType).forEach(({ model }) =>
  useGLTF.preload(`/models/quaternius/${model}.gltf`),
)
