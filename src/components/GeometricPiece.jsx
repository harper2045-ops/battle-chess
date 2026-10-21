import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Material presets for each piece color
const MATERIALS = {
  w: {
    primary: { color: '#f5f0e8', metalness: 0.15, roughness: 0.4 },
    accent: { color: '#d4af37', metalness: 0.8, roughness: 0.2 }, // Gold accents
    dark: { color: '#8b7355', metalness: 0.3, roughness: 0.6 },
  },
  b: {
    primary: { color: '#2a2f35', metalness: 0.2, roughness: 0.45 },
    accent: { color: '#c0c0c0', metalness: 0.85, roughness: 0.15 }, // Silver accents
    dark: { color: '#1a1f25', metalness: 0.3, roughness: 0.6 },
  },
}

// Target heights for each piece type
const PIECE_HEIGHTS = {
  p: 0.78,
  n: 0.98,
  b: 1.0,
  r: 0.99,
  q: 1.0,
  k: 1.12,
}

function PieceMesh({ type, color }) {
  const mat = MATERIALS[color]

  // Shared base for all pieces
  const Base = () => (
    <group>
      {/* Bottom disc */}
      <mesh position-y={0.025}>
        <cylinderGeometry args={[0.19, 0.2, 0.05, 32]} />
        <meshStandardMaterial {...mat.dark} />
      </mesh>
      {/* Gold/silver trim ring */}
      <mesh position-y={0.055}>
        <cylinderGeometry args={[0.17, 0.17, 0.01, 32]} />
        <meshStandardMaterial {...mat.accent} />
      </mesh>
    </group>
  )

  switch (type) {
    case 'p': {
      // Pawn: Classic chess pawn shape
      return (
        <group>
          <Base />
          {/* Tapered body */}
          <mesh position-y={0.18}>
            <cylinderGeometry args={[0.06, 0.1, 0.25, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Collar */}
          <mesh position-y={0.32}>
            <cylinderGeometry args={[0.08, 0.06, 0.02, 16]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
          {/* Head */}
          <mesh position-y={0.4}>
            <sphereGeometry args={[0.085, 24, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
        </group>
      )
    }

    case 'n': {
      // Knight: Horse head profile
      return (
        <group>
          <Base />
          {/* Body */}
          <mesh position-y={0.15}>
            <cylinderGeometry args={[0.07, 0.1, 0.2, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Neck */}
          <mesh position={[0, 0.3, 0.02]} rotation-x={-0.4}>
            <cylinderGeometry args={[0.05, 0.07, 0.18, 12]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.4, 0.06]} rotation-x={-0.2}>
            <boxGeometry args={[0.08, 0.06, 0.14]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Snout */}
          <mesh position={[0, 0.38, 0.14]}>
            <boxGeometry args={[0.06, 0.04, 0.06]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Ear */}
          <mesh position={[0.02, 0.44, 0.04]} rotation-z={0.3}>
            <coneGeometry args={[0.015, 0.04, 6]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Mane accent */}
          <mesh position={[0, 0.38, -0.02]} rotation-x={-0.3}>
            <boxGeometry args={[0.03, 0.1, 0.02]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
        </group>
      )
    }

    case 'b': {
      // Bishop: Tall with mitre (slit top)
      return (
        <group>
          <Base />
          {/* Body */}
          <mesh position-y={0.2}>
            <cylinderGeometry args={[0.06, 0.1, 0.3, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Collar */}
          <mesh position-y={0.36}>
            <cylinderGeometry args={[0.07, 0.06, 0.015, 16]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
          {/* Mitre base */}
          <mesh position-y={0.42}>
            <cylinderGeometry args={[0.05, 0.07, 0.1, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Mitre top (pointed) */}
          <mesh position-y={0.52}>
            <coneGeometry args={[0.05, 0.12, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Slit */}
          <mesh position={[0, 0.52, 0]}>
            <boxGeometry args={[0.01, 0.08, 0.06]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
          {/* Cross on top */}
          <mesh position-y={0.58}>
            <boxGeometry args={[0.015, 0.04, 0.015]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
        </group>
      )
    }

    case 'r': {
      // Rook: Castle tower with crenellations
      return (
        <group>
          <Base />
          {/* Tower body */}
          <mesh position-y={0.2}>
            <cylinderGeometry args={[0.08, 0.1, 0.3, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Band */}
          <mesh position-y={0.36}>
            <cylinderGeometry args={[0.085, 0.085, 0.015, 16]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
          {/* Top platform */}
          <mesh position-y={0.4}>
            <cylinderGeometry args={[0.09, 0.08, 0.03, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Crenellations (4 battlements) */}
          {[0, 1, 2, 3].map((i) => {
            const angle = (i * Math.PI) / 2
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * 0.07, 0.44, Math.sin(angle) * 0.07]}
              >
                <boxGeometry args={[0.04, 0.06, 0.04]} />
                <meshStandardMaterial {...mat.primary} />
              </mesh>
            )
          })}
        </group>
      )
    }

    case 'q': {
      // Queen: Tall with crown
      return (
        <group>
          <Base />
          {/* Body */}
          <mesh position-y={0.22}>
            <cylinderGeometry args={[0.06, 0.1, 0.35, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Collar */}
          <mesh position-y={0.4}>
            <cylinderGeometry args={[0.07, 0.06, 0.015, 16]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
          {/* Crown base */}
          <mesh position-y={0.45}>
            <cylinderGeometry args={[0.07, 0.06, 0.04, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Crown rim */}
          <mesh position-y={0.48}>
            <cylinderGeometry args={[0.075, 0.07, 0.015, 16]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
          {/* Crown spikes (5 points) */}
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i * Math.PI * 2) / 5
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * 0.06, 0.53, Math.sin(angle) * 0.06]}
              >
                <coneGeometry args={[0.015, 0.08, 8]} />
                <meshStandardMaterial {...mat.accent} />
              </mesh>
            )
          })}
          {/* Center jewel */}
          <mesh position-y={0.52}>
            <sphereGeometry args={[0.025, 12, 8]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
        </group>
      )
    }

    case 'k': {
      // King: Tallest with cross-topped crown
      return (
        <group>
          <Base />
          {/* Body */}
          <mesh position-y={0.24}>
            <cylinderGeometry args={[0.07, 0.11, 0.38, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Collar */}
          <mesh position-y={0.44}>
            <cylinderGeometry args={[0.08, 0.07, 0.015, 16]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
          {/* Crown base */}
          <mesh position-y={0.5}>
            <cylinderGeometry args={[0.08, 0.07, 0.05, 16]} />
            <meshStandardMaterial {...mat.primary} />
          </mesh>
          {/* Crown rim */}
          <mesh position-y={0.54}>
            <cylinderGeometry args={[0.085, 0.08, 0.015, 16]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
          {/* Cross vertical */}
          <mesh position-y={0.62}>
            <boxGeometry args={[0.02, 0.14, 0.02]} />
            <meshStandardMaterial {...mat.accent} />
          </mesh>
          {/* Cross horizontal */}
          <mesh position-y={0.66}>
            <boxGeometry args={[0.06, 0.02, 0.02]} />
            <meshStandardMaterial {...mat.accent} />
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
  const height = PIECE_HEIGHTS[piece.type]

  // Selection ring
  const ringColor = selected ? '#ffd45a' : piece.color === 'w' ? '#f2ddad' : '#5978b8'

  return (
    <group position-y={0.04} rotation-y={facing}>
      <group ref={groupRef} scale={height}>
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
