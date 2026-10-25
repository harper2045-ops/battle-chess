import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Cache loaded source scenes; each rendered piece receives its own object clone.
const modelCache = {}

function PieceModel({ type, color, onLoaded }) {
  const [scene, setScene] = useState(null)
  const path = `/models/kings-gambit-ivory/${type}/${color}.glb`
  const model = useMemo(() => scene?.clone(true), [scene])

  useEffect(() => {
    if (modelCache[path]) {
      setScene(modelCache[path])
      onLoaded?.()
      return
    }

    const loader = new GLTFLoader()
    loader.load(
      path,
      (gltf) => {
        modelCache[path] = gltf.scene
        setScene(gltf.scene)
        onLoaded?.()
      },
      undefined,
      (error) => {
        console.error(`Failed to load ${path}:`, error)
      }
    )
  }, [path, onLoaded])

  if (!model) return null
  return <primitive object={model} />
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
  const ringColor = selected ? '#ffd45a' : piece.color === 'w' ? '#27a8ff' : '#ff6a2a'

  return (
    <group position-y={0.04} rotation-y={facing}>
      <group ref={groupRef}>
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
