import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'

const PIECE_COLORS = {
  w: { primary: '#f5f0e8', accent: '#8b7355' },
  b: { primary: '#3a3f47', accent: '#6b7280' },
}

function PieceMesh({ type, color }) {
  const colors = PIECE_COLORS[color]

  // Base platform for all pieces
  const base = (
    <mesh position-y={0.03}>
      <cylinderGeometry args={[0.18, 0.2, 0.06, 16]} />
      <meshStandardMaterial color={colors.accent} metalness={0.5} roughness={0.4} />
    </mesh>
  )

  switch (type) {
    case 'p': {
      // Pawn: sphere head on cylinder body
      return (
        <group>
          {base}
          <mesh position-y={0.21}>
            <cylinderGeometry args={[0.08, 0.1, 0.3, 12]} />
            <meshStandardMaterial color={colors.primary} metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position-y={0.42}>
            <sphereGeometry args={[0.09, 16, 12]} />
            <meshStandardMaterial color={colors.primary} metalness={0.3} roughness={0.6} />
          </mesh>
        </group>
      )
    }

    case 'n': {
      // Knight: horse-like shape
      return (
        <group>
          {base}
          <mesh position-y={0.19}>
            <cylinderGeometry args={[0.09, 0.11, 0.25, 12]} />
            <meshStandardMaterial color={colors.primary} metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.35, 0.03]} rotation-x={-0.3}>
            <boxGeometry args={[0.12, 0.08, 0.15]} />
            <meshStandardMaterial color={colors.primary} metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.38, -0.02]}>
            <boxGeometry args={[0.04, 0.12, 0.1]} />
            <meshStandardMaterial color={colors.accent} metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      )
    }

    case 'b': {
      // Bishop: tall with mitre
      return (
        <group>
          {base}
          <mesh position-y={0.24}>
            <cylinderGeometry args={[0.07, 0.1, 0.35, 12]} />
            <meshStandardMaterial color={colors.primary} metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position-y={0.48}>
            <coneGeometry args={[0.09, 0.15, 8]} />
            <meshStandardMaterial color={colors.primary} metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.01, 0.06, 0.08]} />
            <meshStandardMaterial color={colors.accent} metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      )
    }

    case 'r': {
      // Rook: castle tower with crenellations
      return (
        <group>
          {base}
          <mesh position-y={0.24}>
            <cylinderGeometry args={[0.1, 0.11, 0.35, 12]} />
            <meshStandardMaterial color={colors.primary} metalness={0.3} roughness={0.6} />
          </mesh>
          {[0, 1, 2, 3].map((i) => {
            const angle = (i * Math.PI) / 2
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * 0.08, 0.45, Math.sin(angle) * 0.08]}
              >
                <boxGeometry args={[0.04, 0.05, 0.04]} />
                <meshStandardMaterial color={colors.accent} metalness={0.5} roughness={0.4} />
              </mesh>
            )
          })}
        </group>
      )
    }

    case 'q': {
      // Queen: tall with crown
      return (
        <group>
          {base}
          <mesh position-y={0.26}>
            <cylinderGeometry args={[0.07, 0.1, 0.4, 12]} />
            <meshStandardMaterial color={colors.primary} metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position-y={0.49}>
            <cylinderGeometry args={[0.1, 0.08, 0.06, 12]} />
            <meshStandardMaterial color={colors.accent} metalness={0.5} roughness={0.4} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i * Math.PI * 2) / 5
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * 0.08, 0.56, Math.sin(angle) * 0.08]}
              >
                <coneGeometry args={[0.02, 0.08, 6]} />
                <meshStandardMaterial color={colors.accent} metalness={0.5} roughness={0.4} />
              </mesh>
            )
          })}
        </group>
      )
    }

    case 'k': {
      // King: tallest with cross
      return (
        <group>
          {base}
          <mesh position-y={0.27}>
            <cylinderGeometry args={[0.08, 0.11, 0.42, 12]} />
            <meshStandardMaterial color={colors.primary} metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position-y={0.51}>
            <cylinderGeometry args={[0.11, 0.09, 0.07, 12]} />
            <meshStandardMaterial color={colors.accent} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position-y={0.6}>
            <boxGeometry args={[0.02, 0.12, 0.02]} />
            <meshStandardMaterial color={colors.accent} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position-y={0.63}>
            <boxGeometry args={[0.06, 0.02, 0.02]} />
            <meshStandardMaterial color={colors.accent} metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      )
    }

    default:
      return null
  }
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

  // Selection ring
  const ringColor = selected ? '#ffd45a' : piece.color === 'w' ? '#f2ddad' : '#5978b8'

  return (
    <group position-y={0.04} rotation-y={facing}>
      <group ref={groupRef}>
        <PieceMesh type={piece.type} color={piece.color} />
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
