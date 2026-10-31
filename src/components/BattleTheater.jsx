import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { createTheaterController } from '../battle/theaterController.js'
import { MODEL_TURN } from '../battle/units.js'
import { attachProps } from '../battle/propAttach.js'
import { normalizeIvoryActor } from './ivoryNormalize.js'
import { useUnit } from '../battle/useUnit.js'

const SHOTS = {
  'wide-two-shot': { position: [0, 3.1, 6.8], target: [0, 0.65, 0] },
  'close-attacker': { position: [-2.5, 1.6, 3.2], target: [-0.55, 0.65, 0] },
  'close-defender': { position: [2.5, 1.45, 3.1], target: [0.55, 0.6, 0] },
  'low-hero': { position: [-2.8, 0.65, 3.4], target: [-0.45, 0.75, 0] },
  'fade-out': { position: [0, 2.6, 6.2], target: [0, 0.65, 0] },
}

/**
 * drei's fullscreen Html centres itself on the projected world origin, which moves
 * with the cinematic camera; pin it to the canvas centre so the letterbox stays put.
 */
function pinToCanvasCentre(_el, _camera, size) {
  return [size.width / 2, size.height / 2]
}

function latestBeat(beats, elapsed, predicate, fallback) {
  return beats.filter((beat) => beat.t <= elapsed && predicate(beat)).at(-1) ?? fallback
}

function TheaterCamera({ shot }) {
  const { camera } = useThree()
  const target = useRef(new Vector3(0, 0.65, 0))
  const desiredPosition = SHOTS[shot]?.position ?? SHOTS['wide-two-shot'].position
  const desiredTarget = SHOTS[shot]?.target ?? SHOTS['wide-two-shot'].target

  useFrame((_, delta) => {
    const ease = 1 - Math.exp(-delta * 3.8)
    camera.position.lerp(new Vector3(...desiredPosition), ease)
    target.current.lerp(new Vector3(...desiredTarget), ease)
    camera.lookAt(target.current)
  })

  return null
}

function TheaterActor({ piece, action, position, facing }) {
  const { scene, animations, props, propScenes } = useUnit(piece)
  const actor = useMemo(() => {
    const instance = clone(scene)
    normalizeIvoryActor(instance, piece.type)
    attachProps(instance, props, propScenes)
    return instance
  }, [scene, piece.type, props, propScenes])
  const mixer = useMemo(() => new AnimationMixer(actor), [actor])

  useEffect(() => {
    const clip = AnimationClip.findByName(animations, action)
    if (!clip) return undefined
    mixer.stopAllAction()
    const clipAction = mixer.clipAction(clip)
    clipAction.reset()
    const looping = action === 'idle' || action === 'walk'
    clipAction.clampWhenFinished = !looping
    clipAction.setLoop(looping ? LoopRepeat : LoopOnce, looping ? Infinity : 1)
    clipAction.play()
    return () => clipAction.stop()
  }, [action, animations, mixer])

  useFrame((_, delta) => mixer.update(delta))

  return (
    <group position={position} rotation-y={facing}>
      <group rotation-y={MODEL_TURN}>
        <primitive object={actor} dispose={null} />
      </group>
    </group>
  )
}

export function BattleTheater({ script, onComplete }) {
  const [elapsed, setElapsed] = useState(0)
  const controller = useMemo(
    () => createTheaterController({ duration: script.duration, onComplete }),
    [script.duration, onComplete],
  )

  useEffect(() => {
    controller.mount()
    return () => controller.unmount()
  }, [controller])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'Space' && event.code !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      controller.skip()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [controller])

  useFrame((_, delta) => {
    if (controller.getState().completed) return
    controller.tick(delta)
    if (!controller.getState().completed) {
      setElapsed(controller.getState().elapsed)
    }
  })

  const attackerAction = latestBeat(
    script.beats,
    elapsed,
    (beat) => beat.actor === 'attacker' && beat.clip,
    { clip: 'walk' },
  ).clip
  const defenderAction = latestBeat(
    script.beats,
    elapsed,
    (beat) => beat.actor === 'defender' && beat.clip,
    { clip: 'idle' },
  ).clip
  const shot = latestBeat(
    script.beats,
    elapsed,
    (beat) => beat.shot,
    { shot: 'wide-two-shot' },
  ).shot
  const engageAt = script.beats.find((beat) => beat.actor === 'attacker' && beat.clip === 'attack')?.t ?? 1
  const engage = Math.min(1, elapsed / engageAt)
  const fadeAt = script.beats.find((beat) => beat.shot === 'fade-out')?.t ?? script.duration
  const fade = Math.max(
    Math.max(0, 1 - elapsed / 0.35),
    Math.max(0, (elapsed - fadeAt) / Math.max(0.001, script.duration - fadeAt)),
  )

  return (
    <>
      <fog attach="fog" args={['#08090d', 6, 15]} />
      <TheaterCamera shot={shot} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[-3, 5, 4]} intensity={2.1} color="#fff0d5" />
      <directionalLight position={[4, 2, -3]} intensity={1.4} color="#7d9dff" />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#171a20" roughness={0.92} metalness={0.08} />
      </mesh>
      <TheaterActor
        piece={script.actors.attacker}
        action={attackerAction}
        position={[-2.35 + engage * 1.6, 0.04, 0]}
        facing={-Math.PI / 2}
      />
      <TheaterActor
        piece={script.actors.defender}
        action={defenderAction}
        position={[0.75, 0.04, 0]}
        facing={Math.PI / 2}
      />
      <Html fullscreen zIndexRange={[30, 0]} calculatePosition={pinToCanvasCentre}>
        <div
          className="theater-overlay"
          role="button"
          tabIndex={0}
          aria-label="Skip battle"
          onClick={controller.skip}
        >
          <div className="theater-letterbox theater-letterbox--top" />
          <div className="theater-letterbox theater-letterbox--bottom" />
          <span className="theater-skip">Click / Space / Esc to skip</span>
          <div className="theater-fade" style={{ opacity: fade }} />
        </div>
      </Html>
    </>
  )
}
