import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  captureDuration,
  getCaptureActions,
  getCaptureAttackerPiece,
  getCapturePose,
  squareToWorld,
} from '../battle/captureAnimation.js'
import {
  getQuietMoveAction,
  getQuietMovePose,
  getQuietMoveYaw,
  quietMoveDuration,
} from '../battle/moveAnimation.js'
import { FantasyPiece } from './FantasyPiece.jsx'
import {
  isLastMoveSquare,
  squareHighlightColor,
} from '../game/lastMove.js'

const pieceNames = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}

function Material({ color, selected = false }) {
  return (
    <meshStandardMaterial
      color={color === 'w' ? '#eadfca' : '#303846'}
      emissive={selected ? '#d39a31' : '#000000'}
      emissiveIntensity={selected ? 0.55 : 0}
      metalness={0.25}
      roughness={0.5}
    />
  )
}

function ProceduralPiece({ piece, selected = false }) {
  const material = { color: piece.color, selected }

  return (
    <group scale={0.78} rotation-y={piece.color === 'b' ? Math.PI : 0}>
      <mesh position-y={0.1} castShadow>
        <cylinderGeometry args={[0.38, 0.43, 0.2, 20]} />
        <Material {...material} />
      </mesh>
      <mesh position-y={0.27} castShadow>
        <cylinderGeometry args={[0.29, 0.35, 0.14, 20]} />
        <Material {...material} />
      </mesh>

      {piece.type === 'p' && (
        <>
          <mesh position-y={0.57} castShadow>
            <coneGeometry args={[0.22, 0.55, 20]} />
            <Material {...material} />
          </mesh>
          <mesh position-y={0.9} castShadow>
            <sphereGeometry args={[0.19, 20, 14]} />
            <Material {...material} />
          </mesh>
        </>
      )}

      {piece.type === 'r' && (
        <>
          <mesh position-y={0.62} castShadow>
            <cylinderGeometry args={[0.26, 0.31, 0.72, 12]} />
            <Material {...material} />
          </mesh>
          <mesh position-y={1.02} castShadow>
            <boxGeometry args={[0.62, 0.22, 0.62]} />
            <Material {...material} />
          </mesh>
        </>
      )}

      {piece.type === 'n' && (
        <>
          <mesh position={[0, 0.62, 0.02]} rotation-x={-0.18} castShadow>
            <coneGeometry args={[0.32, 0.74, 8]} />
            <Material {...material} />
          </mesh>
          <mesh position={[0, 0.95, -0.14]} rotation-x={0.32} castShadow>
            <boxGeometry args={[0.38, 0.5, 0.3]} />
            <Material {...material} />
          </mesh>
          <mesh position={[0, 1.08, -0.31]} rotation-x={Math.PI / 2} castShadow>
            <coneGeometry args={[0.2, 0.36, 8]} />
            <Material {...material} />
          </mesh>
        </>
      )}

      {piece.type === 'b' && (
        <>
          <mesh position-y={0.66} castShadow>
            <coneGeometry args={[0.33, 0.82, 20]} />
            <Material {...material} />
          </mesh>
          <mesh position-y={1.13} castShadow>
            <sphereGeometry args={[0.2, 20, 14]} />
            <Material {...material} />
          </mesh>
        </>
      )}

      {(piece.type === 'q' || piece.type === 'k') && (
        <>
          <mesh position-y={0.7} castShadow>
            <coneGeometry args={[0.36, 0.9, 24]} />
            <Material {...material} />
          </mesh>
          <mesh position-y={1.14} castShadow>
            <cylinderGeometry args={[0.26, 0.2, 0.2, 12]} />
            <Material {...material} />
          </mesh>
          {piece.type === 'q' ? (
            <mesh position-y={1.36} castShadow>
              <sphereGeometry args={[0.15, 16, 12]} />
              <Material {...material} />
            </mesh>
          ) : (
            <group position-y={1.38}>
              <mesh castShadow>
                <boxGeometry args={[0.12, 0.42, 0.12]} />
                <Material {...material} />
              </mesh>
              <mesh position-y={0.06} castShadow>
                <boxGeometry args={[0.36, 0.11, 0.12]} />
                <Material {...material} />
              </mesh>
            </group>
          )}
        </>
      )}
    </group>
  )
}

function Piece({ piece, selected = false, action = 'idle', yaw }) {
  return (
    <Suspense fallback={<ProceduralPiece piece={piece} selected={selected} />}>
      <FantasyPiece piece={piece} selected={selected} action={action} yaw={yaw} />
    </Suspense>
  )
}

function Camera({ orientation }) {
  const { camera, invalidate } = useThree()

  useEffect(() => {
    camera.position.set(0, 8.4, orientation === 'w' ? 8.8 : -8.8)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, orientation])

  return null
}

function CaptureActors({ event, onComplete, reducedMotion }) {
  const attacker = useRef()
  const defender = useRef()
  const elapsed = useRef(0)
  const done = useRef(false)
  const [actions, setActions] = useState(() =>
    getCaptureActions(0, reducedMotion),
  )
  const [attackerPiece, setAttackerPiece] = useState(() =>
    getCaptureAttackerPiece(event, 0),
  )

  useFrame((_, delta) => {
    if (done.current) return

    elapsed.current += delta * 1000
    const duration = reducedMotion ? 80 : captureDuration
    const progress = Math.min(1, elapsed.current / duration)
    const pose = getCapturePose(event, progress)
    const nextActions = getCaptureActions(progress, reducedMotion)
    const nextAttacker = getCaptureAttackerPiece(event, progress)

    setActions((current) =>
      current.attacker === nextActions.attacker &&
      current.defender === nextActions.defender
        ? current
        : nextActions,
    )
    setAttackerPiece((current) =>
      current.type === nextAttacker.type && current.color === nextAttacker.color
        ? current
        : nextAttacker,
    )

    attacker.current.position.set(...pose.attacker)
    defender.current.position.set(...pose.defender)
    defender.current.rotation.z = pose.defenderRotation
    defender.current.scale.setScalar(pose.defenderScale)

    if (progress === 1) {
      done.current = true
      onComplete(event.id)
    }
  })

  return (
    <>
      <group ref={attacker} position={squareToWorld(event.from)}>
        <Piece piece={attackerPiece} action={actions.attacker} />
      </group>
      <group ref={defender} position={squareToWorld(event.defenderSquare)}>
        <Piece piece={event.defender} action={actions.defender} />
      </group>
    </>
  )
}


function MoveActor({ move, onFinished, reducedMotion }) {
  const actor = useRef()
  const elapsed = useRef(0)
  const done = useRef(false)
  const [action, setAction] = useState(() =>
    getQuietMoveAction(0, reducedMotion),
  )
  const [yaw, setYaw] = useState(() =>
    getQuietMoveYaw(move, 0, move.piece.color),
  )

  useFrame((_, delta) => {
    if (done.current) return

    elapsed.current += delta * 1000
    const duration = quietMoveDuration(move.from, move.to, reducedMotion)
    const progress = Math.min(1, elapsed.current / duration)
    const pose = getQuietMovePose(move, progress)
    const nextAction = getQuietMoveAction(progress, reducedMotion)
    const nextYaw = getQuietMoveYaw(move, progress, move.piece.color)

    setAction((current) => (current === nextAction ? current : nextAction))
    setYaw((current) =>
      Math.abs(current - nextYaw) < 1e-4 ? current : nextYaw,
    )

    actor.current.position.set(...pose)

    if (progress === 1) {
      done.current = true
      onFinished()
    }
  })

  return (
    <group ref={actor} position={squareToWorld(move.from)}>
      <Piece piece={move.piece} action={action} yaw={yaw} />
    </group>
  )
}

/** Primary mover plus castling rook companion; completes when all finish. */
function QuietMoveActors({ event, onComplete, reducedMotion }) {
  const pending = useRef(1 + (event.companions?.length ?? 0))
  const finished = useRef(false)

  const onFinished = () => {
    pending.current -= 1
    if (pending.current <= 0 && !finished.current) {
      finished.current = true
      onComplete(event.id)
    }
  }

  const movers = [
    { piece: event.piece, from: event.from, to: event.to },
    ...(event.companions ?? []),
  ]

  return (
    <>
      {movers.map((move) => (
        <MoveActor
          key={`${move.from}-${move.to}`}
          move={move}
          onFinished={onFinished}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  )
}

function Scene({
  board,
  orientation,
  selected,
  legalMoves,
  lastMove,
  activeCapture,
  activeMove,
  disabled,
  onSquareClick,
  onCaptureComplete,
  onMoveComplete,
  reducedMotion,
}) {
  const legal = useMemo(() => new Set(legalMoves), [legalMoves])

  return (
    <>
      <Camera orientation={orientation} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[2, 9, 5]} intensity={2.2} />
      <mesh position-y={-0.22}>
        <boxGeometry args={[8.6, 0.38, 8.6]} />
        <meshStandardMaterial color="#291e19" roughness={0.78} />
      </mesh>

      {board.flat().map(({ piece, square }) => {
        const [x, , z] = squareToWorld(square)
        const file = square.charCodeAt(0) - 97
        const rank = Number(square[1]) - 1
        const isSelected = square === selected
        const isLegal = legal.has(square)
        const isLastMove = isLastMoveSquare(lastMove, square)
        const isDark = (file + rank) % 2 === 0
        const hideCommittedAttacker =
          activeCapture &&
          square === activeCapture.to &&
          piece?.color === activeCapture.attacker.color
        const hideQuietMover =
          activeMove &&
          piece?.color === activeMove.piece.color &&
          (square === activeMove.to ||
            (activeMove.companions ?? []).some(
              (companion) => square === companion.to,
            ))

        return (
          <group
            key={square}
            position={[x, 0, z]}
            onClick={(event) => {
              event.stopPropagation()
              if (!disabled) onSquareClick(square)
            }}
          >
            <mesh position-y={-0.02}>
              <boxGeometry args={[0.99, 0.12, 0.99]} />
              <meshStandardMaterial
                color={squareHighlightColor({
                  isSelected,
                  isLegal,
                  isLastMove,
                  isDark,
                })}
                roughness={0.7}
                emissive={isLastMove && !isSelected && !isLegal ? '#6a5418' : '#000000'}
                emissiveIntensity={isLastMove && !isSelected && !isLegal ? 0.22 : 0}
              />
            </mesh>
            {isLegal && !piece && (
              <mesh position-y={0.06} rotation-x={-Math.PI / 2}>
                <circleGeometry args={[0.14, 20]} />
                <meshBasicMaterial color="#263c25" transparent opacity={0.65} />
              </mesh>
            )}
            {piece && !hideCommittedAttacker && !hideQuietMover && (
              <Piece piece={piece} selected={isSelected} />
            )}
          </group>
        )
      })}

      {activeCapture && (
        <CaptureActors
          key={activeCapture.id}
          event={activeCapture}
          onComplete={onCaptureComplete}
          reducedMotion={reducedMotion}
        />
      )}

      {activeMove && !activeCapture && (
        <QuietMoveActors
          key={activeMove.id}
          event={activeMove}
          onComplete={onMoveComplete}
          reducedMotion={reducedMotion}
        />
      )}

      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={13}
        minPolarAngle={0.55}
        maxPolarAngle={1.25}
      />
    </>
  )
}

export function ChessBoard3D({
  board,
  orientation,
  selected,
  legalMoves,
  lastMove,
  activeCapture,
  activeMove,
  disabled,
  feedback,
  onSquareClick,
  onCaptureComplete,
  onMoveComplete,
}) {
  const reducedMotion = useReducedMotion()
  const animating = Boolean(activeCapture || activeMove)

  return (
    <div
      className={`chess-board-3d chess-board-3d--${feedback}${activeCapture ? ' chess-board-3d--battle' : ''}`}
    >
      <Canvas
        aria-label="Interactive 3D chess board"
        camera={{ fov: 42, near: 0.1, far: 100 }}
        dpr={1}
        frameloop={animating ? 'always' : 'demand'}
      >
        <Scene
          board={board}
          orientation={orientation}
          selected={selected}
          legalMoves={legalMoves}
          lastMove={lastMove}
          activeCapture={activeCapture}
          activeMove={activeMove}
          disabled={disabled}
          onSquareClick={onSquareClick}
          onCaptureComplete={onCaptureComplete}
          onMoveComplete={onMoveComplete}
          reducedMotion={reducedMotion}
        />
      </Canvas>

      <div className="board-accessible-controls" role="grid" aria-label="Chess board controls">
        {board.flat().map(({ piece, square }) => (
          <button
            key={square}
            type="button"
            disabled={disabled}
            onClick={() => onSquareClick(square)}
            aria-label={`${square.toUpperCase()}${piece ? ` ${piece.color === 'w' ? 'White' : 'Black'} ${pieceNames[piece.type]}` : ' empty'}${isLastMoveSquare(lastMove, square) ? (square === lastMove.from ? ', last move from' : ', last move to') : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
