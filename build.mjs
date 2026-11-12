// 把 src/*.js 拼成浏览器侧的 client.js。
// 三个源文件共用同一个工厂作用域：React 由浏览器模块表提供，其余都是本文件的局部函数。
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const order = ['card.js', 'panel.js', 'main.js']

const parts = []
for (const name of order) {
  const source = await readFile(join(here, 'src', name), 'utf8')
  parts.push(`// ---- src/${name} ----\n${source.trim()}\n`)
}

const bundle = `window.__ModuleLoader__.load({
  id: 'dsh-nutrition-desk',
  factory(require) {
    const React = require('react')
    const h = React.createElement
${parts.join('\n')}
    return { inject, apply: panelApply }
  },
})
`

// 先做一次语法检查：工厂体里引用了浏览器全局，但解析阶段不需要它们存在。
try {
  new Function(bundle)
} catch (err) {
  console.error('client bundle syntax error:', err.message)
  process.exit(1)
}

await writeFile(join(here, 'client.js'), bundle)
console.log(`client.js written: ${Buffer.byteLength(bundle)} bytes`)
