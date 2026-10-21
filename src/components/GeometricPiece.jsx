import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

// Target heights for each piece type
const PIECE_HEIGHTS = {
  p: 0.78,
  n: 0.98,
  b: 1.0,
  r: 0.99,
  q: 1.0,
  k: 1.12,
}

function PieceModel({ type, color }) {
  const path = `/models/kings-gambit-ivory/${type}/${color}.glb`
  const { scene } = useGLTF(path)
  return <primitive object={scene} />
}

export function GeometricPiece({ piece, selected = false, action = 'idle', yaw }) {
  const groupRef = useRef()
  const animRef = useRef({ time: 0, phase: Math.random() * Math.PI * 2 })

  // Animation loop
  useFrame((_, delta) => {
    if (!groupRef.current) return
    animRef.current.time += delta

    const t = animRef.current.time
    const phase = animRef.current.phase

    switch (action) {
      case 'idle': {
        // Subtle breathing/swaying
        const breathe = Math.sin(t * 2 + phase) * 0.005
        groupRef.current.scale.set(1, 1 + breathe, 1)
        groupRef.current.rotation.y = Math.sin(t * 0.5 + phase) * 0.02
        break
      }

      case 'attack': {
        // Quick lunge forward
        const attackT = (t * 3) % 1
        if (attackT < 0.3) {
          const lunge = Math.sin(attackT * Math.PI / 0.3) * 0.1
          groupRef.current.position.z = -lunge
          groupRef.current.position.y = lunge * 0.5
        } else {
          groupRef.current.position.z = 0
          groupRef.current.position.y = 0
        }
        break
      }

      case 'death': {
        // Fall over
        const deathT = Math.min(t * 1.5, 1)
        groupRef.current.rotation.x = deathT * Math.PI / 2
        groupRef.current.position.y = (1 - deathT) * 0.1
        break
      }

      case 'walk': {
        // In-place bobbing
        const bob = Math.abs(Math.sin(t * 8 + phase)) * 0.02
        groupRef.current.position.y = bob
        break
      }

      default:
        break
    }
  })

  const facing = yaw ?? (piece.color === 'b' ? Math.PI : 0)
  const height = PIECE_HEIGHTS[piece.type]

  // Selection ring
  const ringColor = selected ? '#ffd45a' : piece.color === 'w' ? '#f2ddad' : '#5978b8'

  return (
    <group position-y={0.04} rotation-y={facing}>
      <group ref={groupRef} scale={height}>
        <PieceModel type={piece.type} color={piece.color} />
      </group>
      <mesh position-y={0.01} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.28, 0.36, 24]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={selected ? 0.95 : 0.72}
        />
      </mesh>
    </group>
  )
}
