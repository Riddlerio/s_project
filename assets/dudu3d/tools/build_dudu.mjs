// Meshy 결과 GLB → 앱용 GLB. 쓰지 않는 클립 제거, 텍스처 1024·WebP, 키프레임 정리, 양자화(KHR_mesh_quantization).
// 기하 압축(Draco/meshopt)은 쓰지 않는다(2026-10-04 승인 범위).
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, quantize, resample, textureCompress } from '@gltf-transform/functions'
import sharp from 'sharp'
const [input, output, ...drop] = process.argv.slice(2)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(input)
for (const anim of doc.getRoot().listAnimations()) {
  if (drop.some(name => anim.getName().toLowerCase() === name.toLowerCase())) { console.log('drop', anim.getName()); anim.dispose() }
}
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 88 }),
  resample(), prune(), quantize(),
)
await io.write(output, doc)
console.log('clips', doc.getRoot().listAnimations().map(a => a.getName()).join(', '))
