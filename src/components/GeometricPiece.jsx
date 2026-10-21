import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const PIECE_COLORS = {
  w: { primary: '#f5f0e8', secondary: '#d4c5a9', accent: '#8b7355' },
  b: { primary: '#3a3f47', secondary: '#2a2f35', accent: '#6b7280' },
}

const PIECE_SIZES = {
  p: 0.6,
  n: 0.8,
  b: 0.85,
  r: 0.9,
  q: 0.95,
  k: 1.0,
}

/**
 * Build a chess piece from Three.js primitives.
 * Each piece type has a distinct silhouette.
 */
function buildPiece(type, color) {
  const group = new THREE.Group()
  const colors = PIECE_COLORS[color]
  const size = PIECE_SIZES[type]

  const baseMat = new THREE.MeshStandardMaterial({
    color: colors.primary,
    metalness: 0.3,
    roughness: 0.6,
  })

  const accentMat = new THREE.MeshStandardMaterial({
    color: colors.accent,
    metalness: 0.5,
    roughness: 0.4,
  })

  // Base platform for all pieces
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * size, 0.2 * size, 0.06 * size, 16),
    accentMat
  )
  base.position.y = 0.03 * size
  group.add(base)

  switch (type) {
    case 'p': {
      // Pawn: simple sphere head on cylinder body
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * size, 0.1 * size, 0.3 * size, 12),
        baseMat
      )
      body.position.y = 0.21 * size
      group.add(body)

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.09 * size, 16, 12),
        baseMat
      )
      head.position.y = 0.42 * size
      group.add(head)
      break
    }

    case 'n': {
      // Knight: horse-like shape using stacked shapes
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09 * size, 0.11 * size, 0.25 * size, 12),
        baseMat
      )
      body.position.y = 0.19 * size
      group.add(body)

      // Head (angled)
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.12 * size, 0.08 * size, 0.15 * size),
        baseMat
      )
      head.position.set(0, 0.35 * size, 0.03 * size)
      head.rotation.x = -0.3
      group.add(head)

      // Mane
      const mane = new THREE.Mesh(
        new THREE.BoxGeometry(0.04 * size, 0.12 * size, 0.1 * size),
        accentMat
      )
      mane.position.set(0, 0.38 * size, -0.02 * size)
      group.add(mane)
      break
    }

    case 'b': {
      // Bishop: tall with slit top
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07 * size, 0.1 * size, 0.35 * size, 12),
        baseMat
      )
      body.position.y = 0.24 * size
      group.add(body)

      // Mitre (pointed hat)
      const mitre = new THREE.Mesh(
        new THREE.ConeGeometry(0.09 * size, 0.15 * size, 8),
        baseMat
      )
      mitre.position.y = 0.48 * size
      group.add(mitre)

      // Slit
      const slit = new THREE.Mesh(
        new THREE.BoxGeometry(0.01 * size, 0.06 * size, 0.08 * size),
        accentMat
      )
      slit.position.set(0, 0.5 * size, 0)
      group.add(slit)
      break
    }

    case 'r': {
      // Rook: castle tower with crenellations
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1 * size, 0.11 * size, 0.35 * size, 12),
        baseMat
      )
      body.position.y = 0.24 * size
      group.add(body)

      // Crenellations (4 small boxes on top)
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2
        const cren = new THREE.Mesh(
          new THREE.BoxGeometry(0.04 * size, 0.05 * size, 0.04 * size),
          accentMat
        )
        cren.position.set(
          Math.cos(angle) * 0.08 * size,
          0.45 * size,
          Math.sin(angle) * 0.08 * size
        )
        group.add(cren)
      }
      break
    }

    case 'q': {
      // Queen: tall with crown
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07 * size, 0.1 * size, 0.4 * size, 12),
        baseMat
      )
      body.position.y = 0.26 * size
      group.add(body)

      // Crown base
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1 * size, 0.08 * size, 0.06 * size, 12),
        accentMat
      )
      crown.position.y = 0.49 * size
      group.add(crown)

      // Crown spikes
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.02 * size, 0.08 * size, 6),
          accentMat
        )
        spike.position.set(
          Math.cos(angle) * 0.08 * size,
          0.56 * size,
          Math.sin(angle) * 0.08 * size
        )
        group.add(spike)
      }
      break
    }

    case 'k': {
      // King: tallest with cross
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * size, 0.11 * size, 0.42 * size, 12),
        baseMat
      )
      body.position.y = 0.27 * size
      group.add(body)

      // Crown
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11 * size, 0.09 * size, 0.07 * size, 12),
        accentMat
      )
      crown.position.y = 0.51 * size
      group.add(crown)

      // Cross
      const crossV = new THREE.Mesh(
        new THREE.BoxGeometry(0.02 * size, 0.12 * size, 0.02 * size),
        accentMat
      )
      crossV.position.y = 0.6 * size
      group.add(crossV)

      const crossH = new THREE.Mesh(
        new THREE.BoxGeometry(0.06 * size, 0.02 * size, 0.02 * size),
        accentMat
      )
      crossH.position.y = 0.63 * size
      group.add(crossH)
      break
    }
  }

  return group
}

export function GeometricPiece({ piece, selected = false, action = 'idle', yaw }) {
  const meshRef = useRef()
  const animRef = useRef({ time: 0, phase: Math.random() * Math.PI * 2 })

  // Build the piece mesh once
  const mesh = useMemo(() => {
    return buildPiece(piece.type, piece.color)
  }, [piece.type, piece.color])

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.clear()
      meshRef.current.add(mesh)
    }
  }, [mesh])

  // Animation loop
  useFrame((_, delta) => {
    if (!meshRef.current) return
    animRef.current.time += delta

    const t = animRef.current.time
    const phase = animRef.current.phase

    switch (action) {
      case 'idle': {
        // Subtle breathing/swaying
        const breathe = Math.sin(t * 2 + phase) * 0.005
        meshRef.current.scale.set(1, 1 + breathe, 1)
        meshRef.current.rotation.y = Math.sin(t * 0.5 + phase) * 0.02
        break
      }

      case 'attack': {
        // Quick lunge forward
        const attackT = (t * 3) % 1
        if (attackT < 0.3) {
          // Lunge
          const lunge = Math.sin(attackT * Math.PI / 0.3) * 0.1
          meshRef.current.position.z = -lunge
          meshRef.current.position.y = lunge * 0.5
        } else {
          // Return
          meshRef.current.position.z = 0
          meshRef.current.position.y = 0
        }
        break
      }

      case 'death': {
        // Fall over
        const deathT = Math.min(t * 1.5, 1)
        meshRef.current.rotation.x = deathT * Math.PI / 2
        meshRef.current.position.y = (1 - deathT) * 0.1
        break
      }

      case 'walk': {
        // In-place bobbing
        const bob = Math.abs(Math.sin(t * 8 + phase)) * 0.02
        meshRef.current.position.y = bob
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
      <primitive ref={meshRef} object={mesh} />
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
