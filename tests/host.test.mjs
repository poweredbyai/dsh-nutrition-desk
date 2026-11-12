// Host 半片的接口测试：不启动真正的 Harness，只构造一个最小的 ctx 把路由跑起来。
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'

const root = await mkdtemp(join(tmpdir(), 'nutrition-desk-test-'))
process.env.DSH_HOME = join(root, 'dsh-home')
process.env.USERPROFILE = join(root, 'user')
process.env.HOME = join(root, 'user')

const { apply } = await import('../index.js')

/** 一个假 ctx：记录 webServer 注册，按需提供模型。 */
function makeCtx({ llm, selection } = {}) {
  const routes = []
  const ctx = {
    effect(fn) { return fn() },
    get(name) {
      if (name === 'connection') return { requestRejection: () => undefined }
      if (name === 'llm') return llm
      if (name === 'agentDefaultModel') return selection ? { currentSelection: () => selection } : undefined
      if (name === 'webServer') return undefined
      return undefined
    },
    webServer: { register(options) { routes.push(options); return () => {} } },
  }
  apply(ctx)
  return { routes, handler: routes[0].handler, options: routes[0] }
}

function mockRequest(method, path, body, extraHeaders = {}) {
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
  const req = {
    method,
    url: `/nutrition-desk${path}`,
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...extraHeaders },
    [Symbol.asyncIterator]: async function* () {
      if (payload) yield payload
    },
  }
  return req
}

function mockResponse() {
  const out = { statusCode: 200, headers: {}, body: '', ended: false }
  const res = {
    get statusCode() { return out.statusCode },
    set statusCode(value) { out.statusCode = value },
    get headersSent() { return out.ended },
    setHeader(name, value) { out.headers[name.toLowerCase()] = value },
    end(chunk) { out.ended = true; if (chunk !== undefined) out.body += String(chunk) },
  }
  return { res, out }
}

async function call(handler, method, path, body, headers) {
  const { res, out } = mockResponse()
  await handler(mockRequest(method, path, body, headers), res)
  return { status: out.statusCode, json: out.body ? JSON.parse(out.body) : null, out }
}

const SAMPLE_PNG = `data:image/png;base64,${Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake-image-bytes'),
]).toString('base64')}`

const GOOD_RESULT = {
  headline: '蛋白质够了，蔬菜缺位',
  score: 66,
  summary: '这一餐热量不高，蛋白质勉强达标，但几乎没有蔬菜和钙，上午容易饿。',
  energy: { kcal: 428, ratio: 24, note: '约全天目标 1800 kcal 的 24%' },
  macros: [
    { name: '蛋白质', value: '18g', percent: 72, tone: 'good' },
    { name: '碳水', value: '52g', percent: 88, tone: 'good' },
    { name: '脂肪', value: '14g', percent: 40, tone: 'low' },
    { name: '纤维', value: '3g', percent: 18, tone: 'low' },
  ],
  strengths: ['鸡蛋给了优质蛋白', '热量控制得不错'],
  gaps: ['几乎没有蔬菜', '缺一份奶类或豆制品'],
  advice: {
    headline: '下一餐补三样就够',
    items: [
      { title: '加一份绿叶菜', detail: '西兰花或油菜一小碗，补上纤维和叶酸。' },
      { title: '补一份奶类', detail: '无糖酸奶一杯，钙和蛋白质一起补上。' },
      { title: '换掉精致主食', detail: '白粥换杂粮粥，上午血糖更稳。' },
    ],
    swap: '白粥 → 杂粮粥 + 一个水煮蛋',
    nextMeal: '明天早餐：鸡蛋 + 玉米 + 无糖酸奶 + 一小把圣女果',
  },
  invite: {
    question: '今天你吃了什么？',
    lines: ['我把三餐记在这里，已经第 12 天。', '把你的三餐发到评论区，我帮你看缺口。'],
    cta: '评论区晒出你今天的早餐',
    tags: ['#一日三餐', '#营养记录', '#今天吃什么'],
  },
  post: {
    title: '鸡蛋加玉米，蛋白够了纤维偏少',
    body: '今天早餐就一个鸡蛋加一根玉米，吃完挺清爽，但上午十点多就有点饿了。AI 说这餐蛋白勉强够，纤维和钙都缺，主食也偏单一。明天准备加一杯无糖酸奶和一小把圣女果，看看会不会更扛饿。你早餐一般吃什么？',
  },
  caption: '早餐鸡蛋+玉米，蛋白质够了，但蔬菜和奶类缺位。你的早餐呢？#一日三餐 #营养记录',
}

after(async () => {
  await rm(root, { recursive: true, force: true })
})

test('注册了 /nutrition-desk 前缀路由', () => {
  const { options } = makeCtx()
  assert.equal(options.kind, 'prefix')
  assert.equal(options.path, '/nutrition-desk')
})

test('首次 GET state 返回空档案与无模型状态', async () => {
  const { handler } = makeCtx()
  const { status, json: body } = await call(handler, 'GET', '/state')
  assert.equal(status, 200)
  assert.equal(body.profile, null)
  assert.equal(body.result, null)
  assert.equal(body.model, null)
})

test('POST profile 保存并规范化档案，非法值被夹到范围内', async () => {
  const { handler } = makeCtx()
  const { status, json: body } = await call(handler, 'POST', '/profile', {
    profile: { name: '  小满  ', gender: 'female', age: 200, height: 165, weight: 55, activity: 'nope', goal: 'fatloss' },
  })
  assert.equal(status, 200)
  assert.equal(body.profile.age, 100)
  assert.equal(body.profile.name, '小满')
  assert.equal(body.profile.activity, 'light')
  const again = await call(handler, 'GET', '/state')
  assert.equal(again.json.profile.goal, 'fatloss')
})

test('档案缺基础信息时拒绝保存', async () => {
  const { handler } = makeCtx()
  const { status, json: body } = await call(handler, 'POST', '/profile', { profile: { name: '空' } })
  assert.equal(status, 400)
  assert.match(body.error, /年龄/)
})

test('POST analyze 走模型：提示词包含档案与本餐目标，输出被规范化', async () => {
  let seen = null
  const llm = {
    async prepareCall(config) {
      return {
        config,
        async *stream(request) {
          seen = request
          yield { type: 'text-delta', text: JSON.stringify(GOOD_RESULT) }
        },
      }
    },
  }
  const { handler } = makeCtx({ llm, selection: { provider: 'deepseek-account', model: 'deepseek-flash' } })
  const { status, json: body } = await call(handler, 'POST', '/analyze', { type: '早餐', text: '鸡蛋一个+玉米一根', profile: { name: '小满', gender: 'male', age: 42, height: 175, weight: 67, activity: 'sedentary', goal: 'health' } })
  assert.equal(status, 200)
  assert.equal(body.fallback, false)
  assert.equal(body.result.mealType, '早餐')
  assert.equal(body.result.headline, '蛋白质够了，蔬菜缺位')
  assert.equal(body.result.energy.kcal, 428)
  // 占比与 note 由 Host 按热量重算，保证和卡面进度条一致
  assert.equal(body.result.energy.ratio, Math.round((428 / body.result.targets.kcal) * 100))
  assert.match(body.result.energy.note, /^约占全天目标 \d+ kcal 的 \d+%$/)
  assert.ok(body.result.energy.note.includes(`${body.result.energy.ratio}%`))
  assert.equal(body.result.macros.length, 4)
  assert.equal(body.result.advice.items.length, 3)
  assert.equal(body.result.invite.tags.length, 3)
  // 图文文案：标题带餐次标签、正文、备注、四个固定话题
  assert.equal(body.result.post.title, '鸡蛋加玉米，蛋白够了纤维偏少 #早餐')
  assert.match(body.result.post.body, /无糖酸奶/)
  assert.equal(body.result.post.remark, '备注：男、42岁、175cm、67kg')
  assert.deepEqual(body.result.post.tags, ['#AI说餐谱', '#早餐', '#上班族', '#久坐族'])
  assert.equal(body.result.post.text, `${body.result.post.title}\n\n${body.result.post.lines.join('\n')}\n\n${body.result.post.remark}\n\n${body.result.post.tags.join(' ')}`)
  // 正文一句一行：每行都以标点结尾
  assert.ok(body.result.post.lines.length >= 4, `lines ${body.result.post.lines.length}`)
  assert.ok(body.result.post.lines.every(line => /[，。！？；、,.!?;]$/.test(line)), body.result.post.lines.join(' | '))
  assert.equal(body.result.post.lines.join(''), body.result.post.body)
  assert.ok(body.result.post.text.startsWith(body.result.post.title))
  assert.ok(body.result.post.text.includes(body.result.post.remark))
  assert.ok(body.result.post.text.includes('#AI说餐谱'))
  // 提示词里应该带着算好的每日/本餐参考值
  assert.match(seen.system, /只输出一个 JSON/)
  assert.match(seen.messages[0].content[0].text, /本餐参考/)
  assert.match(seen.messages[0].content[0].text, /鸡蛋一个\+玉米一根/)
})

test('模型返回超长内容时全部截断到契约上限', async () => {
  const bloated = JSON.parse(JSON.stringify(GOOD_RESULT))
  bloated.headline = '这是一条非常非常长的大标题超过十四个汉字还要继续写下去'
  bloated.summary = '这是一段很长的总结'.repeat(20)
  bloated.strengths = ['做对的点'.repeat(20), '第二个'.repeat(30), '多余的第三条']
  bloated.gaps = []
  bloated.macros = [{ name: '蛋白质', value: '十八克蛋白质真不少', percent: 999, tone: 'nonsense' }]
  bloated.advice.items = Array.from({ length: 8 }, (_, i) => ({ title: `动作${i}`, detail: '细节'.repeat(40) }))
  bloated.invite.tags = ['没有井号的话题', '第二个', '第三个', '第四个']
  bloated.caption = '配文'.repeat(200)
  const llm = { async prepareCall(config) { return { config, async *stream() { yield { type: 'text-delta', text: JSON.stringify(bloated) } } } } }
  const { handler } = makeCtx({ llm, selection: { provider: 'p', model: 'm' } })
  const { status, json: body } = await call(handler, 'POST', '/analyze', { type: '午餐', text: '米饭一碗+红烧肉三块' })
  assert.equal(status, 200)
  const r = body.result
  assert.ok(r.headline.length <= 16, `headline ${r.headline.length}`)
  assert.ok(r.summary.length <= 56, `summary ${r.summary.length}`)
  assert.ok(r.strengths.length === 2 && r.strengths.every(s => s.length <= 16))
  assert.ok(r.gaps.length === 2 && r.gaps.every(s => s.length > 0))
  assert.ok(r.macros.length === 4 && r.macros.every(m => m.percent <= 130 && ['good', 'watch', 'low'].includes(m.tone)))
  assert.ok(r.advice.items.length === 3)
  assert.ok(r.advice.items.every(item => item.title.length <= 10 && item.detail.length <= 34))
  assert.ok(r.invite.tags.length === 3 && r.invite.tags.every(tag => tag.startsWith('#')))
  assert.ok(r.caption.length <= 120)
  assert.equal(r.macros[0].name, '蛋白质')
})

test('模型输出不是 JSON 时降级为本地估算并带上提示', async () => {
  const llm = { async prepareCall(config) { return { config, async *stream() { yield { type: 'text-delta', text: '抱歉，我无法完成。' } } } } }
  const { handler } = makeCtx({ llm, selection: { provider: 'p', model: 'm' } })
  const { status, json: body } = await call(handler, 'POST', '/analyze', { type: '晚餐', text: '面条一碗+两个鸡蛋' })
  assert.equal(status, 200)
  assert.equal(body.fallback, true)
  assert.match(body.notice, /食物表/)
  assert.equal(body.result.mealType, '晚餐')
  assert.ok(body.result.energy.kcal > 0)
})

test('没有模型时直接走本地估算', async () => {
  const { handler } = makeCtx()
  const { json: body } = await call(handler, 'POST', '/analyze', { type: '早餐', text: '早餐，鸡蛋一个+玉米一根' })
  assert.equal(body.fallback, true)
  assert.equal(body.result.mealText, '早餐，鸡蛋一个+玉米一根')
  assert.ok(body.result.advice.items.length === 3)
})

test('空餐次输入被拒绝', async () => {
  const { handler } = makeCtx()
  const { status } = await call(handler, 'POST', '/analyze', { type: '早餐', text: ' ' })
  assert.equal(status, 400)
})

test('POST save 写入 PNG 并记录路径，reveal 用服务端记录的路径', async () => {
  const { handler } = makeCtx()
  await call(handler, 'POST', '/analyze', { type: '早餐', text: '鸡蛋一个+玉米一根' })
  const saved = await call(handler, 'POST', '/save', {
    files: [
      { kind: 'analysis', name: '01-营养分析', png: SAMPLE_PNG },
      { kind: 'advice', name: '02-改进建议', png: SAMPLE_PNG },
      { kind: 'invite', name: '03-引导投稿', png: SAMPLE_PNG },
    ],
    texts: [{ name: '04-图文文案.md', content: '# 标题\n\n正文\n\n备注：男、42岁、175cm、67kg\n\n#AI说餐谱 #早餐' }],
  })
  assert.equal(saved.status, 200)
  assert.equal(saved.json.files.length, 4)
  assert.deepEqual(saved.json.files, ['01-营养分析.png', '02-改进建议.png', '03-引导投稿.png', '04-图文文案.md'])
  const info = await stat(join(saved.json.path, '01-营养分析.png'))
  assert.ok(info.size > 8)
  const text = await readFile(join(saved.json.path, '04-图文文案.md'), 'utf8')
  assert.match(text, /备注：男、42岁、175cm、67kg/)
  assert.match(text, /#AI说餐谱/)
  const bytes = await readFile(join(saved.json.path, '01-营养分析.png'))
  assert.equal(bytes.subarray(0, 4).toString('hex'), '89504e47')
  const revealed = await call(handler, 'POST', '/reveal', { from: 'last-analyze' })
  assert.equal(revealed.status, 200)
  assert.equal(revealed.json.path, saved.json.path)
})

test('save 拒绝伪造的图片数据', async () => {
  const { handler } = makeCtx()
  const bad = await call(handler, 'POST', '/save', { files: [{ name: 'x', png: 'data:image/png;base64,aGVsbG8=' }] })
  assert.equal(bad.status, 400)
  assert.match(bad.json.error, /PNG/)
  const notPng = await call(handler, 'POST', '/save', { files: [{ name: 'y', png: 'data:image/jpeg;base64,AAAA' }] })
  assert.equal(notPng.status, 400)
})

test('拒绝跨站写请求', async () => {
  const { handler } = makeCtx()
  const { status } = await call(handler, 'POST', '/profile', { profile: { age: 30, height: 170, weight: 60 } }, { 'sec-fetch-site': 'cross-site' })
  assert.equal(status, 403)
})

test('下一餐建议去掉卡路里数字', async () => {
  const withKcal = {
    ...GOOD_RESULT,
    advice: { ...GOOD_RESULT.advice, nextMeal: '午餐加一份瘦肉或鱼（约 561 kcal），配两拳头蔬菜' },
  }
  const llm = { async prepareCall(config) { return { config, async *stream() { yield { type: 'text-delta', text: JSON.stringify(withKcal) } } } } }
  const { handler } = makeCtx({ llm, selection: { provider: 'p', model: 'm' } })
  const { json: body } = await call(handler, 'POST', '/analyze', { type: '午餐', text: '米饭一碗+红烧肉三块' })
  assert.ok(!/kcal|千卡|大卡/i.test(body.result.advice.nextMeal), body.result.advice.nextMeal)
  assert.ok(body.result.advice.nextMeal.includes('蔬菜'))
})

test('未知路由 404', async () => {
  const { handler } = makeCtx()
  const { status } = await call(handler, 'GET', '/nope')
  assert.equal(status, 404)
})

test('GET state 返回每日三餐得分历史', async () => {
  const { handler } = makeCtx()
  await call(handler, 'POST', '/analyze', { type: '早餐', text: '鸡蛋一个+玉米一根' })
  await call(handler, 'POST', '/analyze', { type: '午餐', text: '米饭一碗+红烧肉三块' })
  const { status, json: body } = await call(handler, 'GET', '/state')
  assert.equal(status, 200)
  assert.ok(Array.isArray(body.history) && body.history.length >= 1)
  const day = body.history[body.history.length - 1]
  assert.ok(day.date)
  assert.ok(day.label)
  assert.ok(day.weekday)
  assert.ok(Array.isArray(day.meals) && day.meals.length >= 2)
  assert.ok(day.meals.every(meal => meal.type && Number.isFinite(meal.score)))
  assert.ok(Number.isFinite(day.average))
  assert.ok(body.historySummary.count >= 2)
  assert.ok(body.historySummary.best >= body.historySummary.worst)
})

test('未鉴权时拒绝（没有 connection 服务）', async () => {
  const routes = []
  apply({ effect: fn => fn(), get: () => undefined, webServer: { register: o => (routes.push(o), () => {}) } })
  const { res, out } = mockResponse()
  await routes[0].handler(mockRequest('GET', '/state'), res)
  assert.equal(out.statusCode, 403)
})


