// GLB의 기본색 텍스처 이미지만 교체한다(형태·뼈대·동작은 그대로).
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import fs from 'node:fs'
const [src, png, out] = process.argv.slice(2)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(src)
const textures = doc.getRoot().listMaterials().map(m => m.getBaseColorTexture()).filter(Boolean)
if (textures.length !== 1) throw new Error('baseColor texture count ' + textures.length)
textures[0].setImage(fs.readFileSync(png)).setMimeType('image/png')
await io.write(out, doc)
console.log('injected', png, '->', out)
