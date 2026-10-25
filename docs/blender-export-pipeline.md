# Blender → real-time sci-fi chess export pipeline

Tested with Blender 5.2.1 LTS and Three.js r185. The generator uses only Blender's bundled Python API and glTF exporter.

## 1. Generate the scene and GLBs

### Blender Scripting workspace

1. Open a new Blender file. Save any existing work first: the generator replaces the active scene.
2. Switch to **Scripting**, open `scripts/generate_pieces_blender.py`, and choose **Run Script**.
3. Leave `USE_DRACO = False` and `USE_MESHOPT = False` for the portable baseline.
4. Inspect the final arranged scene. The generator leaves the board and all 32 pieces in Blender.
5. Find the exports at:
   - `public/models/kings-gambit-ivory/{p,n,b,r,q,k}/{w,b}.glb` — 12 independently loadable gameplay pieces.
   - `public/models/sci-fi/board.glb` — complete 8×8 board.
   - `public/models/sci-fi/full-set.glb` — board and 32 pieces in standard starting positions.

Output resolution is, in order: `SCI_FI_CHESS_OUTPUT`, the repository containing the script, the saved `.blend` directory, then Blender's current working directory. For an unsaved Text Editor script, set the override explicitly in Blender's Python console before running:

```python
import os
os.environ["SCI_FI_CHESS_OUTPUT"] = "/absolute/path/to/battle-chess"
```

### Headless regeneration and validation

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python scripts/generate_pieces_blender.py

SCI_FI_CHESS_OUTPUT="$PWD" \
  /Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python scripts/validate_sci_fi_assets.py
```

On other platforms, replace the Blender path with the installed executable. To export elsewhere, set `SCI_FI_CHESS_OUTPUT` for both commands.

## 2. Exact GLB export configuration

The generator selects only the asset being exported and calls `bpy.ops.export_scene.gltf` with this baseline. Use these same settings in **File → Export → glTF 2.0** for manual exports.

```python
bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials='EXPORT',
    export_image_format='AUTO',
    export_keep_originals=False,
    export_texcoords=True,
    export_normals=True,
    export_tangents=False,
    export_vertex_color='NONE',
    export_animations=False,
    export_skins=False,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_draco_mesh_compression_enable=False,
    export_meshopt_compression_enable=False,
)
```

- **Apply Modifiers** evaluates the bevels. Object rotation and scale are already applied by the generator; `export_apply` does not replace that step.
- **+Y Up** performs the Blender Z-up to glTF Y-up conversion. Do not add another axis correction in the engine.
- **Selected Objects** prevents prototypes, lights, cameras, or staging geometry from leaking into an asset.
- **UVs and normals** are required. Tangents remain off because these assets have no tangent-space normal maps.
- **AUTO images** preserves lossless PNG where conversion is required. This set currently uses scalar material factors rather than image textures.
- The full scene uses object extras `chess_piece`, `piece_type`, `color`, and `square` for tooling and validation.

## 3. Material fidelity

The generator uses Principled BSDF values that map to core glTF metallic/roughness materials:

| Blender input | glTF result |
|---|---|
| Base Color | `baseColorFactor` |
| Metallic | `metallicFactor` |
| Roughness | `roughnessFactor` |
| Emission Color | `emissiveFactor` |
| Emission Strength 3.0 | `KHR_materials_emissive_strength` |
| Transmission Weight / IOR / Alpha | glTF transmission, IOR, and alpha material properties |

Emission is an HDR surface color, not a light source or bloom halo. Add actual scene lights for illumination and a bloom post-process only where the target engine/GPU budget allows it. Blender world shaders, Cycles lighting, compositor glow, and arbitrary procedural nodes do not export as glTF materials.

## 4. Three.js integration

### Baseline: no decoder required

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const gltf = await loader.loadAsync('/models/sci-fi/full-set.glb')
scene.add(gltf.scene)
```

Use an environment map for metallic reflections; ambient and directional lights alone do not provide studio-like metal reflections. Three.js `RoomEnvironment` with `PMREMGenerator` is a lightweight procedural option that needs no downloaded HDR asset. Emissive strength loads into `MeshStandardMaterial.emissiveIntensity`. Bloom, if wanted, requires an effect composer and `UnrealBloomPass`; tune its luminance threshold with renderer tone mapping and profile the extra render targets on mobile.

### Optional Meshopt

In the generator set only `USE_MESHOPT = True`. It exports `EXT_meshopt_compression`; do not enable Draco simultaneously.

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const gltf = await loader.loadAsync('/models/sci-fi/full-set.glb')
```

### Optional Draco

In the generator set only `USE_DRACO = True`. The precise quantization settings are:

```python
export_draco_mesh_compression_level=6
export_draco_position_quantization=14
export_draco_normal_quantization=10
export_draco_texcoord_quantization=12
export_draco_color_quantization=10
export_draco_generic_quantization=12
```

Copy Three.js's matching `node_modules/three/examples/jsm/libs/draco/gltf/` decoder files to `public/draco/`, then reuse one decoder loader:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

const draco = new DRACOLoader().setDecoderPath('/draco/')
const loader = new GLTFLoader().setDRACOLoader(draco)
const gltf = await loader.loadAsync('/models/sci-fi/full-set.glb')
// When all model loading is finished: draco.dispose()
```

Draco quantization is lossy. Recheck silhouettes, normals, and UV seams. Compare total cold-load time, including decoder download and decode work, rather than GLB bytes alone.

### Optional KTX2 textures

KTX2 provides no benefit to this scalar-material set. If textures are added later, transcode with ETC1S for color maps and UASTC for normal/metallic-roughness data, host Three.js's matching Basis transcoder files, and configure support before loading:

```js
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'

const ktx2 = new KTX2Loader()
  .setTranscoderPath('/basis/')
  .detectSupport(renderer)
const loader = new GLTFLoader().setKTX2Loader(ktx2)
```

## 5. Unity and Unreal import

### Unity

1. Export the uncompressed baseline. Do not enable Draco, Meshopt, or KTX2 unless the selected importer explicitly supports that extension.
2. Install Unity's **glTFast** package (`com.unity.cloud.gltfast`) through Package Manager; Unity's built-in importers do not natively cover this GLB workflow.
3. Import `full-set.glb` for the arranged scene or the 12 gameplay files for independent pieces.
4. Verify that the shader is metallic/roughness, enable the emission material keyword, and supply environment reflections and bloom separately.

Unity package documentation: <https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.0/manual/index.html>

### Unreal Engine

1. Use an Unreal version with its glTF importer available and enable the **glTF Importer** plugin if it is not already enabled.
2. Export uncompressed GLB with `export_yup=True`; let the importer handle its coordinate conversion.
3. Import `full-set.glb` as a scene or import the individual GLBs as static meshes.
4. Check the imported metallic, roughness, emissive, and opacity settings. Recreate bloom with Unreal post-processing; Blender compositor nodes are not imported.
5. Disable optional compression extensions unless the exact Unreal importer version lists support for them.

Epic's glTF import documentation: <https://dev.epicgames.com/documentation/en-us/unreal-engine/importing-gltf-files-in-unreal-engine>

## 6. Release gate

1. Run `scripts/validate_sci_fi_assets.py` in Blender; it must report all 14 GLBs and 32 arranged pieces.
2. Validate glTF with [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) or [glTF Transform](https://gltf-transform.dev/cli). Confirm `extensionsRequired` matches the configured loader/importer.
3. Load every gameplay piece through the actual production loader, not only a model viewer. Check base contact, scale, team emission, transparency, and console errors.
4. Test desktop and a representative mobile device. Record transferred bytes, decode time, frame time, and GPU memory before choosing a compression codec.

Primary-source implementation notes and additional references are in `docs/research/blender-gltf-pipeline.md`.
