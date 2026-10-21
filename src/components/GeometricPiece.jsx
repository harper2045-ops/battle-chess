import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

// High-quality PBR material presets
const MATERIALS = {
  w: {
    // White pieces: warm ivory with gold accents
    ivory: { color: '#f8f4e8', metalness: 0.05, roughness: 0.35, envMapIntensity: 0.8 },
    gold: { color: '#d4af37', metalness: 0.9, roughness: 0.15, envMapIntensity: 1.2 },
    shadow: { color: '#c8bfa8', metalness: 0.1, roughness: 0.5 },
  },
  b: {
    // Black pieces: deep ebony with silver accents
    ebony: { color: '#1a1f25', metalness: 0.15, roughness: 0.3, envMapIntensity: 0.9 },
    silver: { color: '#e8e8e8', metalness: 0.95, roughness: 0.1, envMapIntensity: 1.3 },
    shadow: { color: '#0f1215', metalness: 0.2, roughness: 0.5 },
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
  const body = mat[color === 'w' ? 'ivory' : 'ebony']
  const accent = mat[color === 'w' ? 'gold' : 'silver']
  const shadow = mat.shadow

  // Shared detailed base with beveled edges
  const Base = () => (
    <group>
      {/* Bottom disc with bevel */}
      <mesh position-y={0.02}>
        <cylinderGeometry args={[0.19, 0.2, 0.04, 48]} />
        <meshStandardMaterial {...shadow} />
      </mesh>
      {/* Accent ring */}
      <mesh position-y={0.045}>
        <cylinderGeometry args={[0.175, 0.175, 0.012, 48]} />
        <meshStandardMaterial {...accent} />
      </mesh>
      {/* Upper base */}
      <mesh position-y={0.06}>
        <cylinderGeometry args={[0.16, 0.17, 0.02, 48]} />
        <meshStandardMaterial {...body} />
      </mesh>
    </group>
  )

  switch (type) {
    case 'p': {
      // Pawn: Classic Staunton design
      return (
        <group>
          <Base />
          {/* Tapered body */}
          <mesh position-y={0.16}>
            <cylinderGeometry args={[0.055, 0.09, 0.2, 32]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Collar */}
          <mesh position-y={0.27}>
            <cylinderGeometry args={[0.07, 0.055, 0.015, 32]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          {/* Shoulder */}
          <mesh position-y={0.31}>
            <sphereGeometry args={[0.065, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Head */}
          <mesh position-y={0.38}>
            <sphereGeometry args={[0.075, 32, 24]} />
            <meshStandardMaterial {...body} />
          </mesh>
        </group>
      )
    }

    case 'n': {
      // Knight: Detailed horse head
      return (
        <group>
          <Base />
          {/* Body */}
          <mesh position-y={0.12}>
            <cylinderGeometry args={[0.065, 0.095, 0.16, 32]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Neck (angled) */}
          <mesh position={[0, 0.26, 0.02]} rotation-x={-0.45}>
            <cylinderGeometry args={[0.045, 0.065, 0.16, 24]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.36, 0.06]} rotation-x={-0.15}>
            <boxGeometry args={[0.07, 0.055, 0.12]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Snout */}
          <mesh position={[0, 0.34, 0.14]} rotation-x={0.1}>
            <boxGeometry args={[0.055, 0.04, 0.05]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Nostril */}
          <mesh position={[0.02, 0.33, 0.165]}>
            <sphereGeometry args={[0.008, 8, 6]} />
            <meshStandardMaterial {...shadow} />
          </mesh>
          <mesh position={[-0.02, 0.33, 0.165]}>
            <sphereGeometry args={[0.008, 8, 6]} />
            <meshStandardMaterial {...shadow} />
          </mesh>
          {/* Eye */}
          <mesh position={[0.035, 0.37, 0.1]}>
            <sphereGeometry args={[0.008, 8, 6]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          {/* Ear */}
          <mesh position={[0.015, 0.4, 0.05]} rotation-z={0.25} rotation-x={-0.2}>
            <coneGeometry args={[0.012, 0.035, 8]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Mane (accent) */}
          <mesh position={[0, 0.34, -0.02]} rotation-x={-0.3}>
            <boxGeometry args={[0.025, 0.09, 0.015]} />
            <meshStandardMaterial {...accent} />
          </mesh>
        </group>
      )
    }

    case 'b': {
      // Bishop: Tall mitre with slit
      return (
        <group>
          <Base />
          {/* Body */}
          <mesh position-y={0.18}>
            <cylinderGeometry args={[0.055, 0.09, 0.26, 32]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Collar */}
          <mesh position-y={0.32}>
            <cylinderGeometry args={[0.065, 0.055, 0.012, 32]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          {/* Mitre base */}
          <mesh position-y={0.38}>
            <cylinderGeometry args={[0.045, 0.06, 0.08, 32]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Mitre top (pointed) */}
          <mesh position-y={0.48}>
            <coneGeometry args={[0.045, 0.14, 32]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Slit (accent) */}
          <mesh position={[0, 0.48, 0]}>
            <boxGeometry args={[0.008, 0.1, 0.05]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          {/* Cross on top */}
          <mesh position-y={0.56}>
            <boxGeometry args={[0.012, 0.035, 0.012]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          <mesh position-y={0.58}>
            <boxGeometry args={[0.035, 0.012, 0.012]} />
            <meshStandardMaterial {...accent} />
          </mesh>
        </group>
      )
    }

    case 'r': {
      // Rook: Castle tower with detailed crenellations
      return (
        <group>
          <Base />
          {/* Tower body */}
          <mesh position-y={0.18}>
            <cylinderGeometry args={[0.075, 0.095, 0.28, 32]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Decorative band */}
          <mesh position-y={0.34}>
            <cylinderGeometry args={[0.08, 0.08, 0.012, 32]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          {/* Top platform */}
          <mesh position-y={0.38}>
            <cylinderGeometry args={[0.085, 0.075, 0.025, 32]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Crenellations (8 battlements) */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const angle = (i * Math.PI) / 4
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * 0.065, 0.42, Math.sin(angle) * 0.065]}
                rotation-y={-angle}
              >
                <boxGeometry args={[0.035, 0.05, 0.035]} />
                <meshStandardMaterial {...body} />
              </mesh>
            )
          })}
        </group>
      )
    }

    case 'q': {
      // Queen: Elegant crown with jewels
      return (
        <group>
          <Base />
          {/* Body */}
          <mesh position-y={0.2}>
            <cylinderGeometry args={[0.055, 0.09, 0.32, 32]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Collar */}
          <mesh position-y={0.37}>
            <cylinderGeometry args={[0.065, 0.055, 0.012, 32]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          {/* Crown base */}
          <mesh position-y={0.42}>
            <cylinderGeometry args={[0.065, 0.055, 0.04, 32]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Crown rim */}
          <mesh position-y={0.46}>
            <cylinderGeometry args={[0.07, 0.065, 0.012, 32]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          {/* Crown spikes (8 points) */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const angle = (i * Math.PI * 2) / 8
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * 0.055, 0.51, Math.sin(angle) * 0.055]}
              >
                <coneGeometry args={[0.012, 0.07, 12]} />
                <meshStandardMaterial {...accent} />
              </mesh>
            )
          })}
          {/* Center jewel */}
          <mesh position-y={0.5}>
            <sphereGeometry args={[0.022, 16, 12]} />
            <meshStandardMaterial {...accent} />
          </mesh>
        </group>
      )
    }

    case 'k': {
      // King: Majestic cross-topped crown
      return (
        <group>
          <Base />
          {/* Body */}
          <mesh position-y={0.22}>
            <cylinderGeometry args={[0.065, 0.1, 0.35, 32]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Collar */}
          <mesh position-y={0.4}>
            <cylinderGeometry args={[0.075, 0.065, 0.012, 32]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          {/* Crown base */}
          <mesh position-y={0.46}>
            <cylinderGeometry args={[0.075, 0.065, 0.045, 32]} />
            <meshStandardMaterial {...body} />
          </mesh>
          {/* Crown rim */}
          <mesh position-y={0.51}>
            <cylinderGeometry args={[0.08, 0.075, 0.012, 32]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          {/* Cross vertical */}
          <mesh position-y={0.6}>
            <boxGeometry args={[0.018, 0.15, 0.018]} />
            <meshStandardMaterial {...accent} />
          </mesh>
          {/* Cross horizontal */}
          <mesh position-y={0.64}>
            <boxGeometry args={[0.055, 0.018, 0.018]} />
            <meshStandardMaterial {...accent} />
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
