# Blender → glTF/GLB pipeline for sci-fi chess pieces

**Target verified:** installed Blender **5.2.1 LTS**, Three.js **0.185.1 (r185)**, react-three-fiber 9.7.0, drei 10.7.8. Sources below are primary documentation/specifications or the matching official source tags. This is research only; no generator or runtime code was changed.

## Recommended production path

1. Keep one joined static mesh per piece, with its origin at the base center and a consistent real-world scale. glTF distances are meters; `export_yup=True` converts Blender Z-up to glTF/Three.js Y-up. Do not add a second axis correction in the browser ([glTF 2.0, coordinate system and units](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units); [Blender 5.2 exporter API](https://docs.blender.org/api/5.2/bpy.ops.export_scene.html#bpy.ops.export_scene.gltf)).
2. Author exportable **Principled BSDF** materials, not arbitrary Cycles node graphs. Use image textures where variation is needed; bake procedural lighting/surface detail that the exporter cannot represent. Base-color and emissive textures are sRGB; metallic/roughness and normal textures are linear/non-color. glTF packs roughness in **G** and metalness in **B**, multiplying textures by their factors ([glTF materials](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials)).
3. Start with **uncompressed GLB + PNG/AUTO textures**, served with normal HTTP Brotli/gzip. The current 12 static files are only about 28–132 KiB apiece, so measure total decode time and decoder download before adding mesh compression. Benchmark **Meshopt** first if larger sci-fi meshes make compression worthwhile; use Draco when its smaller mesh payload justifies its worker/WASM cost.
4. Add **KTX2 only when textures actually exist**. Scalar Principled materials gain nothing from it. Validate every exported GLB and test the actual production loader on desktop and mobile.

## Material fidelity and its limits

| Blender Principled input | glTF / Three.js result | Production guidance |
|---|---|---|
| Base Color | `baseColorFactor` and optional `baseColorTexture` | Keep color factors linear in Blender; exporter handles glTF representation. Use sRGB image textures. |
| Metallic / Roughness | `metallicFactor` / `roughnessFactor`, packed metallic-roughness texture | Scalar values in the current generator export directly. Textures multiply factors and must remain linear/non-color. |
| Emission Color | `emissiveFactor` and optional `emissiveTexture` | Core factors are limited to `[0,1]`; emissive textures are sRGB. |
| Emission Strength | Multiplies emission; values above 1 use `KHR_materials_emissive_strength` | Supported by r185 `GLTFLoader`, becoming Three.js emissive intensity. This is HDR color, **not baked light or bloom** ([Blender 5.2.1 emission exporter](https://github.com/blender/blender/blob/v5.2.1/scripts/addons_core/io_scene_gltf2/blender/exp/material/extensions/emission.py); [Khronos extension](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_emissive_strength)). |

`GLTFLoader` maps the metallic-roughness workflow to Three.js PBR materials and supports emissive strength. It does **not** reproduce Blender's world shader, Cycles lighting, compositor glow, or arbitrary procedural nodes. The current board has only ambient/directional lights and no environment map; metallic surfaces therefore will not match a Blender studio render. Three.js explicitly recommends an environment map for best `MeshStandardMaterial` results ([GLTFLoader r185](https://github.com/mrdoob/three.js/blob/r185/docs/pages/GLTFLoader.html); [MeshStandardMaterial r185](https://github.com/mrdoob/three.js/blob/r185/docs/pages/MeshStandardMaterial.html)).

## Exact static-export baseline

The option names/defaults below were introspected from the installed 5.2.1 operator and cross-checked against its [official 5.2.1 exporter source](https://github.com/blender/blender/blob/v5.2.1/scripts/addons_core/io_scene_gltf2/__init__.py).

```python
bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='GLB',          # geometry, buffers, textures in one asset
    use_selection=True,           # select only the final joined piece first
    export_apply=True,            # evaluate mesh modifiers, except armatures
    export_yup=True,              # required glTF +Y-up convention
    export_materials='EXPORT',
    export_image_format='AUTO',   # PNG lossless unless source is JPEG/WebP
    export_keep_originals=False,  # permit required glTF channel packing/conversion
    export_texcoords=True,
    export_normals=True,
    export_tangents=False,        # True when tangent-space normal maps are used
    export_vertex_color='NONE',   # unless vertex colors are intentional
    export_animations=False,      # these generator outputs are static
    export_skins=False,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
    export_draco_mesh_compression_enable=False,
    export_meshopt_compression_enable=False,
)
```

- The current `use_selection=False` works only because the scene is cleared; `True` is safer for a production scene.
- **`export_apply=True` does not apply object transforms.** Apply/bake rotation and scale before export (and deliberately place the base origin); keep armature/shape-key workflows separate because modifier application excludes armatures and prevents shape-key export.
- Keep UVs and normals. Tangents cost extra data and are useful for normal-mapped meshes; they require normals/UVs. Without supplied tangents, glTF clients should derive MikkTSpace tangents for normal mapping ([glTF mesh guidance](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes)).
- `AUTO` is the fidelity-first default. JPEG is lossy and is suitable only after visual review; do not use `export_image_format='NONE'` for textured assets.

## Compression choices and browser requirements

The present `GeometricPiece` constructs plain `GLTFLoader` instances with **no decoders configured**. Therefore its compatible baseline is uncompressed geometry with PNG/JPEG textures; compressed variants require runtime changes and deployed decoder assets.

| Choice | Exact Blender 5.2.1 options | Three.js r185 requirement / trade-off |
|---|---|---|
| None + HTTP compression | Both compression flags `False` | Simplest and fully compatible with current loader. Compare Brotli/gzip transfer size and startup time first. |
| Meshopt | `export_meshopt_compression_enable=True`, `export_meshopt_extension='EXT_meshopt_compression'` | `loader.setMeshoptDecoder(MeshoptDecoder)` using `three/addons/libs/meshopt_decoder.module.js`; await decoder readiness through normal async loading. Handles geometry, morphs and animation; designed for fast decode and further gzip compression ([EXT specification](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression)). |
| Draco | `export_draco_mesh_compression_enable=True`, level `6`, position `14`, normal `10`, UV `12`, color `10`, generic `12` | Attach one reused `DRACOLoader` with `setDRACOLoader`; host matching decoder JS/WASM and set `setDecoderPath`. Smaller geometry can cost client decode time; quantization is lossy, so inspect silhouettes, shading and UV seams ([DRACOLoader r185](https://github.com/mrdoob/three.js/blob/r185/docs/pages/DRACOLoader.html)). |
| KTX2 / Basis textures | Blender gltfpack route: `export_use_gltfpack=True`, `export_gltfpack_tc=True`; otherwise post-process textures | Attach `KTX2Loader` with `setKTX2Loader`, call `detectSupport(renderer)` **before loading**, and host matching transcoder JS/WASM. WebAssembly is required. Do not enable this solely for scalar materials ([KTX2Loader r185](https://github.com/mrdoob/three.js/blob/r185/docs/pages/KTX2Loader.html)). |

Use `EXT_meshopt_compression` for the established interchange path; r185 also lists `KHR_meshopt_compression`, but there is no repo compatibility reason to prefer the newer alternative. Do not enable both mesh codecs on the same asset. Draco compresses triangle geometry; Meshopt also covers animation and other buffer data ([glTF Transform: meshopt](https://gltf-transform.dev/modules/functions/functions/meshopt), [Draco](https://gltf-transform.dev/modules/functions/functions/draco)).

For KTX2, Khronos recommends **ETC1S for color maps** and **UASTC for normal/metallic-roughness and other non-color data**. Images must have multiple-of-four dimensions; provide a full mip pyramid and correct sRGB-versus-linear metadata. KTX2 reduces GPU memory as well as transmission size, but requires runtime transcoding ([KHR_texture_basisu](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_basisu)). glTF Transform is relevant as an optional inspection/advanced-optimization stage, not a blanket `optimize` step whose defaults may be inappropriate ([official CLI guidance](https://gltf-transform.dev/cli)).

## Emission and bloom in this browser stack

- The current canvas has **no effect composer or bloom pass**, so emissive pieces can look bright but cannot produce a bloom halo.
- r185 `UnrealBloomPass` thresholds **scene luminance**, not an emissive-material flag. Bright board squares/specular highlights can bloom too; selective bloom needs a separate rendering/compositing design.
- Bloom needs renderer tone mapping and HDR values above the threshold to be predictable. Tune emission strength, threshold, strength and radius together under the final tone mapping/exposure. The pass allocates half-float render targets and a five-mip blur chain, so profile mobile GPU cost ([UnrealBloomPass r185](https://github.com/mrdoob/three.js/blob/r185/docs/pages/UnrealBloomPass.html)).
- Emissive materials do not illuminate neighboring chess pieces. Use actual scene lights or baked lighting for that effect.

## Release checks

- Run Khronos/glTF validation (or `gltf-transform validate`) and inspect `extensionsUsed` / `extensionsRequired` against the configured loader.
- In the real Vite build, verify all 12 pieces: base at board surface, no extra rotation, consistent dimensions, material factors, UV/normal-map seams and emissive strength.
- Compare uncompressed, Meshopt and/or Draco by **total cold-load time**, transferred bytes including decoders, decode time and mobile memory—not GLB size alone.
- Test bloom and KTX2 fallbacks on representative mobile/desktop GPUs; keep an uncompressed, untextured-factor baseline until those paths pass.
