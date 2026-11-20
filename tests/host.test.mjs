// Host 半片 v2（四页图文）的接口测试。
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

const root = await mkdtemp(join(tmpdir(), 'nutrition-desk-test-'))
process.env.DSH_HOME = join(root, 'dsh-home')
process.env.USERPROFILE = join(root, 'user')
process.env.HOME = join(root, 'user')
// 测试里绝不弹资源管理器（否则会对着临时目录弹「位置不可用」）
process.env.NUTRITION_DESK_NO_OPEN = '1'

const { apply } = await import('../index.js')

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
  return {
    method,
    url: `/nutrition-desk${path}`,
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...extraHeaders },
    [Symbol.asyncIterator]: async function* () {
      if (payload) yield payload
    },
  }
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

/** 模型应该返回的四页内容（对照 docs/nutrition-desk-v2-cards.md）。 */
const DECK = {
  score: 62,
  cover: {
    lines: ['一份鸡蛋肠', '蛋白只有 12 克'],
    emphasis: '只有 12 克',
    sub: ['肠粉没错，错在你只吃了它。', '热量不高，材料不够。'],
  },
  plate: {
    title: '四分之三是米浆',
    mine: [
      { label: '米浆', pct: 74, tone: 'carb' },
      { label: '蛋白', pct: 26, tone: 'protein' },
    ],
    insight: { text: '区别只有一处：你这边没有绿色。', bold: '你这边没有绿色。' },
  },
  exam: {
    title: '三样里，两样是零',
    rows: [
      { label: '蛋白质', value: 12 },
      { label: '蔬菜', value: 0 },
      { label: '全谷物', value: 0 },
    ],
    insight: '热量没超，材料没给。',
    say: { text: '米浆升得快、掉得也快。十点心慌，不是饿，是结构不对。', bold: '十点心慌，不是饿，是结构不对。' },
  },
  fix: {
    title: '加一个蛋、一杯豆浆',
    rows: [
      { title: '加 1 个蛋 + 1 杯无糖豆浆', result: '蛋白 12g → 27g' },
      { title: '抓把小番茄或半根黄瓜', result: '蔬菜 0 → 100g' },
      { title: '酱汁少淋一半', result: '钠少一半' },
    ],
    why: { text: '肠粉不用戒，一天一次。改的是结构，不是口味。', bold: '改的是结构，不是口味。' },
    faq: { q: '不爱喝豆浆？', a: { text: '换 300ml 纯牛奶，蛋白一样。', bold: '纯牛奶' } },
    ask: {
      q: '你早餐是「只有主食」，还是「主食＋蛋白」？',
      options: ['① 只有主食', '② 主食＋蛋白'],
      hint: '评论区说一声。',
    },
  },
  caption: {
    title: '早餐吃肠粉的都看看：蛋白只有 12 克',
    lines: ['今天早餐：一份鸡蛋肠。', '蛋白 12 克，蔬菜 0 克。', '热量不高，材料不对。', '加一个蛋、一杯豆浆，蛋白到 27 克。'],
  },
}

const PROFILE = { name: 'AI说食谱', gender: 'male', age: 42, height: 175, weight: 67, activity: 'sedentary', goal: 'health' }

const llmReturning = payload => ({
  async prepareCall(config) {
    return {
      config,
      async *stream() {
        yield { type: 'text-delta', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }
      },
    }
  },
})

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

test('POST analyze 产出四页结构：封面/盘子/体检/改一处/文案', async () => {
  let seen = null
  const llm = {
    async prepareCall(config) {
      return {
        config,
        async *stream(request) {
          seen = request
          yield { type: 'text-delta', text: JSON.stringify(DECK) }
        },
      }
    },
  }
  const { handler } = makeCtx({ llm, selection: { provider: 'deepseek-account', model: 'deepseek-flash' } })
  const { status, json: body } = await call(handler, 'POST', '/analyze', { type: '早餐', text: '早餐，一份鸡蛋肠', profile: PROFILE })
  assert.equal(status, 200)
  assert.equal(body.fallback, false)
  const r = body.result
  assert.equal(r.version, 2)
  // 封面
  assert.deepEqual(r.cover.lines, ['一份鸡蛋肠', '蛋白只有 12 克'])
  assert.equal(r.cover.emphasis, '只有 12 克')
  assert.equal(r.cover.sub.length, 2)
  // 盘子：mine 归一到 100，guide 固定三项
  assert.ok(r.plate.mine.reduce((sum, row) => sum + row.pct, 0) === 100)
  assert.deepEqual(r.plate.guide, [
    { label: '菜', pct: 40, tone: 'veg' },
    { label: '谷薯', pct: 30, tone: 'carb' },
    { label: '蛋白', pct: 30, tone: 'protein' },
  ])
  // 体检：三行；建议值和状态由 Host 算
  assert.equal(r.exam.rows.length, 3)
  const [protein, veg, grain] = r.exam.rows
  assert.equal(protein.label, '蛋白质')
  assert.equal(protein.value, 12)
  assert.equal(protein.tone, 'mid')
  assert.equal(protein.status, '差一点')
  assert.deepEqual(protein.target, ['建议 27g', '全天 80g'])
  assert.deepEqual(veg.target, ['建议 100g', '全天 300g+'])
  assert.deepEqual(grain.target, ['建议 20g', '全天 50g+'])
  assert.equal(veg.tone, 'low')
  assert.equal(veg.status, '空的')
  assert.equal(veg.percent, 0)
  assert.equal(grain.value, 0)
  // 改一处：三条，第一条 strong
  assert.equal(r.fix.rows.length, 3)
  assert.equal(r.fix.rows[0].strong, true)
  assert.equal(r.fix.rows[1].strong, false)
  assert.equal(r.fix.rows[0].no, '01')
  assert.equal(r.fix.ask.options.length, 2)
  // 文案：标题 + 一句一行 + 四个话题，且没有备注行
  assert.equal(r.post.title, '早餐吃肠粉的都看看：蛋白只有 12 克')
  assert.equal(r.post.lines.length, 4)
  assert.deepEqual(r.post.tags, ['#AI说餐谱', '#早餐', '#上班族', '#久坐族'])
  assert.ok(!r.post.text.includes('备注'))
  assert.ok(r.post.text.includes('#AI说餐谱'))
  // 请求必须带 sessionId（opencode-go 等 Provider 缺了会 400 MissingSessionID）
  assert.equal(typeof seen.sessionId, 'string')
  assert.ok(seen.sessionId.length > 0)
  // 提示词带上本餐参考
  assert.match(seen.system, /四页图文/)
  assert.match(seen.messages[0].content[0].text, /本餐参考/)
})

test('强调片段不在原文里时会被丢掉，不报错', async () => {
  const broken = JSON.parse(JSON.stringify(DECK))
  broken.cover.emphasis = '不存在的片段'
  broken.plate.insight.bold = '也不存在'
  broken.fix.why.bold = '还是没有'
  const { handler } = makeCtx({ llm: llmReturning(broken), selection: { provider: 'p', model: 'm' } })
  const { json: body } = await call(handler, 'POST', '/analyze', { type: '早餐', text: '鸡蛋一个' })
  assert.equal(body.result.cover.emphasis, '')
  assert.equal(body.result.plate.insight.bold, '')
  assert.equal(body.result.fix.why.bold, '')
})

test('模型返回超长内容时全部截断到卡片上限', async () => {
  const bloated = {
    score: 70,
    cover: {
      lines: ['这一行特别特别长超过十个字了', '第二行也特别特别长超过十个字了', '第三行多余'],
      emphasis: '一'.repeat(20),
      sub: ['第一句'.repeat(20), '第二句'.repeat(20), '第三句多余'],
    },
    plate: {
      title: '这个标题明显超过了十个字的限制还要继续写',
      mine: [
        { label: '米饭和面条', pct: 40, tone: 'nonsense' },
        { label: '蛋白质', pct: 30, tone: 'protein' },
        { label: '蔬菜', pct: 30, tone: 'veg' },
        { label: '第四个', pct: 10, tone: 'carb' },
      ],
      insight: { text: '很长的一句话'.repeat(10), bold: '很长的一句话' },
    },
    exam: {
      title: '这个标题也超过十个字了',
      rows: [{ label: '蛋白质', value: 99999 }, { label: '蔬菜', value: -5 }],
      insight: '这一句点评明显超过十四个字了还不止',
      say: { text: '体感'.repeat(59), bold: '体感' },
    },
    fix: {
      title: '这个动作标题超过十二个字还要继续写下去',
      rows: [{ title: '动作'.repeat(20), result: '结果'.repeat(20) }, { title: '' }, {}, {}, {}],
      why: { text: '表态'.repeat(30), bold: '表态' },
      faq: { q: '问题超过十个字了', a: { text: '答案'.repeat(20), bold: '答案' } },
      ask: { q: '问题'.repeat(30), options: ['① 选项一很长很长', '② 选项二很长很长', '③ 多余'], hint: '提示'.repeat(20) },
    },
    caption: { title: '标题'.repeat(30), lines: ['一句'.repeat(30), '', '第三句', '第四句', '第五句', '第六句', '第七句'] },
  }
  const { handler } = makeCtx({ llm: llmReturning(bloated), selection: { provider: 'p', model: 'm' } })
  const { status, json: body } = await call(handler, 'POST', '/analyze', { type: '午餐', text: '米饭一碗+红烧肉三块' })
  assert.equal(status, 200)
  const r = body.result
  assert.equal(r.cover.lines.length, 2)
  assert.ok(r.cover.lines.every(line => line.length <= 10))
  assert.equal(r.cover.sub.length, 2)
  assert.ok(r.cover.sub.every(line => line.length <= 15))
  assert.ok(r.plate.title.length <= 12)
  assert.ok(r.plate.mine.length <= 3)
  assert.ok(r.plate.mine.every(row => row.label.length <= 5 && ['veg', 'carb', 'protein'].includes(row.tone)))
  assert.equal(r.plate.mine.reduce((sum, row) => sum + row.pct, 0), 100)
  assert.equal(r.exam.rows.length, 3)
  assert.equal(r.exam.rows[0].value, 2000)
  assert.equal(r.exam.rows[1].value, 0)
  assert.ok(r.exam.rows.every(row => row.percent >= 0 && row.percent <= 100))
  assert.ok(r.exam.insight.length <= 16)
  assert.equal(r.fix.rows.length, 3)
  assert.ok(r.fix.rows.every(row => row.title.length <= 15 && row.result.length <= 13))
  assert.ok(r.fix.title.length <= 13)
  assert.ok(r.fix.ask.options.length === 2)
  assert.ok(r.post.title.length <= 21)
  assert.ok(r.post.lines.length <= 6)
  assert.ok(r.post.lines.every(line => line.length <= 24))
})

test('模型输出不是 JSON 时降级为本地估算，仍是四页结构', async () => {
  const { handler } = makeCtx({ llm: llmReturning('抱歉，我无法完成。'), selection: { provider: 'p', model: 'm' } })
  const { status, json: body } = await call(handler, 'POST', '/analyze', { type: '晚餐', text: '面条一碗+两个鸡蛋', profile: PROFILE })
  assert.equal(status, 200)
  assert.equal(body.fallback, true)
  assert.match(body.notice, /食物表/)
  assert.equal(body.result.version, 2)
  assert.equal(body.result.exam.rows.length, 3)
  assert.equal(body.result.fix.rows.length, 3)
  assert.ok(body.result.cover.lines.length === 2)
})

test('没有模型时直接走本地估算', async () => {
  const { handler } = makeCtx()
  const { json: body } = await call(handler, 'POST', '/analyze', { type: '早餐', text: '早餐，鸡蛋一个+玉米一根', profile: PROFILE })
  assert.equal(body.fallback, true)
  assert.equal(body.result.mealText, '早餐，鸡蛋一个+玉米一根')
  assert.equal(body.result.plate.guide.length, 3)
  assert.ok(body.result.post.text.includes('#AI说餐谱'))
})

test('空餐次输入被拒绝', async () => {
  const { handler } = makeCtx()
  const { status } = await call(handler, 'POST', '/analyze', { type: '早餐', text: ' ' })
  assert.equal(status, 400)
})

test('POST save 写入四张 PNG + 文案并记录路径', async () => {
  const { handler } = makeCtx()
  await call(handler, 'POST', '/analyze', { type: '早餐', text: '鸡蛋一个+玉米一根', profile: PROFILE })
  const saved = await call(handler, 'POST', '/save', {
    files: [
      { kind: 'p1', name: '01-封面', png: SAMPLE_PNG },
      { kind: 'p2', name: '02-盘子', png: SAMPLE_PNG },
      { kind: 'p3', name: '03-体检', png: SAMPLE_PNG },
      { kind: 'p4', name: '04-改一处', png: SAMPLE_PNG },
    ],
    texts: [{ name: '05-图文文案.md', content: '标题\n\n正文\n\n#AI说餐谱 #早餐' }],
  })
  assert.equal(saved.status, 200)
  assert.deepEqual(saved.json.files, ['01-封面.png', '02-盘子.png', '03-体检.png', '04-改一处.png', '05-图文文案.md'])
  const info = await stat(join(saved.json.path, '01-封面.png'))
  assert.ok(info.size > 8)
  const text = await readFile(join(saved.json.path, '05-图文文案.md'), 'utf8')
  assert.match(text, /#AI说餐谱/)
  const bytes = await readFile(join(saved.json.path, '01-封面.png'))
  assert.equal(bytes.subarray(0, 4).toString('hex'), '89504e47')
  // NUTRITION_DESK_NO_OPEN=1 时只回报路径，不真的调起资源管理器
  const revealed = await call(handler, 'POST', '/reveal', { from: 'last-analyze' })
  assert.equal(revealed.status, 400)
  assert.equal(revealed.json.path, saved.json.path)
  assert.match(revealed.json.error, /重新点一次/)
})

test('目录被删掉后 reveal 不再弹「位置不可用」', async () => {
  const { handler } = makeCtx()
  await call(handler, 'POST', '/analyze', { type: '早餐', text: '鸡蛋一个+玉米一根', profile: PROFILE })
  const saved = await call(handler, 'POST', '/save', {
    files: [{ kind: 'p1', name: '01-封面', png: SAMPLE_PNG }],
  })
  await rm(saved.json.path, { recursive: true, force: true })
  const revealed = await call(handler, 'POST', '/reveal', {})
  assert.equal(revealed.status, 400)
  assert.equal(revealed.json.path, saved.json.path)
  assert.match(revealed.json.error, /已经不在了/)
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

test('建议里的卡路里数字被剥掉', async () => {
  const withKcal = JSON.parse(JSON.stringify(DECK))
  withKcal.fix.rows[0].result = '蛋白 12g → 27g（约 561 kcal）'
  const { handler } = makeCtx({ llm: llmReturning(withKcal), selection: { provider: 'p', model: 'm' } })
  const { json: body } = await call(handler, 'POST', '/analyze', { type: '午餐', text: '米饭一碗+红烧肉三块' })
  assert.ok(!/kcal|千卡|大卡/i.test(body.result.fix.rows[0].result), body.result.fix.rows[0].result)
  assert.ok(body.result.fix.rows[0].result.includes('27g'))
})

test('口径说明按餐次给出不同侧重', async () => {
  const { handler } = makeCtx()
  const noteFor = async type => {
    const { json: body } = await call(handler, 'POST', '/analyze', { type, text: `${type}，鸡蛋一个+玉米一根`, profile: PROFILE })
    return body.result.plate.note
  }
  const breakfast = await noteFor('早餐')
  const lunch = await noteFor('午餐')
  const dinner = await noteFor('晚餐')
  assert.match(breakfast, /早餐也应有蔬果/)
  assert.match(breakfast, /蛋白质更要盯住/)
  assert.match(lunch, /午餐最容易做到/)
  assert.match(dinner, /晚餐清淡少油/)
  assert.notEqual(breakfast, lunch)
  assert.notEqual(lunch, dinner)
  // 早餐的默认点评优先说蛋白
  const { json: body } = await call(handler, 'POST', '/analyze', { type: '早餐', text: '早餐，白粥一碗+咸菜', profile: PROFILE })
  assert.match(body.result.exam.insight, /蛋白/)
})

test('未知路由 404', async () => {
  const { handler } = makeCtx()
  const { status } = await call(handler, 'GET', '/nope')
  assert.equal(status, 404)
})

test('GET state 返回每日三餐得分历史', async () => {
  const { handler } = makeCtx()
  await call(handler, 'POST', '/analyze', { type: '早餐', text: '鸡蛋一个+玉米一根', profile: PROFILE })
  await call(handler, 'POST', '/analyze', { type: '午餐', text: '米饭一碗+红烧肉三块', profile: PROFILE })
  const { status, json: body } = await call(handler, 'GET', '/state')
  assert.equal(status, 200)
  assert.ok(Array.isArray(body.history) && body.history.length >= 1)
  const day = body.history[body.history.length - 1]
  assert.ok(day.date && day.label && day.weekday)
  assert.ok(Array.isArray(day.meals) && day.meals.length >= 2)
  assert.ok(Number.isFinite(day.average))
  assert.ok(body.historySummary.count >= 2)
  assert.equal(body.result.version, 2)
})

test('GET state 不回填旧版（没有 version 2）的结果', async () => {
  const { handler } = makeCtx()
  // 直接写一份 v1 老数据进存储
  const { mkdir, writeFile } = await import('node:fs/promises')
  const file = join(root, 'dsh-home', 'nutrition-desk', 'state.json')
  await mkdir(join(root, 'dsh-home', 'nutrition-desk'), { recursive: true })
  await writeFile(file, JSON.stringify({
    version: 1,
    profile: PROFILE,
    last: { type: '早餐', text: '旧数据', at: new Date().toISOString(), result: { headline: '旧的', score: 60 } },
    meals: [],
  }))
  const { json: body } = await call(handler, 'GET', '/state')
  assert.equal(body.result, null)
})

test('未鉴权时拒绝（没有 connection 服务）', async () => {
  const routes = []
  apply({ effect: fn => fn(), get: () => undefined, webServer: { register: o => (routes.push(o), () => {}) } })
  const { res, out } = mockResponse()
  await routes[0].handler(mockRequest('GET', '/state'), res)
  assert.equal(out.statusCode, 403)
})

