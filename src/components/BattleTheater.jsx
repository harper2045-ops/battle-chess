import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

/** How far the attacker walks in before reaching striking distance (walk + attack only). */
const APPROACH_LENGTH = 1.6

/**
 * Where an actor's root bone (the hips) is along X, relative to the actor's own group,
 * at `time` into `clip`. Played on a throwaway mixer so the visible one is untouched.
 */
function rootOffsetAt(actor, group, clip, time) {
  const root = actor.getObjectByProperty('isBone', true)
  if (!root) return 0
  const probe = new AnimationMixer(actor)
  probe.clipAction(clip).play()
  probe.setTime(time)
  group.updateWorldMatrix(true, true)
  const offset = root.getWorldPosition(new Vector3()).x - group.getWorldPosition(new Vector3()).x
  probe.stopAllAction()
  probe.uncacheRoot(actor)
  return offset
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

/**
 * One fighter. `anchor` ({ clip, time, x }) is for clips that move the body themselves
 * (root motion, like the fight clip's walk-in): the actor is placed so its hips are at
 * x when the clip reaches `time`, instead of being slid around by the theater.
 */
function TheaterActor({ piece, action, position, facing, timeScale = 1, anchor = null }) {
  const { scene, animations, props, propScenes } = useUnit(piece)
  const actor = useMemo(() => {
    const instance = clone(scene)
    normalizeIvoryActor(instance, piece.type)
    attachProps(instance, props, propScenes)
    return instance
  }, [scene, piece.type, props, propScenes])
  const mixer = useMemo(() => new AnimationMixer(actor), [actor])
  const group = useRef()
  const [shift, setShift] = useState(0)
  const anchorClip = anchor && AnimationClip.findByName(animations, anchor.clip)

  // Measured before paint, so the first frame already stands where the walk-in starts.
  useLayoutEffect(() => {
    if (!anchorClip || !group.current) return
    const offset = rootOffsetAt(actor, group.current, anchorClip, anchor.time)
    setShift(anchor.x - position[0] - offset)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measure once per clip/target
  }, [actor, anchorClip, anchor?.time, anchor?.x])

  useEffect(() => {
    const clip = AnimationClip.findByName(animations, action)
    if (!clip) return undefined
    mixer.stopAllAction()
    const clipAction = mixer.clipAction(clip)
    clipAction.reset()
    const looping = action === 'idle' || action === 'walk'
    clipAction.clampWhenFinished = !looping
    clipAction.setLoop(looping ? LoopRepeat : LoopOnce, looping ? Infinity : 1)
    clipAction.timeScale = timeScale
    clipAction.play()
    return () => clipAction.stop()
  }, [action, animations, mixer, timeScale])

  useFrame((_, delta) => mixer.update(delta))

  return (
    <group ref={group} position={[position[0] + shift, position[1], position[2]]} rotation-y={facing}>
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
  // The fighters meet at the arena centre: the attacker closes until it is
  // script.strikeDistance from the defender, then strikes.
  const defenderX = script.strikeDistance / 2
  const strikeX = -script.strikeDistance / 2
  // A fight clip walks the attacker in itself; it stands still and is placed so its hips
  // reach strikeX as the blow lands. Otherwise the theater slides it in during the walk.
  const engageAt = script.beats.find((beat) => beat.actor === 'attacker' && beat.clip === 'attack')?.t ?? 1
  const engage = Math.min(1, elapsed / engageAt)
  const attackerX = script.fight ? strikeX : strikeX - APPROACH_LENGTH * (1 - engage)
  const anchor = useMemo(
    () => script.fight && { clip: 'fight', time: script.fight.hitTime, x: strikeX },
    [script.fight, strikeX],
  )
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
        position={[attackerX, 0.04, 0]}
        facing={-Math.PI / 2}
        timeScale={script.fight?.speed ?? 1}
        anchor={anchor}
      />
      <TheaterActor
        piece={script.actors.defender}
        action={defenderAction}
        position={[defenderX, 0.04, 0]}
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
