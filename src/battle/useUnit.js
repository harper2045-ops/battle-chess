import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { DRACO_PATH, PROP_URLS, unitFor } from './units.js'

/** Load a unit and every prop through the same cached loader on board and arena. */
export function useUnit(piece) {
  const unit = unitFor(piece)
  const gltf = useGLTF(unit.model, DRACO_PATH)
  const propGltfs = useGLTF(PROP_URLS, DRACO_PATH)
  const propScenes = useMemo(
    () => Object.fromEntries(PROP_URLS.map((url, index) => [url, propGltfs[index].scene])),
    [propGltfs],
  )
  return { scene: gltf.scene, animations: gltf.animations, props: unit.props, propScenes }
}
