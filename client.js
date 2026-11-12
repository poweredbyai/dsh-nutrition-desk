window.__ModuleLoader__.load({
  id: 'dsh-nutrition-desk',
  factory(require) {
    const React = require('react')
    const h = React.createElement
// ---- src/card.js ----
/* ============================================================
 * AI说餐谱 · Canvas 卡片渲染器（纯函数，无依赖，无副作用）
 * 逻辑尺寸 1080 x 1440，由调用方创建 canvas 并设置宽高。
 * 内部所有顶层名字均以 card 前缀，避免与其他文件的作用域冲突。
 * ============================================================ */

var cardW = 1080
var cardH = 1440
var cardPad = 108
var cardRight = cardW - cardPad
var cardInner = cardRight - cardPad

/* 账号水印：优先渲染 data.handle（形如「@我的厨房」）；
   为空或不以 @ 开头时回退到固定账号。 */
var cardAccountFallback = '@AI说餐谱'
var cardClaySoft = '#F6E4D9'
var cardDisclaimer = '营养数据为 AI 估算，仅供参考'

var cardPaper = '#F7F4EC'
var cardInk = '#1B1A17'
var cardInk2 = '#6B6459'
var cardRule = '#DCD4C3'
var cardGreen = '#2E6B4F'
var cardGreenSoft = '#E6EFE3'
var cardClay = '#C05F32'
var cardYellow = '#F0D66B'
var cardDeep = '#1E4335'
var cardCream = '#F3EDDF'
var cardAmber = '#BE8626'
var cardTrack = '#E5DECC'

var cardSans = '"Source Han Sans CN", "Source Han Sans SC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
var cardNumSans = '"Bahnschrift", "DIN Alternate", "Source Han Sans CN", "Microsoft YaHei", sans-serif'

/* ---------------- 基础工具 ---------------- */

function cardF(size, weight) {
  return (weight || 400) + ' ' + size + 'px ' + cardSans
}

function cardNumF(size, weight) {
  return (weight || 700) + ' ' + size + 'px ' + cardNumSans
}

function cardUse(ctx, size, weight, color) {
  ctx.font = cardF(size, weight)
  if (color) ctx.fillStyle = color
}

function cardNum(ctx, size, weight, color) {
  ctx.font = cardNumF(size, weight)
  if (color) ctx.fillStyle = color
}

function cardStr(v, fallback) {
  if (v === null || v === undefined) return fallback === undefined ? '' : fallback
  return String(v)
}

function cardInt(v, fallback) {
  var n = Number(v)
  return isFinite(n) ? Math.round(n) : fallback
}

function cardClamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function cardRoundRect(ctx, x, y, w, h, r) {
  var rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

/* 带字距的小标签；align: left | right */
function cardSpaced(ctx, text, x, y, tracking, color, align) {
  var str = cardStr(text)
  var chars = str.split('')
  var widths = []
  var total = 0
  var i
  for (i = 0; i < chars.length; i++) {
    var cw = ctx.measureText(chars[i]).width
    widths.push(cw)
    total += cw
  }
  if (chars.length > 1) total += tracking * (chars.length - 1)
  var cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x
  ctx.save()
  ctx.textAlign = 'left'
  if (color) ctx.fillStyle = color
  for (i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y)
    cx += widths[i] + tracking
  }
  ctx.restore()
  return total
}

function cardDot(ctx, cx, cy, r, color) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function cardHr(ctx, y, x1, x2, color, w) {
  ctx.save()
  ctx.fillStyle = color || cardRule
  ctx.fillRect(x1, y, (x2 - x1), w || 1.5)
  ctx.restore()
}

/* ---------------- 文本切分与折行 ---------------- */

var cardClosePunct = '，。、；：？！）】》」』…·%”’'
var cardOpenPunct = '（【《「『“‘'
var cardGlueBack = '+＋/&'

function cardIsWordChar(c) {
  return /[A-Za-z0-9@#&'._+\-/=]/.test(c)
}

/* 把文本切成排版单元：中文按字，英文/数字按词，标点并入相邻单元 */
function cardTokens(text) {
  var str = cardStr(text)
  var raw = []
  var i = 0
  while (i < str.length) {
    var c = str.charAt(i)
    if (c === ' ') {
      raw.push(' ')
      i++
      continue
    }
    if (cardIsWordChar(c)) {
      var j = i
      while (j < str.length && cardIsWordChar(str.charAt(j))) j++
      raw.push(str.slice(i, j))
      i = j
      continue
    }
    raw.push(c)
    i++
  }
  /* 收尾标点、独立连接符粘到前一个单元，避免行首出现逗号或「+」 */
  var merged = []
  for (i = 0; i < raw.length; i++) {
    var t = raw[i]
    if (cardClosePunct.indexOf(t) >= 0 && merged.length) {
      merged[merged.length - 1] += t
      continue
    }
    if (t === ' ' && merged.length) {
      merged[merged.length - 1] += t
      continue
    }
    if (t.length === 1 && cardGlueBack.indexOf(t) >= 0 && merged.length) {
      merged[merged.length - 1] += t
      continue
    }
    merged.push(t)
  }
  /* 起首标点粘到后一个单元 */
  var out = []
  for (i = 0; i < merged.length; i++) {
    if (cardOpenPunct.indexOf(merged[i]) >= 0 && i + 1 < merged.length) {
      merged[i + 1] = merged[i] + merged[i + 1]
      continue
    }
    out.push(merged[i])
  }
  return out
}

function cardEllipsize(ctx, text, maxW) {
  var str = cardStr(text)
  if (ctx.measureText(str).width <= maxW) return str
  var chars = str.split('')
  var lo = 0
  var hi = chars.length
  while (lo < hi) {
    var mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(chars.slice(0, mid).join('') + '…').width <= maxW) lo = mid
    else hi = mid - 1
  }
  return chars.slice(0, Math.max(0, lo)).join('') + '…'
}

/* 贪心折行：返回行数组，超过 maxLines 时末行加省略号 */
function cardWrap(ctx, text, maxW, maxLines) {
  var tokens = cardTokens(text)
  var lines = []
  var cur = ''
  var i
  for (i = 0; i < tokens.length; i++) {
    var t = tokens[i]
    var test = cur + t
    if (cur !== '' && ctx.measureText(test).width > maxW) {
      lines.push(cur)
      cur = t.replace(/^ +/, '')
    } else {
      cur = test
    }
  }
  if (cur !== '') lines.push(cur)
  if (!lines.length) lines = ['']
  if (lines.length > maxLines) {
    var tail = lines.slice(maxLines).join('')
    var kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = cardEllipsize(ctx, kept[maxLines - 1] + tail, maxW)
    lines = kept
  }
  return lines
}

/* 均衡折行：在「最少行数」的前提下让各行长度接近，视觉更稳 */
function cardWrapBal(ctx, text, maxW, maxLines) {
  var str = cardStr(text)
  var tokens = cardTokens(str)
  if (tokens.length < 2) return [str]
  var i, j, k
  var widths = []
  var weights = []
  var charUnit = ctx.measureText('中').width || 1
  for (i = 0; i < tokens.length; i++) {
    var tw = ctx.measureText(tokens[i]).width
    widths.push(tw)
    var isWord = tokens[i].length > 1 && cardIsWordChar(tokens[i].charAt(0))
    weights.push(isWord ? Math.max(1, Math.round(tw / (charUnit * 0.56))) : 1)
  }
  /* 贪心求最少行数 */
  var nmin = 1
  var acc = 0
  for (i = 0; i < tokens.length; i++) {
    if (acc > 0 && acc + widths[i] > maxW) {
      nmin++
      acc = widths[i]
    } else {
      acc += widths[i]
    }
  }
  if (nmin > maxLines) {
    return cardWrap(ctx, str, maxW, maxLines)
  }
  var totalW = 0
  var totalV = 0
  for (i = 0; i < tokens.length; i++) {
    totalW += widths[i]
    totalV += weights[i]
  }
  var target = totalV / nmin
  var n = tokens.length
  var INF = 1e15
  /* dp[k][i]：前 i 个单元排 k 行，最小平方偏差 */
  var dp = []
  var from = []
  for (k = 0; k <= nmin; k++) {
    dp.push([])
    from.push([])
    for (i = 0; i <= n; i++) {
      dp[k].push(INF)
      from[k].push(-1)
    }
  }
  dp[0][0] = 0
  for (k = 1; k <= nmin; k++) {
    for (i = 1; i <= n; i++) {
      var lw = 0
      var lv = 0
      for (j = i - 1; j >= 0; j--) {
        lw += widths[j]
        lv += weights[j]
        if (lw > maxW + 0.5) break
        if (dp[k - 1][j] >= INF) continue
        var cost = dp[k - 1][j] + (lv - target) * (lv - target)
        if (cost < dp[k][i]) {
          dp[k][i] = cost
          from[k][i] = j
        }
      }
    }
  }
  var lines = []
  var pos = n
  for (k = nmin; k >= 1; k--) {
    var start = from[k][pos]
    if (start < 0) return cardWrap(ctx, str, maxW, maxLines)
    lines.unshift(tokens.slice(start, pos).join(''))
    pos = start
  }
  return lines
}

function cardLines(ctx, lines, x, y, lh, color, align) {
  ctx.save()
  ctx.fillStyle = color
  ctx.textAlign = align || 'left'
  for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + i * lh)
  ctx.restore()
}

/* 折行时别把常用两字词拆开（蛋白 / 纤维 / 营养 …），否则大字标题会出现「蛋」换行 */
var cardKeepPairs = [
  '蛋白', '纤维', '脂肪', '碳水', '营养', '蔬菜', '水果', '热量', '主食', '鸡蛋', '玉米', '牛奶', '酸奶',
  '米饭', '早餐', '午餐', '晚餐', '加餐', '豆制', '制品', '维生', '生素', '叶酸', '菌菇', '全麦', '杂粮',
  '血糖', '饱腹', '水分', '能量', '结构', '建议', '记录', '缺口', '一拳', '掌心', '两拳', '一半', '左右',
  '粗粮', '精面', '外卖', '食堂', '清淡', '油盐', '甜食', '零食', '饮料', '作息'
]

/* 三字以上的常用词：拆开更难看，单独处理 */
var cardKeepLongWords = ['蛋白质', '饱腹感', '维生素', '矿物质', '膳食纤维', '碳水化合物']

/* 把落在行尾的半个词挪到下一行（只在下一行放得下时挪） */
function cardFixBreaks(ctx, lines, maxW) {
  if (!Array.isArray(lines) || lines.length < 2) return lines
  var out = lines.slice()
  var i, w
  for (i = 0; i < out.length - 1; i++) {
    var a = cardStr(out[i])
    var b = cardStr(out[i + 1])
    if (!a || !b) continue
    /* 先处理三字以上的词 */
    var moved = false
    for (w = 0; w < cardKeepLongWords.length; w++) {
      var word = cardKeepLongWords[w]
      var headLen = word.length - 1
      if (a.length < headLen + 1) continue
      if (a.slice(-headLen) !== word.slice(0, headLen)) continue
      if (b.charAt(0) !== word.slice(-1)) continue
      var headLong = a.slice(0, -headLen)
      if (!headLong) continue
      var nextLong = a.slice(-headLen) + b
      if (ctx.measureText(nextLong).width > maxW + 0.5) continue
      out[i] = headLong
      out[i + 1] = nextLong
      moved = true
      break
    }
    if (moved) continue
    var pair = a.slice(-1) + b.charAt(0)
    if (cardKeepPairs.indexOf(pair) < 0) continue
    var head = a.slice(0, -1)
    if (!head) continue
    var next = a.slice(-1) + b
    if (ctx.measureText(next).width > maxW + 0.5) continue
    out[i] = head
    out[i + 1] = next
  }
  return out
}

/* 行与行之间是否还残留断词 */
function cardHasSplit(lines) {
  if (!Array.isArray(lines) || lines.length < 2) return false
  var i, w
  for (i = 0; i < lines.length - 1; i++) {
    var a = cardStr(lines[i])
    var b = cardStr(lines[i + 1])
    if (!a || !b) continue
    for (w = 0; w < cardKeepLongWords.length; w++) {
      var word = cardKeepLongWords[w]
      var headLen = word.length - 1
      if (a.length >= headLen && a.slice(-headLen) === word.slice(0, headLen) && b.charAt(0) === word.slice(-1)) return true
    }
    if (cardKeepPairs.indexOf(a.slice(-1) + b.charAt(0)) >= 0) return true
  }
  return false
}

/* 大字标题：优先保证「不拆常用词」，必要时把字号降一档；都不行才接受拆词 */
function cardWrapNoSplit(ctx, text, maxW, maxLines, sizes, weight) {
  var fallback = null
  var i, k
  for (i = 0; i < sizes.length; i++) {
    ctx.font = cardF(sizes[i], weight || 700)
    var lines = cardWrapBal(ctx, text, maxW, maxLines)
    var widest = 0
    for (k = 0; k < lines.length; k++) {
      widest = Math.max(widest, ctx.measureText(lines[k]).width)
    }
    if (!fallback) fallback = { size: sizes[i], lines: cardFixBreaks(ctx, lines, maxW) }
    if (widest > maxW + 0.5) continue
    var fixed = cardFixBreaks(ctx, lines, maxW)
    if (!cardHasSplit(fixed)) return { size: sizes[i], lines: fixed }
  }
  return fallback || { size: sizes[sizes.length - 1], lines: [cardStr(text)] }
}

/* 大字标题自适应：从 sizes 里挑第一个任何行都不越界的字号，下限由 sizes 末尾给出 */
function cardFitBlock(ctx, text, maxW, maxLines, sizes, weight) {
  var best = { size: sizes[sizes.length - 1], lines: [cardStr(text)] }
  for (var i = 0; i < sizes.length; i++) {
    ctx.font = cardF(sizes[i], weight || 700)
    var lines = cardFixBreaks(ctx, cardWrapBal(ctx, text, maxW, maxLines), maxW)
    var widest = 0
    for (var k = 0; k < lines.length; k++) {
      widest = Math.max(widest, ctx.measureText(lines[k]).width)
    }
    best = { size: sizes[i], lines: lines, widest: widest }
    if (widest <= maxW + 0.5) break
  }
  if (best.widest > maxW + 0.5) {
    ctx.font = cardF(best.size, weight || 700)
    best.lines = best.lines.map(function (ln) { return cardEllipsize(ctx, ln, maxW) })
  }
  return best
}

function cardArrow(ctx, x, cy, len, color, lw) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lw || 3.4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x, cy)
  ctx.lineTo(x + len, cy)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + len - 14, cy - 13)
  ctx.lineTo(x + len, cy)
  ctx.lineTo(x + len - 14, cy + 13)
  ctx.stroke()
  ctx.restore()
}

/* ---------------- 底色 ---------------- */

function cardPaintPaper(ctx) {
  ctx.fillStyle = cardPaper
  ctx.fillRect(0, 0, cardW, cardH)
  var g = ctx.createLinearGradient(0, 0, 0, cardH)
  g.addColorStop(0, 'rgba(255,252,243,0.65)')
  g.addColorStop(0.45, 'rgba(247,244,236,0)')
  g.addColorStop(1, 'rgba(231,223,205,0.38)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, cardW, cardH)
}

function cardPaintDeep(ctx) {
  ctx.fillStyle = cardDeep
  ctx.fillRect(0, 0, cardW, cardH)
  var g = ctx.createLinearGradient(0, -120, cardW * 0.55, cardH)
  g.addColorStop(0, 'rgba(58,110,86,0.42)')
  g.addColorStop(0.55, 'rgba(30,67,53,0)')
  g.addColorStop(1, 'rgba(10,32,24,0.42)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, cardW, cardH)
}

/* ---------------- 公共区块：页眉 / 页脚 ---------------- */

function cardHeader(ctx, label, data, dark) {
  var ink = dark ? cardCream : cardInk2
  var accent = dark ? cardYellow : cardGreen
  cardDot(ctx, cardPad + 5, 123, 5.5, accent)
  cardUse(ctx, 26, 600, ink)
  cardSpaced(ctx, label, cardPad + 26, 132, 2.4, ink)

  var dateText = cardStr(data.dateText).trim()
  if (dateText) {
    cardUse(ctx, 23, 400, dark ? 'rgba(243,237,223,0.62)' : cardInk2)
    ctx.textAlign = 'right'
    ctx.fillText(cardEllipsize(ctx, dateText, 420), cardRight, 132)
    ctx.textAlign = 'left'
  }

  cardHr(ctx, 174, cardPad, cardRight, dark ? 'rgba(243,237,223,0.2)' : cardRule, 1.5)
  ctx.save()
  ctx.fillStyle = accent
  ctx.fillRect(cardPad, 172.5, 76, 3)
  ctx.restore()
}

/* 账号水印取值：handle 合法（非空且以 @ 开头）时用 handle，否则回退 */
function cardWatermark(handle) {
  var h = cardStr(handle).trim()
  if (!h || h.charAt(0) !== '@') return cardAccountFallback
  return h
}

/* 纸卡页脚：分隔线 + 右下账号水印 + 画布底部居中的免责行 */
function cardFooter(ctx, data) {
  cardHr(ctx, 1250, cardPad, cardRight, cardRule, 1.2)

  cardUse(ctx, 24, 600, cardInk)
  ctx.textAlign = 'right'
  ctx.fillText(cardEllipsize(ctx, cardWatermark(data.handle), 560), cardRight, 1296)
  ctx.textAlign = 'left'

  cardUse(ctx, 19, 400, 'rgba(107,100,89,0.8)')
  ctx.textAlign = 'center'
  ctx.fillText(cardDisclaimer, cardW / 2, 1344)
  ctx.textAlign = 'left'
}

/* ---------------- analysis ---------------- */

function cardScoreColor(score) {
  if (score >= 75) return cardGreen
  if (score >= 55) return cardAmber
  return cardClay
}

function cardScoreRing(ctx, cx, cy, r, score) {
  var color = cardScoreColor(score)
  ctx.save()
  ctx.lineWidth = 13
  ctx.lineCap = 'round'
  ctx.strokeStyle = cardTrack
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  var pct = cardClamp(score, 0, 100)
  if (pct > 0.5) {
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (pct / 100))
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.textAlign = 'center'
  cardNum(ctx, 78, 700, cardInk)
  ctx.fillText(String(cardInt(score, 0)), cx, cy + 16)
  cardUse(ctx, 22, 500, cardInk2)
  ctx.fillText('分', cx, cy + 52)
  ctx.restore()
}

function cardToneWord(tone) {
  if (tone === 'good') return '达标'
  if (tone === 'watch') return '偏低'
  return '不足'
}

/* 「蛋白质 18g 达标 · 碳水 52g 偏低 · 脂肪 14g 不足 · 纤维 3g 不足」 */
function cardMacroPhrase(macros) {
  if (!Array.isArray(macros)) return ''
  var parts = []
  var i
  for (i = 0; i < macros.length && i < 4; i++) {
    var m = macros[i] || {}
    var name = cardStr(m.name).trim()
    if (!name) continue
    var value = cardStr(m.value).trim()
    parts.push(name + (value ? ' ' + value : '') + ' ' + cardToneWord(m.tone))
  }
  return parts.join(' · ')
}

/* 做到了 / 差一点：两块等宽浅色卡片，先算排版再画 */
function cardBuildPillars(ctx, strengths, gaps) {
  var gapX = 24
  var colW = (cardInner - gapX) / 2
  var padX = 30
  var textX = 58
  var textW = colW - textX - padX
  var cols = [
    { title: '做到了', tone: cardGreen, bg: cardGreenSoft, x: cardPad, items: Array.isArray(strengths) ? strengths.slice(0, 2) : [] },
    { title: '差一点', tone: cardClay, bg: cardClaySoft, x: cardPad + colW + gapX, items: Array.isArray(gaps) ? gaps.slice(0, 2) : [] }
  ]
  var tallest = 0
  var c
  for (c = 0; c < cols.length; c++) {
    var col = cols[c]
    col.lines = []
    cardUse(ctx, 31, 600, cardInk)
    var total = 0
    for (var i = 0; i < col.items.length; i++) {
      var ls = cardWrapBal(ctx, cardStr(col.items[i]), textW, 2)
      col.lines.push(ls)
      total += ls.length
    }
    if (total > tallest) tallest = total
  }
  var lineCount = Math.max(2, tallest)
  var naturalH = 120 + (lineCount - 1) * 46 + 44
  var h = Math.max(272, naturalH)
  var offset = Math.max(0, (h - naturalH) / 2)
  return {
    cols: cols, w: colW, h: h,
    padX: padX, textX: textX, lineH: 46,
    titleY: 60 + offset, itemY: 122 + offset
  }
}

function cardDrawPillars(ctx, pillars, top) {
  var c
  for (c = 0; c < pillars.cols.length; c++) {
    var col = pillars.cols[c]
    ctx.save()
    ctx.fillStyle = col.bg
    cardRoundRect(ctx, col.x, top, pillars.w, pillars.h, 18)
    ctx.fill()
    ctx.restore()

    cardUse(ctx, 32, 700, col.tone)
    cardSpaced(ctx, col.title, col.x + pillars.padX, top + pillars.titleY, 2.4, col.tone)

    var y = top + pillars.itemY
    for (var i = 0; i < col.lines.length; i++) {
      cardDot(ctx, col.x + 40, y - 10, 5, col.tone)
      cardUse(ctx, 31, 600, cardInk)
      for (var k = 0; k < col.lines[i].length; k++) {
        ctx.fillText(col.lines[i][k], col.x + pillars.textX, y)
        y += pillars.lineH
      }
    }
  }
}

function cardDrawAnalysis(ctx, data) {
  var r = data.result || {}
  var mealType = cardStr(data.mealType || r.mealType || '一餐')
  cardPaintPaper(ctx)
  cardHeader(ctx, '营养分析 · ' + mealType, data)

  /* 大标题 */
  var headTop = 214
  var ringR = 95
  var ringCx = 870
  var ringOuter = ringR + 6.5
  var headW = ringCx - ringOuter - 56 - cardPad
  var headBlock = cardWrapNoSplit(ctx, cardStr(r.headline).trim() || '这一餐的营养', headW, 2, [84, 80, 76, 72], 700)
  var headSize = headBlock.size
  var headLh = Math.round(headSize * 1.28)
  var headLines = headBlock.lines
  cardUse(ctx, headSize, 700, cardInk)
  cardLines(ctx, headLines, cardPad, headTop + headSize * 0.86, headLh, cardInk)

  /* 评分圆环 */
  var score = cardInt(r.score, 0)
  var titleCenter = headTop + (headLines.length * headLh) / 2
  var ringCy = Math.max(titleCenter, 174 + 12 + ringOuter)
  cardScoreRing(ctx, ringCx, ringCy, ringR, score)
  var ringBottom = ringCy + ringOuter

  /* 摘要 */
  var summary = cardStr(r.summary)
  var titleBottom = headTop + headLines.length * headLh
  var sumTop = Math.max(titleBottom + 28, ringBottom + 24)
  var sumLines = []
  if (summary) {
    cardUse(ctx, 31, 400, cardInk2)
    sumLines = cardFixBreaks(ctx, cardWrapBal(ctx, summary, cardInner, 2), cardInner)
    cardLines(ctx, sumLines, cardPad, sumTop + 31, 48, cardInk2)
  }
  var contentBottom = summary ? sumTop + 31 + (sumLines.length - 1) * 48 + 12 : titleBottom

  /* 本餐能量与结构：弱化数据，只留两行文字概括 */
  var energy = r.energy || {}
  var overviewLabel = contentBottom + 56
  cardUse(ctx, 23, 600, cardInk2)
  cardSpaced(ctx, '本餐能量与结构', cardPad, overviewLabel, 2.6, cardInk2)

  var kcal = cardInt(energy.kcal, 0)
  var ratioRaw = cardInt(energy.ratio, 0)
  var energyLine = '约 ' + kcal + ' kcal'
  if (ratioRaw > 0) energyLine += ' · 占全天目标 ' + ratioRaw + '%'
  cardUse(ctx, 28, 500, cardInk2)
  ctx.fillText(energyLine, cardPad, overviewLabel + 50)

  var macroPhrase = cardMacroPhrase(r.macros)
  var phraseY = overviewLabel + 96
  if (macroPhrase) {
    cardUse(ctx, 25, 400, cardInk2)
    var phraseLines = cardWrap(ctx, macroPhrase, cardInner, 2)
    cardLines(ctx, phraseLines, cardPad, phraseY, 42, cardInk2)
    contentBottom = phraseY + (phraseLines.length - 1) * 42 + 12
  } else {
    contentBottom = overviewLabel + 50 + 12
  }

  /* 做到了 / 差一点：两块浅色底卡片，是这张卡的视觉重点 */
  var pillars = cardBuildPillars(ctx, r.strengths, r.gaps)
  var regionTop = contentBottom + 44
  var regionBottom = 1206
  var pillarTop = regionTop
  if (regionBottom - regionTop > pillars.h) {
    pillarTop = regionTop + (regionBottom - regionTop - pillars.h) / 2
  }
  cardDrawPillars(ctx, pillars, pillarTop)

  cardFooter(ctx, data)
}

/* ---------------- advice ---------------- */

function cardSpacedWidth(ctx, text, tracking) {
  var chars = cardStr(text).split('')
  var total = 0
  for (var i = 0; i < chars.length; i++) total += ctx.measureText(chars[i]).width
  if (chars.length > 1) total += tracking * (chars.length - 1)
  return total
}

function cardSwapBand(ctx, top, swap) {
  var chipLabel = '换一换'
  var chipTrack = 1.4
  cardUse(ctx, 19, 700, cardGreenSoft)
  var labelW = cardSpacedWidth(ctx, chipLabel, chipTrack)
  var chipX = cardPad + 32
  var chipW = labelW + 44
  var chipY = top + 31
  var textX = chipX + chipW + 26

  ctx.save()
  ctx.fillStyle = cardGreenSoft
  cardRoundRect(ctx, cardPad, top, cardInner, 96, 12)
  ctx.fill()
  ctx.fillStyle = cardGreen
  cardRoundRect(ctx, chipX, chipY, chipW, 34, 17)
  ctx.fill()
  ctx.restore()

  cardUse(ctx, 19, 700, cardGreenSoft)
  cardSpaced(ctx, chipLabel, chipX + chipW / 2, top + 54, chipTrack, cardGreenSoft, 'center')

  cardUse(ctx, 32, 600, cardInk)
  var text = cardEllipsize(ctx, cardStr(swap), cardRight - textX - 32)
  ctx.fillText(text, textX, top + 60)
}

/* 下一餐引用块：字号放大，块高随行数自适应 */
function cardNextMealMetrics(ctx, nextMeal) {
  cardUse(ctx, 35, 500, cardInk)
  var lines = cardWrapBal(ctx, nextMeal, cardInner - 30, 2)
  var h = 84 + (lines.length - 1) * 56 + 40
  return { lines: lines, h: h }
}

function cardNextMeal(ctx, top, metrics) {
  ctx.save()
  ctx.fillStyle = cardClay
  ctx.fillRect(cardPad, top, 4, metrics.h)
  ctx.restore()
  cardUse(ctx, 22, 700, cardClay)
  cardSpaced(ctx, '下一餐', cardPad + 30, top + 28, 2.6, cardClay)
  cardUse(ctx, 35, 500, cardInk)
  cardLines(ctx, metrics.lines, cardPad + 30, top + 84, 56, cardInk)
}

function cardDrawAdvice(ctx, data) {
  var r = data.result || {}
  var advice = r.advice || {}
  var mealType = cardStr(data.mealType || r.mealType || '一餐')
  cardPaintPaper(ctx)
  cardHeader(ctx, '改进建议 · ' + mealType, data)

  var titleTop = 214
  var titleBlock = cardWrapNoSplit(ctx, cardStr(advice.headline).trim() || '下一餐这样补', cardInner, 2, [70, 66, 62, 58], 700)
  var titleSize = titleBlock.size
  var titleLh = Math.round(titleSize * 1.31)
  var titleLines = titleBlock.lines
  cardUse(ctx, titleSize, 700, cardInk)
  cardLines(ctx, titleLines, cardPad, titleTop + titleSize * 0.86, titleLh, cardInk)
  var titleBottom = titleTop + titleLines.length * titleLh

  var items = Array.isArray(advice.items) ? advice.items.slice(0, 3) : []
  var swap = cardStr(advice.swap).trim()
  var nextMeal = cardStr(advice.nextMeal).trim()

  /* 三条编号建议：只留标题，字号放大，行距放宽 */
  var rowH = 158
  var y = titleBottom + 50
  var k
  for (k = 0; k < items.length; k++) {
    var it = items[k] || {}
    var numText = ('0' + (k + 1)).slice(-2)
    cardNum(ctx, 56, 700, cardGreen)
    ctx.fillText(numText, cardPad, y + 96)
    cardUse(ctx, 46, 700, cardInk)
    ctx.fillText(cardEllipsize(ctx, cardStr(it.title), cardRight - 232), 232, y + 96)
    if (k < items.length - 1) cardHr(ctx, y + rowH, cardPad, cardRight, cardRule, 1)
    y += rowH
  }
  var itemsBottom = y

  /* 底部两个区块：整组在剩余空间里居中 */
  var nextMetrics = nextMeal ? cardNextMealMetrics(ctx, nextMeal) : null
  var groupH = 0
  var groupCount = 0
  if (swap) {
    groupH += 96
    groupCount++
  }
  if (nextMetrics) {
    groupH += nextMetrics.h
    groupCount++
  }
  if (groupCount > 1) groupH += 56

  var regionTop = itemsBottom + 30
  var regionBottom = 1206
  var off = (regionBottom - regionTop - groupH) / 2
  var gy = regionTop + cardClamp(off, 0, 92)

  if (swap) {
    cardSwapBand(ctx, gy, swap)
    gy += 96 + (nextMetrics ? 56 : 0)
  }
  if (nextMetrics) cardNextMeal(ctx, gy, nextMetrics)

  cardFooter(ctx, data)
}

/* ---------------- invite ---------------- */

function cardInviteDecor(ctx) {
  ctx.save()
  ctx.strokeStyle = 'rgba(243,237,223,0.09)'
  ctx.lineWidth = 1.6
  var i
  for (i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(1032, 214, 118 + i * 68, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/* 投稿三步：横向三栏，小字号 + 米色低透明度，填满 CTA 与话题标签之间的空白 */
function cardInviteSteps(ctx, top) {
  var steps = ['拍下你的三餐', '发到评论区', '我帮你看缺口']
  var h = 148
  var colW = cardInner / 3
  var i

  ctx.save()
  ctx.strokeStyle = 'rgba(243,237,223,0.16)'
  ctx.lineWidth = 1.2
  cardRoundRect(ctx, cardPad, top, cardInner, h, 3)
  ctx.stroke()
  ctx.restore()

  for (i = 0; i < steps.length; i++) {
    var cx = cardPad + colW * i + 44
    if (i > 0) {
      ctx.save()
      ctx.strokeStyle = 'rgba(243,237,223,0.13)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cardPad + colW * i, top + 30)
      ctx.lineTo(cardPad + colW * i, top + h - 30)
      ctx.stroke()
      ctx.restore()
    }
    ctx.save()
    ctx.strokeStyle = 'rgba(243,237,223,0.3)'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.arc(cx + 14, top + 42, 15, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    ctx.save()
    ctx.textAlign = 'center'
    cardNum(ctx, 15, 600, 'rgba(243,237,223,0.68)')
    ctx.fillText(String(i + 1), cx + 14, top + 48)
    ctx.restore()
    cardUse(ctx, 26, 400, i === steps.length - 1 ? 'rgba(243,237,223,0.84)' : 'rgba(243,237,223,0.6)')
    ctx.fillText(steps[i], cx, top + 110)
  }
}

function cardDrawInvite(ctx, data) {
  var r = data.result || {}
  var invite = r.invite || {}
  cardPaintDeep(ctx)
  cardInviteDecor(ctx)
  cardHeader(ctx, '投稿引导', data, true)

  /* 黄色小眉标 */
  ctx.save()
  ctx.fillStyle = cardYellow
  cardRoundRect(ctx, cardPad, 252, 72, 9, 4.5)
  ctx.fill()
  ctx.restore()

  /* 巨大问句：11–12 个汉字会自然折成两行；万一单行仍然越界，按 measureText 自动降字号（下限 84px） */
  var qBlock = cardFitBlock(ctx, cardStr(invite.question).trim() || '今天你吃了什么？', cardInner, 2, [104, 98, 92, 88, 84], 700)
  var qSize = qBlock.size
  var qLh = Math.round(qSize * 1.27)
  var qTop = 396
  cardUse(ctx, qSize, 700, cardCream)
  cardLines(ctx, qBlock.lines, cardPad, qTop, qLh, cardCream)
  var qBottom = qTop + (qBlock.lines.length - 1) * qLh

  /* 两行说明 */
  var lines = (Array.isArray(invite.lines) ? invite.lines.slice(0, 2) : []).filter(function (s) {
    return cardStr(s).trim() !== ''
  })
  if (!lines.length) lines = ['我把三餐都记在这里，一天一张卡片。', '把你的三餐发到评论区，我帮你看缺口。']
  var lineTop = qBottom + 76
  cardUse(ctx, 31, 400, 'rgba(243,237,223,0.8)')
  var ly = lineTop
  var i
  for (i = 0; i < lines.length; i++) {
    var seg = cardEllipsize(ctx, cardStr(lines[i]), cardInner)
    ctx.fillText(seg, cardPad, ly)
    ly += 50
  }

  /* CTA 胶囊 */
  var cta = cardStr(invite.cta).trim() || '评论区晒出你今天的早餐'
  var ctaH = 108
  var ctaTop = ly - 50 + 66
  cardUse(ctx, 34, 600, cardDeep)
  var ctaText = cardEllipsize(ctx, cta, 620)
  var ctaW = 48 + ctx.measureText(ctaText).width + 30 + 34 + 46
  ctx.save()
  ctx.fillStyle = cardCream
  cardRoundRect(ctx, cardPad, ctaTop, ctaW, ctaH, ctaH / 2)
  ctx.fill()
  ctx.restore()
  cardUse(ctx, 34, 600, cardDeep)
  ctx.fillText(ctaText, cardPad + 48, ctaTop + ctaH / 2 + 12)
  var arrowX = cardPad + 48 + ctx.measureText(ctaText).width + 30
  cardArrow(ctx, arrowX, ctaTop + ctaH / 2, 34, cardDeep, 3.4)
  var ctaBottom = ctaTop + ctaH

  /* 话题标签：贴近页脚，稳定底部重心 */
  var tags = Array.isArray(invite.tags) ? invite.tags.slice(0, 3) : []
  if (!tags.length) tags = ['#一日三餐', '#营养记录', '#今天吃什么']
  cardUse(ctx, 26, 500, 'rgba(243,237,223,0.7)')
  var tagRows = []
  var curRow = []
  var curX = cardPad
  var ri
  var ti
  for (i = 0; i < tags.length; i++) {
    var tagText = cardEllipsize(ctx, cardStr(tags[i]), 300)
    var tw = ctx.measureText(tagText).width
    if (curRow.length && curX + tw > cardRight) {
      tagRows.push(curRow)
      curRow = []
      curX = cardPad
    }
    curRow.push({ t: tagText, x: curX })
    curX += tw + 30
  }
  if (curRow.length) tagRows.push(curRow)
  var tagFirstY = 1148 - (tagRows.length - 1) * 42
  for (ri = 0; ri < tagRows.length; ri++) {
    for (ti = 0; ti < tagRows[ri].length; ti++) {
      cardUse(ctx, 26, 500, 'rgba(243,237,223,0.7)')
      ctx.fillText(tagRows[ri][ti].t, tagRows[ri][ti].x, tagFirstY + ri * 42)
    }
  }

  /* 投稿三步：在 CTA 与话题标签之间居中 */
  var stepH = 148
  var stepTop = ctaBottom + 12
  var stepBottom = tagFirstY - 26
  var stepRoom = stepBottom - stepTop
  if (stepRoom > stepH + 40) {
    cardInviteSteps(ctx, stepTop + (stepRoom - stepH) / 2)
  } else if (stepRoom > stepH - 24) {
    cardInviteSteps(ctx, stepTop)
  }

  /* 页脚：分隔线 + 右下账号水印 + 画布底部居中免责行 */
  cardHr(ctx, 1240, cardPad, cardRight, 'rgba(243,237,223,0.16)', 1.2)

  /* 账号水印：超长 handle 自动降字号，避免压满整行 */
  var mark = cardWatermark(data.handle)
  var markSize = 32
  ctx.font = cardF(markSize, 700)
  while (markSize > 22 && ctx.measureText(mark).width > 560) {
    markSize -= 2
    ctx.font = cardF(markSize, 700)
  }
  cardUse(ctx, markSize, 700, cardCream)
  ctx.textAlign = 'right'
  ctx.fillText(mark, cardRight, 1292)
  ctx.textAlign = 'left'

  cardUse(ctx, 19, 400, 'rgba(243,237,223,0.45)')
  ctx.textAlign = 'center'
  ctx.fillText(cardDisclaimer, cardW / 2, 1342)
  ctx.textAlign = 'left'
}

/* ---------------- 入口 ---------------- */

function cardDraw(kind, data, canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return
  var ctx = canvas.getContext('2d')
  if (!ctx) return
  var w = canvas.width || cardW
  var h = canvas.height || cardH
  var d = data || {}
  d.result = d.result || {}

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.scale(w / cardW, h / cardH)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.lineCap = 'butt'

  try {
    if (kind === 'advice') cardDrawAdvice(ctx, d)
    else if (kind === 'invite') cardDrawInvite(ctx, d)
    else cardDrawAnalysis(ctx, d)
  } finally {
    ctx.restore()
  }
}

// ---- src/panel.js ----
/* ============================================================
 * src/panel.js — 三餐营养师：整页 React 面板
 * 说明：本文件与 card.js / main.js 被原样拼进同一个工厂作用域，
 *       外层已提供 React 与 h = React.createElement。
 *       因此这里没有 import/export/require，不用 JSX，也不做模块级副作用。
 *       顶层名字统一加 panel 前缀；对外暴露 NutritionPanel 与 PanelIcon。
 * ============================================================ */

const panelCss = `
.nu-page{height:100%;overflow:auto;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:1.55;-webkit-font-smoothing:antialiased}
.nu-page *,.nu-page *::before,.nu-page *::after{box-sizing:border-box}
.nu-page button{font-family:inherit}
.nu-inner{max-width:1180px;margin:0 auto;padding:0 32px 72px}

.nu-topbar{position:sticky;top:0;z-index:20;background:var(--dsw-alias-bg-base);border-bottom:1px solid var(--dsw-alias-border-l1)}
.nu-topbar-inner{max-width:1180px;margin:0 auto;padding:18px 32px 14px;display:flex;align-items:flex-end;gap:12px 24px;flex-wrap:wrap}
.nu-brand{display:flex;flex-direction:column;gap:3px;min-width:0}
.nu-eyebrow{display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.16em;color:var(--dsw-alias-label-secondary)}
.nu-eyebrow-glyph{display:inline-flex;color:var(--dsw-alias-brand-primary)}
.nu-title{margin:0;font-size:22px;line-height:1.25;font-weight:650;letter-spacing:.01em}
.nu-subtitle{margin:0;font-size:13px;color:var(--dsw-alias-label-secondary)}
.nu-topbar-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}

.nu-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:550;line-height:1;border-radius:999px;padding:9px 15px;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease,opacity .15s ease}
.nu-btn:not(:disabled):hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.nu-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.nu-btn:disabled{opacity:.42;cursor:not-allowed}
.nu-btn-primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:600;padding:10px 20px}
.nu-btn-primary:not(:disabled):hover{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);opacity:.88}
.nu-btn-primary:disabled{opacity:.55}
.nu-btn-loading:disabled{opacity:1;cursor:progress}
.nu-btn-ghost{border-color:transparent;color:var(--dsw-alias-label-secondary);padding:7px 10px}
.nu-btn-sm{font-size:12px;padding:7px 11px;border-radius:999px}
.nu-btn-block{width:100%}

.nu-model{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-label-primary) 3%,transparent);font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.nu-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary);flex:none}
.nu-dot-warn{background:var(--dsw-alias-state-warn-primary)}
.nu-dot-error{background:var(--dsw-alias-state-error-primary)}
.nu-dot-mute{background:var(--dsw-alias-label-secondary);opacity:.6}

.nu-section{margin-top:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.nu-section-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:15px 20px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.nu-step{flex:none;display:inline-grid;place-items:center;width:24px;height:24px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.nu-section-heading{display:flex;flex-direction:column;gap:1px;min-width:0}
.nu-section-title{font-size:14px;font-weight:650;line-height:1.35}
.nu-section-sub{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.4}
.nu-section-tools{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.nu-section-body{padding:18px 20px 20px}

.nu-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 18px}
.nu-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.nu-field-wide{grid-column:1 / -1}
.nu-label{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.4}
.nu-label em{font-style:normal;font-size:11px;opacity:.72}
.nu-input,.nu-select{width:100%;height:38px;padding:0 11px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;transition:border-color .15s ease,box-shadow .15s ease}
.nu-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.7}
.nu-select{appearance:auto;padding-right:8px}
.nu-input:focus,.nu-select:focus{outline:none;border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}

.nu-seg{display:inline-flex;flex-wrap:wrap;align-self:flex-start;gap:3px;padding:3px;border-radius:11px;border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent)}
.nu-seg-btn{appearance:none;flex:0 0 auto;min-width:56px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;line-height:1.2;padding:7px 12px;border-radius:9px;cursor:pointer;white-space:nowrap;transition:background .15s ease,color .15s ease,border-color .15s ease}
.nu-seg-btn:hover{color:var(--dsw-alias-label-primary)}
.nu-seg-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.nu-seg-btn[aria-pressed="true"]{background:var(--dsw-alias-bg-base);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-weight:600}

.nu-meta{display:flex;align-items:center;gap:6px 14px;flex-wrap:wrap;margin-top:16px;padding:11px 14px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 6%,transparent);font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.nu-meta strong{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:650;font-variant-numeric:tabular-nums}
.nu-meta-sep{opacity:.45}
.nu-form-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:18px}
.nu-form-msg{font-size:12.5px;color:var(--dsw-alias-state-error-primary);min-height:18px}
.nu-form-msg-ok{color:var(--dsw-alias-label-secondary)}

.nu-summary{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;padding:15px 20px}
.nu-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.nu-chip-static{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent);font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.nu-chip-static b{font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.nu-summary-note{font-size:12px;color:var(--dsw-alias-label-secondary)}
.nu-summary-ok{font-size:12px;color:var(--dsw-alias-label-secondary)}
.nu-summary-action{margin-left:auto}

.nu-meal-top{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap}
.nu-meal-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.nu-meal-count{margin-left:auto;font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.nu-textarea{display:block;width:100%;min-height:112px;margin-top:14px;padding:13px 14px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:1.7;resize:vertical;transition:border-color .15s ease,box-shadow .15s ease}
.nu-textarea::placeholder{color:var(--dsw-alias-label-secondary);opacity:.65}
.nu-textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
.nu-examples{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-top:12px}
.nu-examples-label{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);padding:5px 0}
.nu-chip{appearance:none;border:1px dashed var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:999px;padding:5px 11px;font:inherit;font-size:12px;line-height:1.4;cursor:pointer;text-align:left;transition:border-color .15s ease,color .15s ease,background .15s ease}
.nu-chip:hover{border-style:solid;border-color:var(--dsw-alias-label-secondary);color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent)}
.nu-chip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.nu-meal-foot{display:flex;align-items:center;gap:10px 16px;flex-wrap:wrap;margin-top:16px}
.nu-hint{font-size:12px;color:var(--dsw-alias-label-secondary)}
.nu-meal-cta{margin-left:auto;display:flex;align-items:center;gap:10px}

.nu-spinner{width:15px;height:15px;flex:none;border-radius:50%;border:2px solid color-mix(in srgb,var(--dsw-alias-label-primary) 32%,transparent);border-top-color:var(--dsw-alias-label-primary);animation:nu-spin .8s linear infinite}
.nu-spinner-inverse{border-color:color-mix(in srgb,var(--dsw-alias-bg-base) 35%,transparent);border-top-color:var(--dsw-alias-bg-base)}
@keyframes nu-spin{to{transform:rotate(360deg)}}
@keyframes nu-pulse{0%,100%{opacity:.55}50%{opacity:1}}

.nu-banner{display:flex;align-items:flex-start;gap:9px;padding:10px 13px;margin-bottom:12px;border-radius:11px;border:1px solid var(--dsw-alias-border-l1);font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-primary)}
.nu-banner-icon{flex:none;font-size:13px;font-weight:700;line-height:1.5}
.nu-banner-warn{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 60%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 22%,transparent)}
.nu-banner-warn .nu-banner-icon{color:var(--dsw-alias-state-warn-primary)}
.nu-banner-error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent)}
.nu-banner-error .nu-banner-icon{color:var(--dsw-alias-state-error-primary)}
.nu-banner-info{border-color:var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,transparent)}
.nu-banner-actions{margin-left:auto;flex:none;display:flex;gap:8px;align-items:center}
.nu-banner-form{margin-top:14px;margin-bottom:0}
.nu-banner-page{margin-top:20px;margin-bottom:0}

.nu-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.nu-card{display:flex;flex-direction:column;min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;overflow:hidden;background:var(--dsw-alias-bg-base)}
.nu-card-head{display:flex;align-items:center;gap:8px;padding:9px 10px 9px 13px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.nu-card-index{font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);letter-spacing:.04em}
.nu-card-name{font-size:12.5px;font-weight:600}
.nu-card-btn{margin-left:auto}
.nu-canvas-wrap{position:relative;width:100%;aspect-ratio:3/4;background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent)}
.nu-canvas{display:block;width:100%;height:100%}

.nu-post{display:flex;flex-direction:column;gap:10px;margin-top:16px;padding:16px 18px;border:1px solid var(--dsw-alias-border-l2);border-left:3px solid var(--dsw-alias-brand-primary);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.nu-post-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.nu-post-badge{flex:none;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--dsw-alias-label-secondary);padding:2px 7px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}
.nu-post-title{font-size:13px;font-weight:600}
.nu-post-hint{font-size:12px;color:var(--dsw-alias-label-secondary)}
.nu-post-actions{margin-left:auto;display:flex;gap:6px}
.nu-post-row{display:grid;grid-template-columns:46px minmax(0,1fr);gap:10px;align-items:start;padding:10px 0 0;border-top:1px solid var(--dsw-alias-border-l1)}
.nu-post-row:first-child{border-top:0;padding-top:2px}
.nu-post-label{font-size:11.5px;color:var(--dsw-alias-label-secondary);line-height:1.9;white-space:nowrap}
.nu-post-text{margin:0;font-size:13.5px;line-height:1.8;word-break:break-word;color:var(--dsw-alias-label-primary)}
.nu-post-headline{font-weight:600}
.nu-post-muted{color:var(--dsw-alias-label-secondary)}
.nu-post-tags{color:var(--dsw-alias-brand-primary);font-weight:500}
/* 正文一句一行：手机端逐句阅读，也方便直接复制发布 */
.nu-post-lines{display:flex;flex-direction:column;gap:2px}
.nu-post-line{margin:0;font-size:13.5px;line-height:1.85;word-break:break-word;color:var(--dsw-alias-label-primary)}

/* 每日三餐得分 */
.nu-score{display:flex;flex-direction:column;gap:14px}
.nu-score-summary{display:flex;align-items:center;gap:8px 14px;flex-wrap:wrap;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.nu-score-stat{display:inline-flex;align-items:baseline;gap:5px}
.nu-score-stat b{font-size:17px;font-weight:700;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.nu-score-chart{display:flex;align-items:flex-end;justify-content:center;gap:12px;padding:14px 14px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.nu-score-col{flex:0 1 96px;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px}
.nu-score-col-value{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}
.nu-score-track{position:relative;width:100%;height:76px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid var(--dsw-alias-border-l1)}
.nu-score-target{position:absolute;left:0;right:0;bottom:70%;border-top:1px dashed color-mix(in srgb,var(--dsw-alias-label-primary) 28%,transparent)}
.nu-score-bar{width:min(26px,64%);border-radius:4px 4px 0 0;background:var(--dsw-alias-brand-primary);min-height:3px}
.nu-score-bar.is-watch{background:var(--dsw-alias-state-warn-primary)}
.nu-score-bar.is-low{background:var(--dsw-alias-state-error-primary)}
.nu-score-col-label{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.nu-score-legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.nu-score-legend span{display:inline-flex;align-items:center;gap:5px}
.nu-score-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-brand-primary)}
.nu-score-dot.is-watch{background:var(--dsw-alias-state-warn-primary)}
.nu-score-dot.is-low{background:var(--dsw-alias-state-error-primary)}
.nu-score-days{display:flex;flex-direction:column;gap:8px}
.nu-score-day{display:grid;grid-template-columns:96px minmax(0,1fr) 64px;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:11px;background:var(--dsw-alias-bg-layer-1)}
.nu-score-day-date{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap}
.nu-score-day-date span{display:block;font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary)}
.nu-score-meals{display:flex;gap:8px;flex-wrap:wrap}
.nu-score-meal{display:flex;align-items:center;gap:6px;padding:4px 9px 4px 5px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
.nu-score-meal-type{font-size:11px;color:var(--dsw-alias-label-secondary)}
.nu-score-badge{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:22px;padding:0 6px;border-radius:999px;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:#fff;background:var(--dsw-alias-brand-primary)}
.nu-score-badge.is-watch{background:var(--dsw-alias-state-warn-primary)}
.nu-score-badge.is-low{background:var(--dsw-alias-state-error-primary)}
.nu-score-empty{display:flex;align-items:center;gap:8px;padding:14px;border:1px dashed var(--dsw-alias-border-l2);border-radius:11px;font-size:12.5px;color:var(--dsw-alias-label-secondary)}

.nu-saved{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;margin-top:14px;padding:10px 13px;border-radius:11px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 8%,transparent);font-size:12.5px}
.nu-saved-path{color:var(--dsw-alias-label-primary);word-break:break-all;font-variant-numeric:tabular-nums}
.nu-saved-label{color:var(--dsw-alias-label-secondary);flex:none}

.nu-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:38px 24px 40px;border:1px dashed var(--dsw-alias-border-l2);border-radius:14px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 2%,transparent);text-align:center}
.nu-empty-icon{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary)}
.nu-empty-title{margin:2px 0 0;font-size:15px;font-weight:650}
.nu-empty-desc{margin:0;max-width:440px;font-size:13px;line-height:1.7;color:var(--dsw-alias-label-secondary)}
.nu-empty-steps{display:flex;align-items:center;gap:8px 18px;flex-wrap:wrap;justify-content:center;margin-top:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.nu-empty-step{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.nu-empty-step i{font-style:normal;font-variant-numeric:tabular-nums;opacity:.65}

.nu-working{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:11px 14px;border-radius:11px;border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-label-primary) 3%,transparent);font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.nu-section[data-section="result"],.nu-section[data-section="score"],.nu-section[data-section="post"]{scroll-margin-top:116px}
.nu-skeleton-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.nu-skel{position:relative;aspect-ratio:3/4;border-radius:14px;border:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);animation:nu-pulse 1.5s ease-in-out infinite}
.nu-skel::after{content:"";position:absolute;inset:14% 10%;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);opacity:.6}
.nu-skeleton-row{display:flex;align-items:center;gap:8px;margin:12px 0 14px;font-size:12.5px;color:var(--dsw-alias-label-secondary)}

.nu-loading{padding:24px 0 0}
.nu-loading-block{height:96px;margin-top:20px;border-radius:16px;border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent);animation:nu-pulse 1.5s ease-in-out infinite}
.nu-loading-block.is-tall{height:220px}

@media (max-width:1080px){
  .nu-cards,.nu-skeleton-grid{grid-template-columns:minmax(0,1fr);justify-items:center}
  .nu-card,.nu-skel{width:min(100%,460px)}
}
@media (max-width:760px){
  .nu-topbar-inner{padding:15px 20px 12px}
  .nu-inner{padding:0 20px 56px}
  .nu-title{font-size:20px}
  .nu-topbar-actions{margin-left:0;width:100%;justify-content:flex-end}
  .nu-form-grid{grid-template-columns:minmax(0,1fr)}
  .nu-field-wide{grid-column:auto}
  .nu-section-head{padding:14px 15px}
  .nu-section-body{padding:16px 15px 18px}
  .nu-summary{padding:14px 15px}
  .nu-card,.nu-skel{width:min(100%,420px)}
  .nu-post-actions{margin-left:0;width:100%}
  .nu-score-day{grid-template-columns:minmax(0,1fr);gap:8px}
  .nu-score-day-avg{justify-self:start}
  .nu-score-track{height:64px}
  .nu-meal-cta{margin-left:0;width:100%}
  .nu-meal-cta .nu-btn{flex:1 1 auto}
  .nu-textarea{min-height:104px}
  .nu-section[data-section="result"],.nu-section[data-section="score"],.nu-section[data-section="post"]{scroll-margin-top:154px}
}
@media (max-width:560px){
  .nu-topbar-inner{padding:13px 16px 11px}
  .nu-inner{padding:0 16px 48px}
  .nu-btn{padding:9px 13px}
  .nu-title{font-size:19px}
  .nu-section{margin-top:16px;border-radius:14px}
  .nu-section-tools{width:100%;margin-left:0}
  .nu-section-tools .nu-btn{flex:1 1 auto}
  .nu-empty{padding:30px 16px 32px}
}
`;

const panelMealTypes = ['早餐', '午餐', '晚餐', '加餐'];

const panelExamples = [
  { type: '早餐', text: '早餐，鸡蛋一个+玉米一根' },
  { type: '午餐', text: '午餐，米饭一碗+红烧肉三块+青菜少许' },
  { type: '晚餐', text: '晚餐，面条一碗+两个鸡蛋' },
  { type: '加餐', text: '加餐，一杯无糖酸奶+一小把坚果' },
];

const panelActivityOptions = [
  { value: 'sedentary', label: '久坐为主' },
  { value: 'light', label: '轻度活动' },
  { value: 'moderate', label: '中度活动' },
  { value: 'high', label: '高强度活动' },
];

const panelGoalOptions = [
  { value: 'health', label: '保持健康' },
  { value: 'fatloss', label: '减脂' },
  { value: 'muscle', label: '增肌' },
  { value: 'maintain', label: '维持' },
];

const panelCardMeta = [
  { kind: 'analysis', name: '营养分析', label: '下载营养分析', file: '01-营养分析.png' },
  { kind: 'advice', name: '改进建议', label: '下载改进建议', file: '02-改进建议.png' },
  { kind: 'invite', name: '引导投稿', label: '下载引导投稿', file: '03-引导投稿.png' },
];

const panelGenderLabel = { male: '男', female: '女' };
const panelActivityLabel = { sedentary: '久坐为主', light: '轻度活动', moderate: '中度活动', high: '高强度活动' };
const panelGoalLabel = { health: '保持健康', fatloss: '减脂', muscle: '增肌', maintain: '维持' };
const panelWeekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 空档案时的编辑器默认值：让用户只填年龄/身高/体重（或什么都不改）就能保存。 */
const panelProfileDefaults = {
  name: '',
  gender: 'female',
  age: 28,
  height: 165,
  weight: 55,
  activity: 'light',
  goal: 'health',
};

/** 文本长度（按字符数，中文 1 个算 1）。 */
function panelTextLength(value) {
  return Array.from(String(value == null ? '' : value)).length;
}

/** 把接口返回的档案清洗成可渲染的对象（接口可能给 null）。 */
function panelCleanProfile(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const next = {};
  const keys = ['name', 'gender', 'age', 'height', 'weight', 'activity', 'goal'];
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const value = raw[key];
    if (value === null || value === undefined || value === '') continue;
    next[key] = value;
  }
  return next;
}

/** 把表单里的字符串值规范成卡片/接口可用的档案对象。 */
function panelNormalizeProfile(raw) {
  const data = panelCleanProfile(raw);
  const next = {};
  if (data.name !== undefined && String(data.name).trim()) next.name = String(data.name).trim();
  if (data.gender === 'male' || data.gender === 'female') next.gender = data.gender;
  if (Number(data.age) >= 10 && Number(data.age) <= 100) next.age = Number(data.age);
  if (Number(data.height) >= 100 && Number(data.height) <= 230) next.height = Number(data.height);
  if (Number(data.weight) >= 30 && Number(data.weight) <= 200) next.weight = Number(data.weight);
  if (panelActivityOptions.some(function (item) { return item.value === data.activity; })) next.activity = data.activity;
  if (panelGoalOptions.some(function (item) { return item.value === data.goal; })) next.goal = data.goal;
  return next;
}

/** 档案是否已包含计算 BMR 所需的关键字段。 */
function panelProfileComplete(profile) {
  const data = profile || {};
  return Boolean(data.gender) && Number(data.age) > 0 && Number(data.height) > 0 && Number(data.weight) > 0;
}

/** Mifflin-St Jeor + 活动系数 + 目标微调，返回每日参考值。 */
function panelBodyMetrics(profile) {
  const data = profile || {};
  const age = Number(data.age);
  const height = Number(data.height);
  const weight = Number(data.weight);
  const gender = data.gender;
  if (gender !== 'male' && gender !== 'female') return null;
  if (!(age >= 10 && age <= 100)) return null;
  if (!(height >= 100 && height <= 230)) return null;
  if (!(weight >= 30 && weight <= 200)) return null;
  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
  const factor = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 }[data.activity] || 1.375;
  const goal = data.goal || 'health';
  let kcal = bmr * factor;
  if (goal === 'fatloss') kcal -= 250;
  if (goal === 'muscle') kcal += 250;
  kcal = Math.round(kcal / 10) * 10;
  const perKg = goal === 'fatloss' ? 1.6 : goal === 'muscle' ? 1.8 : 1.2;
  return {
    kcal,
    protein: Math.round(weight * perKg),
    bmr: Math.round(bmr),
    tdee: Math.round(bmr * factor),
  };
}

/** 档案摘要 chips 文案。 */
function panelSummaryChips(profile) {
  const data = profile || {};
  const chips = [];
  if (data.gender === 'male' || data.gender === 'female') chips.push(panelGenderLabel[data.gender]);
  if (Number(data.age) > 0) chips.push(Number(data.age) + ' 岁');
  if (Number(data.height) > 0) chips.push(Number(data.height) + ' cm');
  if (Number(data.weight) > 0) chips.push(Number(data.weight) + ' kg');
  if (data.activity) chips.push(panelActivityLabel[data.activity] || '');
  if (data.goal) chips.push(panelGoalLabel[data.goal] || '');
  return chips.filter(Boolean);
}

/** 卡片用日期文案：2026年11月6日 周四 */
function panelDateText() {
  const now = new Date();
  if (isNaN(now.getTime())) return '';
  return now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + panelWeekdays[now.getDay()];
}

/** 卡片水印账号：优先用档案里填的自媒体账号，没有就回退到发布账号。 */
const panelAccountFallback = '@AI说餐谱';

function panelHandle(profile) {
  const name = profile && profile.name ? String(profile.name).trim() : '';
  if (!name) return panelAccountFallback;
  return name.charAt(0) === '@' ? name : '@' + name;
}

/** 把接口返回的图文文案整理成可渲染的结构（旧数据没有 post 时用现有字段拼）。 */
function panelPostOf(result, profile) {
  const data = result && result.post && typeof result.post === 'object' ? result.post : {};
  const mealType = (result && result.mealType) || '这一餐';
  const p = profile || {};
  const gender = p.gender === 'male' ? '男' : p.gender === 'female' ? '女' : '';
  const title = String(data.title || '')
    || ((result && result.headline ? String(result.headline) : '这一餐吃得怎么样') + ' #' + mealType);
  const body = String(data.body || '')
    || (result && result.summary ? String(result.summary) : '');
  const remark = String(data.remark || '')
    || ['备注：' + (gender || '—'), (p.age || '—') + '岁', (p.height || '—') + 'cm', (p.weight || '—') + 'kg'].join('、');
  const tags = (Array.isArray(data.tags) && data.tags.length ? data.tags : ['#AI说餐谱', '#' + mealType, '#上班族', '#久坐族'])
    .map(function (tag) { return String(tag); })
    .slice(0, 4);
  const lines = Array.isArray(data.lines) && data.lines.length
    ? data.lines.map(function (line) { return String(line); })
    : panelSplitClauses(body);
  const text = String(data.text || '') || [title, lines.join('\n'), remark, tags.join(' ')].join('\n\n');
  return { title: title, body: body, lines: lines, remark: remark, tags: tags, text: text };
}

/** 一句一行：在标点后断开，正文更适合手机端逐句读。 */
function panelSplitClauses(value) {
  const clean = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const parts = clean.match(/[^，。！？；、,.!?;]+[，。！？；、,.!?;]*/g) || [clean];
  const lines = parts.map(function (part) { return part.trim(); }).filter(Boolean);
  if (lines.length <= 1) {
    const cut = Math.ceil(clean.length / 2);
    return [clean.slice(0, cut).trim(), clean.slice(cut).trim()].filter(Boolean);
  }
  return lines;
}

/** 分数配色：>=70 良好，55-69 偏低关注，<55 明显不足。 */
function panelScoreTone(score) {
  const value = Number(score) || 0;
  if (value >= 70) return 'good';
  if (value >= 55) return 'watch';
  return 'low';
}

/** 切换餐次时，把文本开头的旧餐次前缀换掉。 */
function panelRetargetText(text, nextType) {
  const value = String(text == null ? '' : text);
  for (let i = 0; i < panelMealTypes.length; i += 1) {
    const type = panelMealTypes[i];
    if (value.indexOf(type + '，') === 0) return nextType + value.slice(type.length);
    if (value.indexOf(type + ',') === 0) return nextType + value.slice(type.length);
  }
  return value;
}

/** 统一请求：相对路径，失败时抛中文错误。 */
async function panelRequest(action, payload) {
  const url = 'nutrition-desk/' + action;
  const init = payload === undefined
    ? { method: 'GET', headers: { accept: 'application/json' } }
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    throw new Error('连不上本地服务，请确认插件已经加载');
  }
  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }
  if (!response.ok) {
    throw new Error((data && data.error) || '请求失败（' + response.status + '）');
  }
  if (!data || typeof data !== 'object') throw new Error('返回的数据格式不对');
  return data;
}

/** canvas → 下载 PNG。 */
function panelDownloadCanvas(canvas, name) {
  return new Promise(function (resolve, reject) {
    if (!canvas || typeof canvas.toBlob !== 'function') {
      reject(new Error('图片还没准备好'));
      return;
    }
    canvas.toBlob(function (blob) {
      if (!blob) {
        reject(new Error('导出图片失败'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      resolve();
    }, 'image/png');
  });
}

/** 复制文本：优先剪贴板 API，失败时退回 execCommand。 */
async function panelCopyText(text) {
  const value = String(text == null ? '' : text);
  if (!value) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (err) {
      /* 继续走兜底方案 */
    }
  }
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.top = '-9999px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return Boolean(ok);
  } catch (err) {
    return false;
  }
}

/** 统一错误文案。 */
function panelErrorMessage(err, fallback) {
  if (err && err.message) return err.message;
  return fallback || '出了点问题，请稍后重试';
}

/* ============================================================
 * NutritionPanel：整页面板
 * ============================================================ */
function NutritionPanel() {
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [reloadKey, setReloadKey] = React.useState(0);

  const [profile, setProfile] = React.useState({});
  const [savedProfile, setSavedProfile] = React.useState({});
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [profileError, setProfileError] = React.useState('');
  const [profileNotice, setProfileNotice] = React.useState('');

  const [mealType, setMealType] = React.useState('早餐');
  const [mealText, setMealText] = React.useState('');
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzeError, setAnalyzeError] = React.useState('');

  const [result, setResult] = React.useState(null);
  const [notice, setNotice] = React.useState('');
  const [fallback, setFallback] = React.useState(false);
  const [count, setCount] = React.useState(0);
  const [history, setHistory] = React.useState([]);
  const [historySummary, setHistorySummary] = React.useState(null);
  const [exportDir, setExportDir] = React.useState('');

  const [model, setModel] = React.useState('');
  const [modelOk, setModelOk] = React.useState(null);
  const [modelError, setModelError] = React.useState('');

  const [saveBusy, setSaveBusy] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [savedPath, setSavedPath] = React.useState('');
  const [downloading, setDownloading] = React.useState(false);
  const [copyState, setCopyState] = React.useState('');

  const resultRef = React.useRef(null);
  const copyTimerRef = React.useRef(0);
  const pendingScrollRef = React.useRef(false);
  const canvasARef = React.useRef(null);
  const canvasBRef = React.useRef(null);
  const canvasCRef = React.useRef(null);
  const canvasRefs = React.useMemo(function () {
    return [canvasARef, canvasBRef, canvasCRef];
  }, [canvasARef, canvasBRef, canvasCRef]);

  const metrics = panelBodyMetrics(profile);
  const savedMetrics = panelBodyMetrics(savedProfile);
  const summaryChips = panelSummaryChips(savedProfile);
  const post = result ? panelPostOf(result, savedProfile || profile) : null;
  const textLength = panelTextLength(mealText.trim());
  const canGenerate = textLength >= 3 && textLength <= 300 && !analyzing;

  /* 挂载：GET state */
  React.useEffect(function () {
    let alive = true;
    setLoading(true);
    setLoadError('');
    (async function load() {
      try {
        const data = await panelRequest('state');
        if (!alive) return;
        const savedProfileRaw = panelCleanProfile(data.profile);
        // 空档案也给出可保存的默认值（性别/活动量/目标/年龄身高体重），用户改几项就能存。
        const nextProfile = Object.assign({}, panelProfileDefaults, savedProfileRaw);
        setProfile(nextProfile);
        setSavedProfile(savedProfileRaw);
        setModel(typeof data.model === 'string' ? data.model : '');
        setModelOk(data.modelOk === false ? false : true);
        setModelError(typeof data.modelError === 'string' ? data.modelError : '');
        setCount(Number(data.count) > 0 ? Number(data.count) : 0);
        setHistory(Array.isArray(data.history) ? data.history : []);
        setHistorySummary(data.historySummary && typeof data.historySummary === 'object' ? data.historySummary : null);
        setExportDir(typeof data.exportDir === 'string' ? data.exportDir : '');
        const last = data.last && typeof data.last === 'object' ? data.last : null;
        if (last && panelMealTypes.indexOf(last.type) >= 0) setMealType(last.type);
        if (last && typeof last.text === 'string') setMealText(last.text);
        if (last && typeof last.savedPath === 'string') setSavedPath(last.savedPath);
        if (typeof data.savedPath === 'string' && data.savedPath) setSavedPath(data.savedPath);
        const nextResult = (last && last.result && typeof last.result === 'object' ? last.result : null)
          || (data.result && typeof data.result === 'object' ? data.result : null);
        if (nextResult) setResult(nextResult);
        setFallback(data.fallback === true);
        setNotice(typeof data.notice === 'string' ? data.notice : '');
        setProfileOpen(!panelProfileComplete(savedProfileRaw));
        setLoading(false);
      } catch (err) {
        if (!alive) return;
        setLoadError(panelErrorMessage(err, '加载失败，请稍后重试'));
        setProfileOpen(true);
        setLoading(false);
      }
    })();
    return function () {
      alive = false;
    };
  }, [reloadKey]);

  /* 结果变化后画三张卡片；字体加载完再补画一次 */
  React.useEffect(function () {
    if (!result) return undefined;
    let cancelled = false;
    const draw = function () {
      if (cancelled) return;
      // 档案还没单独保存过时，用当前表单值兜底，保证卡片页脚能拿到自媒体账号。
      const profileForCard = Object.keys(savedProfile || {}).length > 0
        ? savedProfile
        : panelNormalizeProfile(profile);
      const data = {
        result: result,
        profile: profileForCard,
        mealType: result.mealType || mealType,
        dateText: panelDateText(),
        indexText: count > 0 ? '第 ' + count + ' 餐' : '',
        handle: panelHandle(profileForCard),
      };
      for (let i = 0; i < canvasRefs.length; i += 1) {
        const canvas = canvasRefs[i].current;
        if (!canvas) continue;
        canvas.width = 1080;
        canvas.height = 1440;
        try {
          if (typeof cardDraw === 'function') cardDraw(panelCardMeta[i].kind, data, canvas);
        } catch (err) {
          /* 单张卡片画失败不影响其余两张 */
        }
      }
    };
    draw();
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(function () {
        draw();
      }).catch(function () {});
    }
    return function () {
      cancelled = true;
    };
  }, [result, savedProfile, profile, mealType, count, canvasRefs]);

  /* 生成后滚动到结果区（只在“刚生成”时触发，挂载回填不滚动） */
  React.useEffect(function () {
    if (!result || !pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    const node = resultRef.current;
    if (!node || typeof node.scrollIntoView !== 'function') return;
    const timer = setTimeout(function () {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return function () {
      clearTimeout(timer);
    };
  }, [result]);

  React.useEffect(function () {
    return function () {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const updateProfile = function (patch) {
    setProfile(function (prev) {
      return Object.assign({}, prev, patch);
    });
    setProfileError('');
    setProfileNotice('');
  };

  const toggleProfile = function () {
    setProfileOpen(function (open) {
      return !open;
    });
  };

  const onPickExample = function (example) {
    setMealType(example.type);
    setMealText(example.text);
    setAnalyzeError('');
  };

  const onPickMealType = function (nextType) {
    setMealType(nextType);
    setMealText(function (prev) {
      return panelRetargetText(prev, nextType);
    });
  };

  const onSaveProfile = async function () {
    const name = profile.name ? String(profile.name).trim() : '';
    if (panelTextLength(name) > 20) {
      setProfileError('账号名最多 20 个字');
      return;
    }
    if (profile.gender !== 'male' && profile.gender !== 'female') {
      setProfileError('先选一下性别');
      return;
    }
    if (!(Number(profile.age) >= 10 && Number(profile.age) <= 100)) {
      setProfileError('年龄请填 10–100');
      return;
    }
    if (!(Number(profile.height) >= 100 && Number(profile.height) <= 230)) {
      setProfileError('身高请填 100–230 cm');
      return;
    }
    if (!(Number(profile.weight) >= 30 && Number(profile.weight) <= 200)) {
      setProfileError('体重请填 30–200 kg');
      return;
    }
    if (!panelActivityOptions.some(function (item) { return item.value === profile.activity; })) {
      setProfileError('选一下活动量');
      return;
    }
    if (!panelGoalOptions.some(function (item) { return item.value === profile.goal; })) {
      setProfileError('选一下目标');
      return;
    }
    const payload = {
      name: name,
      gender: profile.gender,
      age: Number(profile.age),
      height: Number(profile.height),
      weight: Number(profile.weight),
      activity: profile.activity,
      goal: profile.goal,
    };
    setProfileSaving(true);
    setProfileError('');
    setProfileNotice('');
    try {
      const data = await panelRequest('profile', { profile: payload });
      const saved = panelNormalizeProfile(data.profile || payload);
      setProfile(Object.assign({}, panelProfileDefaults, saved));
      setSavedProfile(saved);
      setProfileOpen(false);
      setProfileNotice('档案已保存');
    } catch (err) {
      setProfileError(panelErrorMessage(err, '保存失败，请重试'));
    } finally {
      setProfileSaving(false);
    }
  };

  const onGenerate = async function () {
    const text = mealText.trim();
    const length = panelTextLength(text);
    if (length < 3) {
      setAnalyzeError('至少写 3 个字，说说这一餐吃了什么');
      return;
    }
    if (length > 300) {
      setAnalyzeError('最多 300 个字，先写重点就行');
      return;
    }
    setAnalyzing(true);
    setAnalyzeError('');
    setNotice('');
    setSaveError('');
    setSavedPath('');
    try {
      const data = await panelRequest('analyze', { type: mealType, text: text, profile: panelNormalizeProfile(profile) });
      const nextResult = data.result && typeof data.result === 'object' ? data.result : null;
      if (!nextResult) throw new Error('没有拿到分析结果，请重试');
      pendingScrollRef.current = true;
      setResult(nextResult);
      // Host 在 analyze 时会把当前档案落库，这里同步一份，卡片页脚立刻有 @账号。
      setSavedProfile(panelNormalizeProfile(profile));
      setNotice(typeof data.notice === 'string' ? data.notice : '');
      setFallback(data.fallback === true);
      if (Array.isArray(data.history) && data.history.length) setHistory(data.history);
      if (data.historySummary && typeof data.historySummary === 'object') setHistorySummary(data.historySummary);
      if (typeof data.model === 'string' && data.model) setModel(data.model);
      if (data.modelOk === false) setModelOk(false);
      else if (data.modelOk === true) setModelOk(true);
      setAnalyzeError('');
    } catch (err) {
      setAnalyzeError(panelErrorMessage(err, '生成失败，请重试'));
    } finally {
      setAnalyzing(false);
    }
  };

  const onDownloadOne = async function (index) {
    const meta = panelCardMeta[index];
    try {
      await panelDownloadCanvas(canvasRefs[index].current, meta.file);
    } catch (err) {
      setSaveError(panelErrorMessage(err, '下载失败，请重试'));
    }
  };

  const onDownloadAll = async function () {
    if (!result || downloading) return;
    setDownloading(true);
    setSaveError('');
    try {
      for (let i = 0; i < panelCardMeta.length; i += 1) {
        await panelDownloadCanvas(canvasRefs[i].current, panelCardMeta[i].file);
        await new Promise(function (resolve) { setTimeout(resolve, 220); });
      }
    } catch (err) {
      setSaveError(panelErrorMessage(err, '下载失败，请重试'));
    } finally {
      setDownloading(false);
    }
  };

  const onSaveFiles = async function () {
    if (!result || saveBusy) return;
    setSaveBusy(true);
    setSaveError('');
    try {
      const files = [];
      for (let i = 0; i < panelCardMeta.length; i += 1) {
        const canvas = canvasRefs[i].current;
        if (!canvas) throw new Error('图片还没准备好，请稍等');
        files.push({
          kind: panelCardMeta[i].kind,
          name: panelCardMeta[i].file,
          png: canvas.toDataURL('image/png'),
        });
      }
      const texts = post && post.text ? [{ name: '04-图文文案.md', content: post.text }] : [];
      const data = await panelRequest('save', { files: files, texts: texts });
      setSavedPath(typeof data.path === 'string' ? data.path : '');
    } catch (err) {
      setSaveError(panelErrorMessage(err, '保存失败，请重试'));
    } finally {
      setSaveBusy(false);
    }
  };

  const onReveal = async function () {
    try {
      const data = await panelRequest('reveal', {});
      if (typeof data.path === 'string' && data.path) setSavedPath(data.path);
    } catch (err) {
      setSaveError(panelErrorMessage(err, '打开文件夹失败'));
    }
  };

  const onCopyPost = async function (part) {
    if (!post) return;
    // 正文按「一句一行」复制，和面板里看到的排版一致
    const value = part === 'body' ? post.lines.join('\n') : post.text;
    if (!value) return;
    const ok = await panelCopyText(value);
    setCopyState(ok ? (part === 'body' ? '已复制正文' : '已复制全文') : '复制失败');
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(function () {
      setCopyState('');
    }, 1800);
  };

  const modelText = modelOk === false ? '模型未连接' : (model || '模型已连接');
  const modelDotClass = modelOk === false ? 'nu-dot nu-dot-warn' : modelOk === null ? 'nu-dot nu-dot-mute' : 'nu-dot';

  /* ---------- 顶部工具条 ---------- */
  const renderTopbar = function () {
    return h('div', { className: 'nu-topbar' },
      h('div', { className: 'nu-topbar-inner' },
        h('div', { className: 'nu-brand' },
          h('div', { className: 'nu-eyebrow' },
            h('span', { className: 'nu-eyebrow-glyph' }, h(PanelIcon, { size: 13 })),
            h('span', null, '一日三餐 · 营养记录')
          ),
          h('h1', { className: 'nu-title' }, '三餐营养师'),
          h('p', { className: 'nu-subtitle' }, '拍一张图，记录今天吃了什么')
        ),
        h('div', { className: 'nu-topbar-actions' },
          h('span', {
            className: 'nu-model',
            title: modelError || modelText,
            'aria-label': '模型状态：' + modelText,
          },
            h('span', { className: modelDotClass }),
            h('span', null, modelText)
          ),
          h('button', {
            type: 'button',
            className: 'nu-btn',
            'aria-label': '个人档案',
            'aria-expanded': profileOpen ? 'true' : 'false',
            onClick: toggleProfile,
          }, profileOpen ? '收起档案' : '个人档案')
        )
      )
    );
  };

  /* ---------- 01 个人档案 ---------- */
  const renderSegmented = function (name, options, value, onPick, label) {
    return h('div', {
      className: 'nu-seg',
      role: 'group',
      'aria-label': label,
    }, options.map(function (option) {
      const active = value === option.value;
      return h('button', {
        key: option.value,
        type: 'button',
        className: 'nu-seg-btn',
        role: 'button',
        'aria-pressed': active ? 'true' : 'false',
        'aria-label': option.label,
        onClick: function () { onPick(option.value); },
      }, option.label);
    }));
  };

  const renderProfileForm = function () {
    return h('div', { className: 'nu-section-body' },
      h('div', { className: 'nu-form-grid' },
        h('label', { className: 'nu-field nu-field-wide' },
          h('span', { className: 'nu-label' }, h('span', null, '自媒体账号'), h('em', null, '可空，最多 20 字；会显示在图片右下角水印')),
          h('input', {
            className: 'nu-input',
            type: 'text',
            maxLength: 20,
            value: profile.name || '',
            placeholder: '你的账号名，例如 AI说食谱',
            'aria-label': '自媒体账号',
            onChange: function (event) { updateProfile({ name: event.target.value }); },
          })
        ),
        h('div', { className: 'nu-field' },
          h('span', { className: 'nu-label' }, h('span', null, '性别')),
          renderSegmented('gender', [
            { value: 'female', label: '女' },
            { value: 'male', label: '男' },
          ], profile.gender, function (value) { updateProfile({ gender: value }); }, '性别')
        ),
        h('label', { className: 'nu-field' },
          h('span', { className: 'nu-label' }, h('span', null, '年龄'), h('em', null, '岁')),
          h('input', {
            className: 'nu-input',
            type: 'number',
            min: 10,
            max: 100,
            inputMode: 'numeric',
            value: profile.age == null ? '' : profile.age,
            placeholder: '28',
            'aria-label': '年龄',
            onChange: function (event) { updateProfile({ age: event.target.value }); },
          })
        ),
        h('label', { className: 'nu-field' },
          h('span', { className: 'nu-label' }, h('span', null, '身高'), h('em', null, 'cm')),
          h('input', {
            className: 'nu-input',
            type: 'number',
            min: 100,
            max: 230,
            inputMode: 'numeric',
            value: profile.height == null ? '' : profile.height,
            placeholder: '165',
            'aria-label': '身高',
            onChange: function (event) { updateProfile({ height: event.target.value }); },
          })
        ),
        h('label', { className: 'nu-field' },
          h('span', { className: 'nu-label' }, h('span', null, '体重'), h('em', null, 'kg')),
          h('input', {
            className: 'nu-input',
            type: 'number',
            min: 30,
            max: 200,
            inputMode: 'numeric',
            value: profile.weight == null ? '' : profile.weight,
            placeholder: '55',
            'aria-label': '体重',
            onChange: function (event) { updateProfile({ weight: event.target.value }); },
          })
        ),
        h('label', { className: 'nu-field nu-field-wide' },
          h('span', { className: 'nu-label' }, h('span', null, '活动量')),
          h('select', {
            className: 'nu-input nu-select',
            value: profile.activity || '',
            'aria-label': '活动量',
            onChange: function (event) { updateProfile({ activity: event.target.value }); },
          },
            h('option', { value: '', disabled: true }, '请选择日常活动量'),
            panelActivityOptions.map(function (option) {
              return h('option', { key: option.value, value: option.value }, option.label);
            })
          )
        ),
        h('div', { className: 'nu-field nu-field-wide' },
          h('span', { className: 'nu-label' }, h('span', null, '目标')),
          renderSegmented('goal', panelGoalOptions, profile.goal, function (value) { updateProfile({ goal: value }); }, '目标')
        )
      ),
      h('div', { className: 'nu-meta' },
        metrics ? [
          h('span', { key: 'kcal' }, '每日参考 ', h('strong', null, String(metrics.kcal)), ' kcal'),
          h('span', { key: 'sep1', className: 'nu-meta-sep' }, '·'),
          h('span', { key: 'protein' }, '蛋白质 ', h('strong', null, String(metrics.protein)), ' g'),
          h('span', { key: 'sep2', className: 'nu-meta-sep' }, '·'),
          h('span', { key: 'tdee' }, '基础代谢 ', h('strong', null, String(metrics.bmr)), ' kcal，活动消耗约 ', h('strong', null, String(metrics.tdee)), ' kcal'),
        ] : h('span', null, '填完性别、年龄、身高、体重，就能看到每日参考摄入（Mifflin-St Jeor 公式估算）。')
      ),
      h('div', { className: 'nu-form-actions' },
        h('button', {
          type: 'button',
          className: 'nu-btn nu-btn-primary',
          'aria-label': '保存档案',
          disabled: profileSaving,
          onClick: onSaveProfile,
        },
          profileSaving ? h('span', { className: 'nu-spinner nu-spinner-inverse' }) : null,
          profileSaving ? '保存中…' : '保存档案'
        ),
        h('button', {
          type: 'button',
          className: 'nu-btn nu-btn-ghost',
          'aria-label': '收起档案',
          onClick: function () { setProfileOpen(false); },
        }, '收起'),
        h('span', {
          className: 'nu-form-msg' + (profileNotice ? ' nu-form-msg-ok' : ''),
          role: 'status',
          'aria-live': 'polite',
        }, profileNotice || profileError || '')
      )
    );
  };

  const renderProfileSummary = function () {
    return h('div', { className: 'nu-summary' },
      summaryChips.length > 0
        ? h('div', { className: 'nu-chips' }, summaryChips.map(function (chip) {
            return h('span', { key: chip, className: 'nu-chip-static' }, chip);
          }))
        : h('span', { className: 'nu-summary-note' }, '档案还是空的，补上性别、年龄、身高体重后，估算会更准。'),
      savedMetrics
        ? h('span', { className: 'nu-summary-note' }, '每日参考 ' + savedMetrics.kcal + ' kcal · 蛋白质 ' + savedMetrics.protein + ' g')
        : null,
      profileNotice ? h('span', { key: 'saved', className: 'nu-summary-ok' }, '✓ ' + profileNotice) : null,
      h('button', {
        type: 'button',
        className: 'nu-btn nu-btn-sm nu-summary-action',
        'aria-label': '编辑档案',
        onClick: toggleProfile,
      }, '编辑档案')
    );
  };

  const renderProfile = function () {
    return h('section', { className: 'nu-section', 'data-section': 'profile' },
      h('div', { className: 'nu-section-head' },
        h('span', { className: 'nu-step' }, '01'),
        h('div', { className: 'nu-section-heading' },
          h('div', { className: 'nu-section-title' }, '个人档案'),
          h('div', { className: 'nu-section-sub' }, profileOpen ? '填一次，之后每餐都按你的身体数据估算' : '已保存的档案会用在每一餐的目标上')
        )
      ),
      profileOpen ? renderProfileForm() : renderProfileSummary()
    );
  };

  /* ---------- 02 本餐记录 ---------- */
  const renderMeal = function () {
    return h('section', { className: 'nu-section', 'data-section': 'meal' },
      h('div', { className: 'nu-section-head' },
        h('span', { className: 'nu-step' }, '02'),
        h('div', { className: 'nu-section-heading' },
          h('div', { className: 'nu-section-title' }, '本餐记录'),
          h('div', { className: 'nu-section-sub' }, '写下这一餐吃了什么，越具体越准')
        )
      ),
      h('div', { className: 'nu-section-body' },
        h('div', { className: 'nu-meal-top' },
          h('span', { className: 'nu-meal-label' }, '餐次'),
          renderSegmented('meal', panelMealTypes.map(function (type) {
            return { value: type, label: type };
          }), mealType, onPickMealType, '餐次'),
          count > 0 ? h('span', { className: 'nu-meal-count' }, '已记录 ' + count + ' 餐') : null
        ),
        h('textarea', {
          className: 'nu-textarea',
          value: mealText,
          maxLength: 300,
          placeholder: '早餐，鸡蛋一个+玉米一根',
          'aria-label': '这一餐吃了什么',
          onChange: function (event) {
            setMealText(event.target.value);
            setAnalyzeError('');
          },
        }),
        h('div', { className: 'nu-examples' },
          h('span', { className: 'nu-examples-label' }, '试试：'),
          panelExamples.map(function (example) {
            return h('button', {
              key: example.text,
              type: 'button',
              className: 'nu-chip',
              'aria-label': '填入示例：' + example.text,
              onClick: function () { onPickExample(example); },
            }, example.text);
          })
        ),
        (analyzeError ? h('div', {
          className: 'nu-banner nu-banner-error nu-banner-form',
          role: 'alert',
        }, h('span', { className: 'nu-banner-icon' }, '!'), h('span', null, analyzeError)) : null),
        h('div', { className: 'nu-meal-foot' },
          h('span', { className: 'nu-hint' }, textLength + ' / 300 字 · 营养数据为估算值，仅供参考'),
          h('div', { className: 'nu-meal-cta' },
            h('button', {
              type: 'button',
              className: 'nu-btn nu-btn-primary' + (analyzing ? ' nu-btn-loading' : ''),
              'aria-label': '生成营养图文',
              disabled: !canGenerate,
              onClick: onGenerate,
            },
              analyzing ? h('span', { className: 'nu-spinner nu-spinner-inverse' }) : null,
              analyzing ? '营养师正在估算…' : '生成营养图文'
            )
          )
        )
      )
    );
  };

  /* ---------- 03 结果 ---------- */
  const renderBanners = function () {
    const banners = [];
    if (fallback && result) {
      banners.push(h('div', { key: 'fallback', className: 'nu-banner nu-banner-warn', role: 'status' },
        h('span', { className: 'nu-banner-icon' }, '!'),
        h('span', null, '这次是本地估算，接上模型更准')
      ));
    }
    if (notice) {
      banners.push(h('div', { key: 'notice', className: 'nu-banner nu-banner-warn', role: 'status' },
        h('span', { className: 'nu-banner-icon' }, '!'),
        h('span', null, notice)
      ));
    }
    if (saveError) {
      banners.push(h('div', { key: 'save-error', className: 'nu-banner nu-banner-error', role: 'alert' },
        h('span', { className: 'nu-banner-icon' }, '!'),
        h('span', null, saveError)
      ));
    }
    return banners;
  };

  const renderCards = function () {
    return h('div', { className: 'nu-cards' }, panelCardMeta.map(function (meta, index) {
      return h('div', { key: meta.kind, className: 'nu-card' },
        h('div', { className: 'nu-card-head' },
          h('span', { className: 'nu-card-index' }, String(index + 1).padStart(2, '0')),
          h('span', { className: 'nu-card-name' }, meta.name),
          h('button', {
            type: 'button',
            className: 'nu-btn nu-btn-sm nu-btn-ghost nu-card-btn',
            'aria-label': meta.label,
            onClick: function () { onDownloadOne(index); },
          }, '下载 PNG')
        ),
        h('div', { className: 'nu-canvas-wrap' },
          h('canvas', {
            ref: canvasRefs[index],
            className: 'nu-canvas',
            'data-card': meta.kind,
            width: 1080,
            height: 1440,
            role: 'img',
            'aria-label': meta.name + '卡片',
          })
        )
      );
    }));
  };

  const renderEmpty = function () {
    return h('div', { className: 'nu-empty' },
      h('div', { className: 'nu-empty-icon' }, h(PanelIcon, { size: 26 })),
      h('div', { className: 'nu-empty-title' }, count > 0 ? '已经记录 ' + count + ' 餐，再记一餐？' : '还没有生成图文'),
      h('p', { className: 'nu-empty-desc' }, '填好个人档案，写下这一餐吃了什么，点「生成营养图文」，就会得到营养分析、改进建议、引导投稿三张 3:4 图文，外加一段可直接发布的图文文案。'),
      h('div', { className: 'nu-empty-steps' },
        h('span', { className: 'nu-empty-step' }, h('i', null, '01'), '填档案'),
        h('span', { className: 'nu-empty-step' }, h('i', null, '02'), '记一餐'),
        h('span', { className: 'nu-empty-step' }, h('i', null, '03'), '出三张图')
      )
    );
  };

  const renderWorking = function () {
    return h('div', null,
      h('div', { className: 'nu-working', role: 'status', 'aria-live': 'polite' },
        h('span', { className: 'nu-spinner' }),
        h('span', null, '营养师正在估算…')
      ),
      h('div', { className: 'nu-skeleton-grid' }, panelCardMeta.map(function (meta) {
        return h('div', { key: meta.kind, className: 'nu-skel' });
      }))
    );
  };

  const renderPost = function () {
    if (!result || !post) return null;
    const copyAll = copyState === '已复制全文';
    const copyBody = copyState === '已复制正文';
    return h('div', { className: 'nu-post', 'data-block': 'post' },
      h('div', { className: 'nu-post-head' },
        h('span', { className: 'nu-post-badge' }, '文案'),
        h('span', { className: 'nu-post-title' }, '图文文案'),
        h('span', { className: 'nu-post-hint' }, '标题 + 正文 + 备注 + 标签，可直接发布'),
        h('div', { className: 'nu-post-actions' },
          h('button', {
            type: 'button',
            className: 'nu-btn nu-btn-sm',
            'aria-label': '复制正文',
            onClick: function () { onCopyPost('body'); },
          }, copyBody ? '已复制' : '复制正文'),
          h('button', {
            type: 'button',
            className: 'nu-btn nu-btn-sm',
            'aria-label': '复制全文',
            onClick: function () { onCopyPost('all'); },
          }, copyAll ? '已复制' : copyState === '复制失败' ? '复制失败' : '复制全文')
        )
      ),
      h('div', { className: 'nu-post-body' },
        h('div', { className: 'nu-post-row' },
          h('span', { className: 'nu-post-label' }, '标题'),
          h('p', { className: 'nu-post-text nu-post-headline', 'data-part': 'title' }, post.title)
        ),
        h('div', { className: 'nu-post-row' },
          h('span', { className: 'nu-post-label' }, '正文'),
          h('div', { className: 'nu-post-lines', 'data-part': 'body' }, post.lines.map(function (line, index) {
            return h('p', { key: index, className: 'nu-post-line' }, line);
          }))
        ),
        h('div', { className: 'nu-post-row' },
          h('span', { className: 'nu-post-label' }, '备注'),
          h('p', { className: 'nu-post-text nu-post-muted', 'data-part': 'remark' }, post.remark)
        ),
        h('div', { className: 'nu-post-row' },
          h('span', { className: 'nu-post-label' }, '标签'),
          h('p', { className: 'nu-post-text nu-post-tags', 'data-part': 'tags' }, post.tags.join(' '))
        )
      )
    );
  };

  const renderSavedPath = function () {
    if (!savedPath) return null;
    return h('div', { className: 'nu-saved', role: 'status' },
      h('span', { className: 'nu-saved-label' }, '已保存到'),
      h('span', { className: 'nu-saved-path' }, savedPath),
      h('button', {
        type: 'button',
        className: 'nu-btn nu-btn-sm',
        'aria-label': '打开文件夹',
        onClick: onReveal,
      }, '打开文件夹')
    );
  };

  /* ---------- 04 每日三餐得分 ---------- */
  const renderScore = function () {
    const days = Array.isArray(history) ? history : [];
    const summary = historySummary || null;
    return h('section', { className: 'nu-section', 'data-section': 'score' },
      h('div', { className: 'nu-section-head' },
        h('span', { className: 'nu-step' }, '04'),
        h('div', { className: 'nu-section-heading' },
          h('div', { className: 'nu-section-title' }, '每日三餐得分'),
          h('div', { className: 'nu-section-sub' }, days.length ? '最近 ' + days.length + ' 天的每一餐得分' : '记录两餐以上就会出现趋势')
        )
      ),
      h('div', { className: 'nu-section-body' },
        h('div', { className: 'nu-score' },
          summary && summary.count
            ? h('div', { className: 'nu-score-summary' },
                h('span', { className: 'nu-score-stat' }, '共 ', h('b', null, String(summary.count)), ' 餐'),
                h('span', { className: 'nu-score-stat' }, '平均 ', h('b', null, String(summary.average)), ' 分'),
                h('span', { className: 'nu-score-stat' }, '最高 ', h('b', null, String(summary.best)), ' 分'),
                h('span', { className: 'nu-score-stat' }, '最低 ', h('b', null, String(summary.worst)), ' 分'),
                h('span', { className: 'nu-score-legend' },
                  h('span', null, h('i', { className: 'nu-score-dot' }), '70 分以上'),
                  h('span', null, h('i', { className: 'nu-score-dot is-watch' }), '55–69 分'),
                  h('span', null, h('i', { className: 'nu-score-dot is-low' }), '55 分以下')
                )
              )
            : null,
          days.length
            ? h('div', { className: 'nu-score-chart', role: 'img', 'aria-label': '每日平均分柱状图' },
                days.map(function (day, index) {
                  const tone = panelScoreTone(day.average);
                  const height = Math.max(3, Math.min(100, Number(day.average) || 0));
                  return h('div', { key: day.date || index, className: 'nu-score-col' },
                    h('span', { className: 'nu-score-col-value' }, String(day.average || 0)),
                    h('div', { className: 'nu-score-track' },
                      h('div', { className: 'nu-score-target', title: '70 分目标线' }),
                      h('div', { className: 'nu-score-bar' + (tone === 'good' ? '' : ' is-' + tone), style: { height: height + '%' } })
                    ),
                    h('span', { className: 'nu-score-col-label' }, day.label || day.date)
                  );
                })
              )
            : h('div', { className: 'nu-score-empty' }, '还没有记录。先生成一餐，这里就会开始积累你的每日三餐得分。'),
          days.length
            ? h('div', { className: 'nu-score-days' }, days.map(function (day, index) {
                const tone = panelScoreTone(day.average);
                return h('div', { key: day.date || index, className: 'nu-score-day' },
                  h('div', { className: 'nu-score-day-date' }, day.label || day.date, h('span', null, day.weekday || '')),
                  h('div', { className: 'nu-score-meals' },
                    ['早餐', '午餐', '晚餐', '加餐'].map(function (type) {
                      const meal = (day.meals || []).filter(function (row) { return row.type === type; })[0];
                      if (!meal) return null;
                      const mealTone = panelScoreTone(meal.score);
                      return h('span', { key: type, className: 'nu-score-meal' },
                        h('span', { className: 'nu-score-meal-type' }, type),
                        h('span', { className: 'nu-score-badge' + (mealTone === 'good' ? '' : ' is-' + mealTone) }, String(meal.score))
                      );
                    })
                  ),
                  h('div', { className: 'nu-score-day-avg' },
                    h('span', { className: 'nu-score-badge' + (tone === 'good' ? '' : ' is-' + tone) }, String(day.average || 0)),
                    h('span', { className: 'nu-score-meal-type' }, ' 均分')
                  )
                );
              }))
            : null
        )
      )
    );
  };

  /* ---------- 05 图文文案 ---------- */
  const renderPostSection = function () {
    if (!result || !post) return null;
    return h('section', { className: 'nu-section', 'data-section': 'post' },
      h('div', { className: 'nu-section-head' },
        h('span', { className: 'nu-step' }, '05'),
        h('div', { className: 'nu-section-heading' },
          h('div', { className: 'nu-section-title' }, '图文文案'),
          h('div', { className: 'nu-section-sub' }, '标题 + 正文（一句一行）+ 备注 + 标签，可直接发视频号')
        )
      ),
      h('div', { className: 'nu-section-body' }, renderPost())
    );
  };

  const renderResult = function () {
    return h('section', { className: 'nu-section', 'data-section': 'result', ref: resultRef },
      h('div', { className: 'nu-section-head' },
        h('span', { className: 'nu-step' }, '03'),
        h('div', { className: 'nu-section-heading' },
          h('div', { className: 'nu-section-title' }, '本餐图文'),
          h('div', { className: 'nu-section-sub' }, result ? '三张 3:4 图文，可直接发视频号' : '生成后会显示在这里')
        ),
        h('div', { className: 'nu-section-tools' },
          h('button', {
            type: 'button',
            className: 'nu-btn nu-btn-sm',
            'aria-label': '保存到电脑',
            disabled: !result || saveBusy,
            title: exportDir ? '保存到 ' + exportDir : '保存到默认目录',
            onClick: onSaveFiles,
          },
            saveBusy ? h('span', { className: 'nu-spinner' }) : null,
            saveBusy ? '保存中…' : '保存到电脑'
          ),
          h('button', {
            type: 'button',
            className: 'nu-btn nu-btn-sm',
            'aria-label': '下载全部',
            disabled: !result || downloading,
            onClick: onDownloadAll,
          }, downloading ? '下载中…' : '下载全部')
        )
      ),
      h('div', { className: 'nu-section-body' },
        renderBanners(),
        (analyzing && result) ? h('div', { className: 'nu-working', role: 'status', 'aria-live': 'polite' },
          h('span', { className: 'nu-spinner' }),
          h('span', null, '正在重新估算…')
        ) : null,
        analyzing && !result
          ? renderWorking()
          : (result ? h('div', null, renderCards(), renderSavedPath()) : renderEmpty())
      )
    );
  };

  if (loading) {
    return h('div', { className: 'nu-page' },
      h('style', null, panelCss),
      renderTopbar(),
      h('div', { className: 'nu-inner' },
        h('div', { className: 'nu-loading', 'aria-busy': 'true', 'aria-label': '正在加载' },
          h('div', { className: 'nu-loading-block' }),
          h('div', { className: 'nu-loading-block is-tall' })
        )
      )
    );
  }

  return h('div', { className: 'nu-page' },
    h('style', null, panelCss),
    renderTopbar(),
    h('div', { className: 'nu-inner' },
      loadError ? h('div', { className: 'nu-banner nu-banner-error nu-banner-page', role: 'alert' },
        h('span', { className: 'nu-banner-icon' }, '!'),
        h('span', null, loadError),
        h('div', { className: 'nu-banner-actions' },
          h('button', {
            type: 'button',
            className: 'nu-btn nu-btn-sm',
            'aria-label': '重试',
            onClick: function () { setReloadKey(function (key) { return key + 1; }); },
          }, '重试')
        )
      ) : null,
      renderProfile(),
      renderMeal(),
      renderResult(),
      renderScore(),
      renderPostSection()
    )
  );
}

/* ============================================================
 * PanelIcon：侧栏图标（餐盘线稿）
 * ============================================================ */
function PanelIcon(props) {
  const size = props && props.size ? props.size : 18;
  const active = Boolean(props && props.active);
  return h('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    focusable: 'false',
    display: 'block',
  },
    h('circle', { cx: 12, cy: 12.6, r: 8.4 }),
    h('circle', {
      cx: 12,
      cy: 12.6,
      r: 5.2,
      fill: active ? 'currentColor' : 'none',
      fillOpacity: active ? 0.16 : 0,
    }),
    h('circle', { cx: 12, cy: 12.6, r: 1.35, fill: 'currentColor', stroke: 'none' })
  );
}

// ---- src/main.js ----
/* ============================================================
 * src/main.js — 三餐营养师：客户端注册
 * 与 card.js / panel.js 共用一个工厂作用域（React、h 由外层提供）。
 * 只做两件事：注册整页主面板（key 与侧栏 id 相同）和侧栏图标入口。
 * 无 import/export，无模块级副作用。
 * ============================================================ */

/** 需要的客户端服务。 */
const inject = ['slots'];

/**
 * 注册主面板与侧栏入口。
 * @param {object} ctx 客户端根上下文
 * @returns {void}
 */
function panelApply(ctx) {
  ctx.slots.inject('main', function () {
    return ctx.slots.register(
      { name: 'main', key: 'nutrition-desk' },
      NutritionPanel
    );
  });
  ctx.effect(function () {
    return ctx.slots.inject('sidebar.panellist', function () {
      return ctx.slots.register(
        {
          name: 'sidebar.panellist',
          id: 'nutrition-desk',
          order: 7,
          label: function () { return '三餐营养师'; },
        },
        PanelIcon
      );
    });
  }, 'nutrition-desk: sidebar entry');
}

    return { inject, apply: panelApply }
  },
})
