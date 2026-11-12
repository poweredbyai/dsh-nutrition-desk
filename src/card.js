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

