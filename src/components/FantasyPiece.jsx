import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { AnimationClip, AnimationMixer, Color } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

const modelByType = {
  p: '/models/kaykit/Rogue_Hooded.glb',
  n: '/models/kaykit/Knight.glb',
  b: '/models/kaykit/Mage.glb',
  r: '/models/kaykit/Barbarian.glb',
  q: '/models/kaykit/Mage.glb',
  k: '/models/kaykit/Knight.glb',
}

const scaleByType = {
  p: 0.38,
  n: 0.42,
  b: 0.42,
  r: 0.46,
  q: 0.47,
  k: 0.49,
}

const teamTint = {
  w: '#f1e6d2',
  b: '#667797',
}

export function FantasyPiece({ piece }) {
  const { scene, animations } = useGLTF(modelByType[piece.type])
  const actor = useMemo(() => {
    const instance = clone(scene)
    const tint = new Color(teamTint[piece.color])

    instance.traverse((node) => {
      if (!node.isMesh) return
      node.castShadow = false
      node.receiveShadow = false
      node.material = node.material.clone()
      node.material.color.multiply(tint)
    })

    const idle = AnimationClip.findByName(animations, 'Idle')
    if (idle) {
      const mixer = new AnimationMixer(instance)
      mixer.clipAction(idle).play()
      mixer.setTime(0.45)
    }

    return instance
  }, [animations, piece.color, scene])

  return (
    <group
      position-y={0.02}
      rotation-y={piece.color === 'b' ? Math.PI : 0}
      scale={scaleByType[piece.type]}
    >
      <primitive object={actor} dispose={null} />
      {(piece.type === 'q' || piece.type === 'k') && (
        <mesh position-y={2.32} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.2, 0.055, 8, 16]} />
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

Object.values(modelByType).forEach((path) => useGLTF.preload(path))
