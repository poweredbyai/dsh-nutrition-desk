/* ============================================================
 * 三餐营养师 v2 · 四页图文渲染器（P1 封面 / P2 盘子 / P3 体检 / P4 改一处）
 * 纯 Canvas 2D，同步绘制，无第三方依赖、无 DOM 副作用。
 * 尺寸与配色 1:1 移植自模板 敏哥三餐/template.html（1080×1440，左右 72 边距）。
 * 所有顶层名字以 card 前缀，避免与其他文件的作用域冲突。
 * ============================================================ */

var cardW = 1080
var cardH = 1440
var cardPad = 72
var cardRight = cardW - cardPad
var cardInnerW = cardRight - cardPad

var cardBg = '#FCF8F1'
var cardInk = '#1B1714'
var cardInk2 = '#4A423B'
var cardMuted = '#8C7B68'
var cardRed = '#C8342A'
var cardGreen = '#236848'
var cardAmber = '#A9761B'
var cardLine = 'rgba(27,23,20,0.10)'
var cardLine2 = 'rgba(27,23,20,0.07)'
var cardWhite = '#FFFFFF'
var cardPhotoBg = '#E8E2D6'
var cardPlaceholder = '#F3EDE2'
var cardPieVeg = '#5F8A57'
var cardPieCarb = '#D9C08A'
var cardPieProtein = '#C4694A'
var cardInsightBg = 'rgba(35,104,72,0.065)'
var cardAskBg = 'rgba(35,104,72,0.075)'

var cardFamily = '"Source Han Sans CN","思源黑体 CN","Microsoft YaHei",sans-serif'
var cardAscRatio = 0.875 // 字号 → 基线在行盒中的偏移比例

/* ---------------- 基础工具 ---------------- */

function cardF(size, weight) {
  return (weight || 400) + ' ' + size + 'px ' + cardFamily
}

function cardSetFont(ctx, size, weight) {
  ctx.font = cardF(size, weight)
}

function cardBase(top, size, lh) {
  var lineH = lh || size * 1.5
  return top + (lineH - size) / 2 + cardAscRatio * size
}

function cardClamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function cardStr(v) {
  return v === null || v === undefined ? '' : String(v)
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

function cardMeasure(ctx, text, ls) {
  var str = cardStr(text)
  if (!str) return 0
  if (!ls) return ctx.measureText(str).width
  var w = 0
  for (var i = 0; i < str.length; i++) w += ctx.measureText(str.charAt(i)).width
  return w + ls * (str.length - 1)
}

/* 绘制单串，返回「含末尾字距」的推进宽度；ls 为 0 时走原生 fillText */
function cardDrawStr(ctx, text, x, base, size, weight, color, ls, align) {
  var str = cardStr(text)
  if (!str) return 0
  cardSetFont(ctx, size, weight)
  ctx.fillStyle = color || cardInk
  var vis = cardMeasure(ctx, str, ls || 0)
  var adv = ls ? vis + ls : vis
  var startX = x
  if (align === 'center') startX = x - vis / 2
  else if (align === 'right') startX = x - vis
  if (!ls) {
    ctx.fillText(str, startX, base)
    return adv
  }
  var cx = startX
  for (var i = 0; i < str.length; i++) {
    ctx.fillText(str.charAt(i), cx, base)
    cx += ctx.measureText(str.charAt(i)).width + ls
  }
  return adv
}

/* ---------------- 富文本：分段 / 折行 / 绘制 ---------------- */

function cardIsWordChar(c) {
  return /[A-Za-z0-9@#%&'._+\-/=]/.test(c)
}

function cardUnits(text, o) {
  var s = cardStr(text)
  var em = cardStr(o.emphasis)
  var e0 = -1
  var e1 = -1
  if (em) {
    var idx = s.indexOf(em)
    if (idx >= 0) {
      e0 = idx
      e1 = idx + em.length
    }
  }
  var baseColor = o.color || cardInk
  var baseWeight = o.weight || 400
  var units = []
  var i = 0
  function push(a, b) {
    if (b <= a) return
    var emph = e0 >= 0 && a >= e0 && a < e1
    units.push({
      t: s.slice(a, b),
      c: emph ? (o.emphColor || cardRed) : baseColor,
      w: emph ? (o.emphWeight || baseWeight) : baseWeight,
      s: o.size
    })
  }
  while (i < s.length) {
    var j = i + 1
    if (cardIsWordChar(s.charAt(i))) {
      while (j < s.length && cardIsWordChar(s.charAt(j))) j++
    } else if (s.charAt(i) === ' ') {
      while (j < s.length && s.charAt(j) === ' ') j++
    }
    var cuts = [i]
    if (e0 > i && e0 < j) cuts.push(e0)
    if (e1 > i && e1 < j) cuts.push(e1)
    cuts.push(j)
    cuts.sort(function (a, b) { return a - b })
    for (var k = 0; k < cuts.length - 1; k++) push(cuts[k], cuts[k + 1])
    i = j
  }
  return units
}

function cardUnitWidth(ctx, u, ls) {
  cardSetFont(ctx, u.s, u.w)
  return cardMeasure(ctx, u.t, ls)
}

function cardLineWidth(ctx, line, ls) {
  var w = 0
  for (var i = 0; i < line.length; i++) w += cardUnitWidth(ctx, line[i], ls)
  return w
}

function cardWrapUnits(ctx, units, maxW, maxLines, ls) {
  var lines = []
  var cur = []
  var curW = 0
  var i
  for (i = 0; i < units.length; i++) {
    var u = units[i]
    var uw = cardUnitWidth(ctx, u, ls)
    if (cur.length && curW + uw > maxW + 0.01) {
      lines.push(cur)
      cur = []
      curW = 0
      if (u.t === ' ') continue
    }
    cur.push(u)
    curW += uw
  }
  if (cur.length) lines.push(cur)
  if (!lines.length) lines.push([])
  if (lines.length > maxLines) {
    var kept = lines.slice(0, maxLines)
    var last = kept[maxLines - 1].slice()
    while (last.length && cardLineWidth(ctx, last, ls) > maxW - 24) last.pop()
    while (last.length && last[last.length - 1].t === ' ') last.pop()
    var tail = last.length ? last[last.length - 1] : { c: cardInk, w: 400, s: 24 }
    last.push({ t: '…', c: tail.c, w: tail.w, s: tail.s })
    kept[maxLines - 1] = last
    lines = kept
  }
  return lines
}

function cardDrawUnits(ctx, line, x, base, align, ls) {
  var total = cardLineWidth(ctx, line, ls)
  var cx = x
  if (align === 'center') cx = x - total / 2
  else if (align === 'right') cx = x - total
  for (var i = 0; i < line.length; i++) {
    var u = line[i]
    cardSetFont(ctx, u.s, u.w)
    ctx.fillStyle = u.c
    if (!ls) {
      ctx.fillText(u.t, cx, base)
      cx += ctx.measureText(u.t).width
    } else {
      for (var k = 0; k < u.t.length; k++) {
        ctx.fillText(u.t.charAt(k), cx, base)
        cx += ctx.measureText(u.t.charAt(k)).width + ls
      }
    }
  }
  return total
}

function cardPara(ctx, o) {
  var size = o.size
  var ls = o.ls || 0
  var lh = o.lh || size * 1.5
  var units = cardUnits(o.text, o)
  var lines = cardWrapUnits(ctx, units, o.maxW, o.maxLines || 1, ls)
  return { lines: lines, height: lines.length * lh, lh: lh, size: size, ls: ls }
}

function cardDrawPara(ctx, lay, x, top, align) {
  var base = cardBase(top, lay.size, lay.lh)
  for (var i = 0; i < lay.lines.length; i++) {
    cardDrawUnits(ctx, lay.lines[i], x, base + i * lay.lh, align, lay.ls)
  }
  return lay.height
}

function cardParaText(lay) {
  var out = ''
  for (var i = 0; i < lay.lines.length; i++) {
    for (var k = 0; k < lay.lines[i].length; k++) out += lay.lines[i][k].t
  }
  return out
}

function cardTruncated(lay) {
  return cardParaText(lay).indexOf('…') >= 0
}

/* ---------------- 图片 ---------------- */

function cardHasPhoto(data) {
  var p = data && data.photo
  return !!(p && (p.naturalWidth || p.width))
}

function cardCover(ctx, img, x, y, w, h, focusY, radius) {
  var iw = img.naturalWidth || img.width || 0
  var ih = img.naturalHeight || img.height || 0
  if (!iw || !ih) return false
  var scale = Math.max(w / iw, h / ih)
  var sw = w / scale
  var sh = h / scale
  var sx = (iw - sw) / 2
  var sy = cardClamp((ih - sh) * (focusY === undefined ? 0.5 : focusY), 0, Math.max(0, ih - sh))
  ctx.save()
  if (radius) {
    cardRoundRect(ctx, x, y, w, h, radius)
    ctx.clip()
  }
  ctx.fillStyle = cardPhotoBg
  ctx.fillRect(x, y, w, h)
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
  ctx.restore()
  return true
}

/* ---------------- 页头 / 页脚 ---------------- */

function cardKicker(ctx, head, tail) {
  var adv = cardDrawStr(ctx, head, cardPad, 102, 23, 700, cardGreen, 4.6, 'left')
  cardDrawStr(ctx, ' · ' + cardStr(tail), cardPad + adv - 4.6, 102, 23, 400, cardMuted, 4.6, 'left')
}

/* ttl：从 sizes 里挑第一个能排进 maxW、≤2 行且不截断的字号 */
function cardTtlLayout(ctx, text, sizes, maxW) {
  var i
  var fallback = null
  for (i = 0; i < sizes.length; i++) {
    var s = sizes[i]
    var lay = cardPara(ctx, {
      text: text, size: s, weight: 700, color: cardInk,
      maxW: maxW, maxLines: 2, lh: s * 1.24, ls: -0.01 * s
    })
    if (!cardTruncated(lay)) return { lay: lay, size: s }
    if (!fallback) fallback = { lay: lay, size: s }
  }
  return fallback || { lay: cardPara(ctx, { text: text, size: 50, weight: 700, color: cardInk, maxW: maxW, maxLines: 2, lh: 62, ls: -0.5 }), size: 50 }
}

function cardTtlDraw(ctx, ttl, top) {
  return top + cardDrawPara(ctx, ttl.lay, cardPad, top)
}

function cardPager(ctx, text) {
  cardSetFont(ctx, 20, 400)
  var tw = ctx.measureText(text).width
  var pw = tw + 34
  var py = 1356
  ctx.save()
  ctx.strokeStyle = cardLine
  ctx.lineWidth = 1
  cardRoundRect(ctx, cardRight - pw, py, pw, 40, 999)
  ctx.stroke()
  ctx.restore()
  cardDrawStr(ctx, text, cardRight - 17, 1383, 20, 400, cardInk2, 0, 'right')
}

function cardFoot(ctx, account) {
  cardDrawStr(ctx, cardStr(account), cardPad, 1384, 22, 400, cardMuted, 0.44, 'left')
}

/* 提示条：浅绿底 + 左侧绿边（P2 / P3 共用），返回高度 */
function cardInsightBox(ctx, top, text, bold, emphColor) {
  var padY = 28
  var textX = cardPad + 4 + 32
  var lay = cardPara(ctx, {
    text: text, size: 31, weight: 400, color: cardInk2,
    emphasis: bold, emphColor: emphColor || cardInk, emphWeight: 700,
    maxW: cardRight - textX - 32, maxLines: 3, lh: 49.6
  })
  var h = padY * 2 + lay.height
  ctx.save()
  ctx.fillStyle = cardInsightBg
  ctx.beginPath()
  ctx.moveTo(cardPad + 18, top)
  ctx.lineTo(cardRight, top)
  ctx.arcTo(cardRight, top, cardRight, top + 18, 18)
  ctx.lineTo(cardRight, top + h - 18)
  ctx.arcTo(cardRight, top + h, cardRight - 18, top + h, 18)
  ctx.lineTo(cardPad + 18, top + h)
  ctx.arcTo(cardPad, top + h, cardPad, top + h - 18, 18)
  ctx.lineTo(cardPad, top)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = cardGreen
  ctx.fillRect(cardPad, top, 4, h)
  cardDrawPara(ctx, lay, textX, top + padY)
  return h
}

/* ---------------- P1 封面 ---------------- */

function cardDrawP1(ctx, data) {
  ctx.fillStyle = cardBg
  ctx.fillRect(0, 0, cardW, cardH)
  var cover = data.cover || {}

  if (cardHasPhoto(data)) {
    cardCover(ctx, data.photo, 0, 0, cardW, 800, 0.5, 0)
  } else {
    ctx.fillStyle = cardPlaceholder
    ctx.fillRect(0, 0, cardW, 800)
    ctx.save()
    ctx.strokeStyle = cardLine
    ctx.lineWidth = 1
    ctx.strokeRect(72.5, 72.5, 935, 655)
    ctx.restore()
    var mealText = cardStr(data.mealText).trim()
    if (mealText) {
      var lay0 = cardPara(ctx, {
        text: mealText, size: 24, weight: 400, color: cardMuted,
        maxW: 700, maxLines: 3, lh: 36
      })
      cardDrawPara(ctx, lay0, cardW / 2, 400 - lay0.height / 2, 'center')
    }
  }

  /* meta：场景 + 日期 + 绿色下划线 */
  var scene = cardStr(data.mealType || '一餐')
  var sceneAdv = cardDrawStr(ctx, scene, cardPad, 878, 24, 700, cardGreen, 0.96, 'left')
  ctx.fillStyle = cardGreen
  ctx.fillRect(cardPad, 888, sceneAdv - 0.96, 2)
  cardDrawStr(ctx, cardStr(data.date), cardPad + sceneAdv + 14, 879, 24, 400, cardMuted, 0.96, 'left')

  /* 标题 + 说明：在给定字号中挑能放下的 */
  var lines = Array.isArray(cover.lines) ? cover.lines.slice(0, 3) : []
  if (!lines.length) lines = ['']
  var emphasis = cardStr(cover.emphasis)
  var subTexts = Array.isArray(cover.sub) ? cover.sub.slice(0, 2) : []
  var subLh = 30 * 1.62
  var subLays = []
  var i
  for (i = 0; i < subTexts.length; i++) {
    subLays.push(cardPara(ctx, {
      text: subTexts[i], size: 30, weight: 400, color: cardInk2,
      maxW: cardInnerW, maxLines: 1, lh: subLh
    }))
  }
  var subH = 0
  for (i = 0; i < subLays.length; i++) subH += subLays[i].height

  var h1Top = 914
  var bottomLimit = 1339
  var sizes = [82, 75, 68]
  var picked = null
  var si
  for (si = 0; si < sizes.length; si++) {
    var sz = sizes[si]
    var lh = sz * 1.18
    var parts = []
    var total = 0
    var ok = true
    for (i = 0; i < lines.length; i++) {
      var p = cardPara(ctx, {
        text: lines[i], size: sz, weight: 700, color: cardInk,
        emphasis: emphasis, emphColor: cardRed, emphWeight: 700,
        maxW: cardInnerW, maxLines: 2, lh: lh, ls: -0.01 * sz
      })
      if (cardTruncated(p)) ok = false
      parts.push(p)
      total += p.lines.length
    }
    if (ok && total <= 3 && h1Top + total * lh + 22 + subH <= bottomLimit) {
      picked = { size: sz, lh: lh, parts: parts }
      break
    }
  }
  if (!picked) {
    var fsz = 68
    var flh = fsz * 1.18
    var fparts = []
    for (i = 0; i < lines.length; i++) {
      fparts.push(cardPara(ctx, {
        text: lines[i], size: fsz, weight: 700, color: cardInk,
        emphasis: emphasis, emphColor: cardRed, emphWeight: 700,
        maxW: cardInnerW, maxLines: 1, lh: flh, ls: -0.01 * fsz
      }))
    }
    picked = { size: fsz, lh: flh, parts: fparts }
  }

  var y = h1Top
  for (i = 0; i < picked.parts.length; i++) y += cardDrawPara(ctx, picked.parts[i], cardPad, y)
  y += 22
  for (i = 0; i < subLays.length; i++) {
    if (y + subLays[i].height <= bottomLimit || i === 0) y += cardDrawPara(ctx, subLays[i], cardPad, y)
  }

  cardDrawStr(ctx, cardStr(data.profileLine), cardPad, 1388, 22, 400, cardMuted, 0.88, 'left')
  cardDrawStr(ctx, cardStr(data.account), cardRight, 1388, 22, 700, cardInk2, 0, 'right')
}

/* ---------------- P2 盘子 ---------------- */

function cardToneColor(tone) {
  if (tone === 'veg') return cardPieVeg
  if (tone === 'protein') return cardPieProtein
  return cardPieCarb
}

function cardSegsCaption(segs) {
  if (!Array.isArray(segs)) return ''
  var parts = []
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i] || {}
    var label = cardStr(s.label).trim()
    var pct = Number(s.pct)
    if (!label || !isFinite(pct) || pct <= 0) continue
    parts.push(label + ' ' + Math.round(pct) + '%')
  }
  return parts.join(' · ')
}

/* 环形图：外径 390、环厚 88，12 点方向顺时针；pct=0 跳过 */
function cardRing(ctx, cx, cy, segs) {
  var rOut = 195
  var rIn = 107
  var list = []
  var i
  if (Array.isArray(segs)) {
    for (i = 0; i < segs.length; i++) {
      var pct = Number(segs[i] && segs[i].pct)
      if (!isFinite(pct) || pct <= 0) continue
      list.push({ pct: pct, color: cardToneColor(segs[i].tone) })
    }
  }
  if (!list.length) return
  var sum = 0
  for (i = 0; i < list.length; i++) sum += list[i].pct
  var acc = 0
  for (i = 0; i < list.length; i++) {
    var frac0 = acc / 100
    var frac1 = (acc + list[i].pct) / 100
    if (i === list.length - 1 && sum < 100) frac1 = 1
    frac1 = Math.min(1, frac1)
    var a0 = -Math.PI / 2 + frac0 * Math.PI * 2
    var a1 = -Math.PI / 2 + frac1 * Math.PI * 2
    ctx.fillStyle = list[i].color
    if (a1 - a0 >= Math.PI * 2 - 0.0001) {
      ctx.beginPath()
      ctx.arc(cx, cy, rOut, 0, Math.PI * 2)
      ctx.arc(cx, cy, rIn, 0, Math.PI * 2, true)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(cx, cy, rOut, a0, a1)
      ctx.arc(cx, cy, rIn, a1, a0, true)
      ctx.closePath()
      ctx.fill()
    }
    acc += list[i].pct
  }
}

function cardDrawP2(ctx, data) {
  ctx.fillStyle = cardBg
  ctx.fillRect(0, 0, cardW, cardH)
  var plate = data.plate || {}

  cardKicker(ctx, '盘子', '我吃的 vs 一餐该有的')
  var ttl = cardTtlLayout(ctx, cardStr(plate.title), [58, 53, 50], cardInnerW)
  var ttlBottom = cardTtlDraw(ctx, ttl, 130.5)

  var hasPhoto = cardHasPhoto(data)
  var piesTop
  if (hasPhoto) {
    var stripTop = ttlBottom + 30
    cardCover(ctx, data.photo, cardPad, stripTop, cardInnerW, 180, 0.58, 20)
    piesTop = stripTop + 180 + 44
  } else {
    piesTop = ttlBottom + 44
  }

  var cy = piesTop + 195
  var capTop = piesTop + 390 + 24
  var colL = cardPad + cardInnerW / 4
  var colR = cardPad + (cardInnerW * 3) / 4

  cardRing(ctx, colL, cy, plate.mine)
  cardRing(ctx, colR, cy, plate.guide)

  cardDrawStr(ctx, '我这一餐', colL, capTop + 40.5, 36, 700, cardInk, 0, 'center')
  cardDrawStr(ctx, '一餐该有的', colR, capTop + 40.5, 36, 700, cardInk, 0, 'center')
  cardDrawStr(ctx, cardSegsCaption(plate.mine), colL, capTop + 85.75, 22, 400, cardMuted, 0, 'center')
  cardDrawStr(ctx, cardSegsCaption(plate.guide), colR, capTop + 85.75, 22, 400, cardMuted, 0, 'center')

  var insight = plate.insight || {}
  cardInsightBox(ctx, capTop + 91 + 40, cardStr(insight.text), cardStr(insight.bold), cardInk)

  var note = cardStr(plate.note).trim()
  if (note) {
    var nlay = cardPara(ctx, {
      text: note, size: 23, weight: 400, color: cardMuted,
      maxW: cardInnerW, maxLines: 2, lh: 39.1
    })
    cardDrawPara(ctx, nlay, cardPad, 1328 - nlay.height)
  }

  cardFoot(ctx, data.account)
  cardPager(ctx, '2 / 4')
}

/* ---------------- P3 体检 ---------------- */

function cardExamTone(tone) {
  if (tone === 'low') return { fg: cardRed, pill: 'rgba(200,52,42,0.09)', bar: 'rgba(200,52,42,0.11)' }
  if (tone === 'ok') return { fg: cardGreen, pill: 'rgba(35,104,72,0.10)', bar: 'rgba(27,23,20,0.075)' }
  return { fg: cardAmber, pill: 'rgba(169,118,27,0.11)', bar: 'rgba(27,23,20,0.075)' }
}

function cardExamTargetLines(row) {
  var tgt = row.target
  if (Array.isArray(tgt)) return tgt.slice(0, 2).map(cardStr)
  var s = cardStr(tgt).trim()
  return s ? s.split('\n').slice(0, 2) : []
}

function cardExamRowHeight(row, isLast) {
  var count = Math.max(1, cardExamTargetLines(row).length)
  var lnH = 80.16 + Math.max(8.16, 27.13 + (count - 1) * 36)
  return 26 + lnH + 18 + 9 + 26 + (isLast ? 0 : 1)
}

function cardExamRowDraw(ctx, row, top, isLast) {
  var tone = cardExamTone(row.tone)
  var baseline = top + 106

  cardDrawStr(ctx, cardStr(row.label).trim(), cardPad, baseline, 31, 700, cardInk, 0, 'left')

  var numStr = cardStr(row.value)
  cardDrawStr(ctx, numStr, 236, baseline, 96, 700, tone.fg, -2.88, 'left')
  var numW = cardMeasure(ctx, numStr, -2.88)
  var unit = cardStr(row.unit).trim()
  if (unit) cardDrawStr(ctx, unit, 236 + numW + 5, baseline, 32, 500, cardInk2, 0, 'left')

  var stText = cardStr(row.status).trim()
  if (stText) {
    cardSetFont(ctx, 25, 700)
    var stW = ctx.measureText(stText).width
    var pillW = stW + 36
    var pillTop = baseline - 34.1
    ctx.save()
    ctx.fillStyle = tone.pill
    cardRoundRect(ctx, 498, pillTop, pillW, 50, 999)
    ctx.fill()
    ctx.restore()
    cardDrawStr(ctx, stText, 498 + 18, baseline, 25, 700, tone.fg, 0, 'left')
  }

  var tgtLines = cardExamTargetLines(row)
  for (var t = 0; t < tgtLines.length; t++) {
    cardDrawStr(ctx, tgtLines[t], cardRight, baseline + t * 36, 24, 400, cardMuted, 0, 'right')
  }

  var count = Math.max(1, tgtLines.length)
  var lnH = 80.16 + Math.max(8.16, 27.13 + (count - 1) * 36)
  var barY = top + 26 + lnH + 18
  ctx.save()
  ctx.fillStyle = tone.bar
  cardRoundRect(ctx, cardPad, barY, cardInnerW, 9, 999)
  ctx.fill()
  var pct = cardClamp(Number(row.percent) || 0, 0, 100)
  if (pct > 0) {
    ctx.fillStyle = tone.fg
    cardRoundRect(ctx, cardPad, barY, cardInnerW * pct / 100, 9, 999)
    ctx.fill()
  }
  ctx.restore()

  var h = 26 + lnH + 18 + 9 + 26 + (isLast ? 0 : 1)
  if (!isLast) {
    ctx.fillStyle = cardLine2
    ctx.fillRect(cardPad, top + h - 1, cardInnerW, 1)
  }
  return h
}

function cardSayLayout(ctx, exam, hasPhoto) {
  var say = exam.say || {}
  var textW = hasPhoto ? 786 : cardW - 144
  var lay = cardPara(ctx, {
    text: cardStr(say.text), size: 30, weight: 400, color: cardInk2,
    emphasis: cardStr(say.bold), emphColor: cardInk, emphWeight: 700,
    maxW: textW, maxLines: 3, lh: 48
  })
  var h = hasPhoto ? 27 * 2 + Math.max(210, lay.height) + 2 : 34 * 2 + lay.height + 2
  return { lay: lay, h: h, top: 1328 - h, photo: hasPhoto }
}

function cardSayDraw(ctx, data, exam, hasPhoto) {
  var m = cardSayLayout(ctx, exam, hasPhoto)
  ctx.save()
  ctx.fillStyle = cardWhite
  cardRoundRect(ctx, 0, m.top, cardW, m.h, 26)
  ctx.fill()
  ctx.strokeStyle = cardLine2
  ctx.lineWidth = 1
  cardRoundRect(ctx, 0.5, m.top + 0.5, cardW - 1, m.h - 1, 26)
  ctx.stroke()
  ctx.restore()

  if (hasPhoto) {
    cardCover(ctx, data.photo, 27, m.top + 27, 210, 210, 0.5, 18)
    var tx = 27 + 210 + 24
    cardDrawPara(ctx, m.lay, tx, m.top + 27 + (210 - m.lay.height) / 2)
  } else {
    cardDrawPara(ctx, m.lay, 72, m.top + 34)
  }
}

function cardDrawP3(ctx, data) {
  ctx.fillStyle = cardBg
  ctx.fillRect(0, 0, cardW, cardH)
  var exam = data.exam || {}
  var rows = Array.isArray(exam.rows) ? exam.rows.slice(0, 3) : []
  var hasPhoto = cardHasPhoto(data)

  cardKicker(ctx, '体检', '三个数字看这一餐')

  var sayTop = cardSayLayout(ctx, exam, hasPhoto).top
  var sizes = [58, 53, 50]
  var chosen = null
  var si
  for (si = 0; si < sizes.length; si++) {
    var ttl = cardTtlLayout(ctx, cardStr(exam.title), [sizes[si]], cardInnerW)
    var ttlBottom = 130.5 + ttl.lay.height
    var start = ttlBottom + 36
    var acc = start
    var r
    for (r = 0; r < rows.length; r++) acc += cardExamRowHeight(rows[r], r === rows.length - 1)
    var insTop = acc + 40
    var insLay = cardPara(ctx, {
      text: cardStr(exam.insight), size: 31, weight: 400, color: cardInk2,
      maxW: cardRight - (cardPad + 4 + 32) - 32, maxLines: 3, lh: 49.6
    })
    if (insTop + 56 + insLay.height <= sayTop - 20) {
      chosen = { ttl: ttl, top: start, insTop: insTop }
      break
    }
  }
  if (!chosen) {
    var ttlF = cardTtlLayout(ctx, cardStr(exam.title), [50], cardInnerW)
    var startF = 130.5 + ttlF.lay.height + 36
    var accF = startF
    var rf
    for (rf = 0; rf < rows.length; rf++) accF += cardExamRowHeight(rows[rf], rf === rows.length - 1)
    chosen = { ttl: ttlF, top: startF, insTop: accF + 40 }
  }

  cardTtlDraw(ctx, chosen.ttl, 130.5)
  var y = chosen.top
  for (var i = 0; i < rows.length; i++) {
    y += cardExamRowDraw(ctx, rows[i], y, i === rows.length - 1)
  }
  cardInsightBox(ctx, chosen.insTop, cardStr(exam.insight), '', cardInk)
  cardSayDraw(ctx, data, exam, hasPhoto)
  cardFoot(ctx, data.account)
  cardPager(ctx, '3 / 4')
}

/* ---------------- P4 改一处 ---------------- */

/* 结果文本：→ 左侧的数字起到末尾用绿色 700 */
function cardResultParts(text) {
  var s = cardStr(text)
  var arrow = s.indexOf('→')
  if (arrow < 0) return [{ t: s, green: false }]
  var start = arrow
  while (start > 0 && s.charAt(start - 1) !== ' ') start--
  if (start > 0) start++
  return [
    { t: s.slice(0, start), green: false },
    { t: s.slice(start), green: true }
  ]
}

function cardDrawInline(ctx, parts, x, base) {
  var cx = x
  for (var i = 0; i < parts.length; i++) {
    cx = cardDrawStr(ctx, parts[i].t, cx, base, parts[i].size, parts[i].weight, parts[i].color, parts[i].ls || 0, 'left')
  }
  return cx - x
}

function cardDrawP4(ctx, data) {
  ctx.fillStyle = cardBg
  ctx.fillRect(0, 0, cardW, cardH)
  var fix = data.fix || {}
  var rows = Array.isArray(fix.rows) ? fix.rows.slice(0, 3) : []
  var ask = fix.ask || {}

  cardKicker(ctx, '改一处', '明天的' + cardStr(data.mealType || '这一餐'))
  var ttl = cardTtlLayout(ctx, cardStr(fix.title), [58, 53, 50], cardInnerW)
  var ttlBottom = cardTtlDraw(ctx, ttl, 130.5)

  /* 底部三块从底往上量：CTA 固定，提问卡贴底 112 */
  var qLay = cardPara(ctx, {
    text: cardStr(ask.q), size: 32, weight: 700, color: cardInk,
    maxW: cardW - 144, maxLines: 2, lh: 48
  })
  var optTexts = Array.isArray(ask.options) ? ask.options.slice(0, 2).map(cardStr) : []
  var optH = optTexts.length ? 60 : 0
  var hintText = cardStr(ask.hint).trim()
  var hintH = hintText ? 23 * 1.5 : 0
  var askH = 30 + qLay.height + (optTexts.length ? 18 + optH : 0) + (hintText ? 16 + hintH : 0) + 30
  var askTop = 1328 - askH

  var faqLay = null
  var whyLay = null
  var rowTops = []
  var rowsTop = ttlBottom + 38
  var wanted = rowsTop + rows.length * 169 + 60

  /* why */
  var why = fix.why || {}
  var whyTop = rowsTop + rows.length * 169 + 60
  whyLay = cardPara(ctx, {
    text: cardStr(why.text), size: 29, weight: 400, color: cardMuted,
    emphasis: cardStr(why.bold), emphColor: cardInk2, emphWeight: 700,
    maxW: cardInnerW - 23, maxLines: 2, lh: 46.98
  })
  var faqTop = whyTop + whyLay.height + 46
  var faq = fix.faq || {}
  var qText = cardStr(faq.q).trim()
  var aText = cardStr(faq.a && faq.a.text !== undefined ? faq.a.text : faq.a)
  cardSetFont(ctx, 26, 700)
  var qW = qText ? ctx.measureText(qText).width : 0
  var aX = cardPad + qW + (qText ? 18 : 0)
  faqLay = cardPara(ctx, {
    text: aText, size: 26, weight: 400, color: cardInk2,
    emphasis: cardStr(faq.a && faq.a.bold), emphColor: cardGreen, emphWeight: 700,
    maxW: cardRight - aX, maxLines: 2, lh: 39
  })
  var faqH = Math.max(39, faqLay.height)

  /* 建议行 */
  var y = rowsTop
  var i
  for (i = 0; i < rows.length; i++) {
    var row = rows[i] || {}
    var isLast = i === rows.length - 1
    var rowH = 168 + (isLast ? 0 : 1)
    rowTops.push(y)

    /* 序号块 */
    var noText = cardStr(row.no).trim() || ('0' + (i + 1)).slice(-2)
    ctx.save()
    ctx.fillStyle = row.strong ? cardGreen : '#C8BCAB'
    cardRoundRect(ctx, cardPad, y + 58, 52, 52, 12)
    ctx.fill()
    ctx.restore()
    cardDrawStr(ctx, noText, cardPad + 26, y + 58 + 34.6, 23, 700, cardWhite, 0, 'center')

    /* 右侧结果 */
    var rsParts = cardResultParts(row.result)
    var rsLay = []
    var rsW = 0
    var rsSize = 26
    var part
    for (var k = 0; k < rsParts.length; k++) {
      cardSetFont(ctx, rsSize, rsParts[k].green ? 700 : 400)
      var w = ctx.measureText(rsParts[k].t).width
      rsLay.push({ t: rsParts[k].t, w: w, green: rsParts[k].green })
      rsW += w
    }
    var rsX = cardRight - rsW
    cardSetFont(ctx, rsSize, 400)
    for (k = 0; k < rsLay.length; k++) {
      cardDrawStr(ctx, rsLay[k].t, rsX, y + 95, rsSize, rsLay[k].green ? 700 : 400, rsLay[k].green ? cardGreen : cardMuted, 0, 'left')
      rsX += rsLay[k].w
    }

    /* 主文：40px，放不下缩到 34 再截断 */
    var titleMax = cardRight - 146 - 22 - rsW
    var titleLay = cardPara(ctx, {
      text: cardStr(row.title), size: 40, weight: 700, color: cardInk,
      maxW: titleMax, maxLines: 1, lh: 50, ls: -0.4
    })
    if (cardTruncated(titleLay)) {
      titleLay = cardPara(ctx, {
        text: cardStr(row.title), size: 34, weight: 700, color: cardInk,
        maxW: titleMax, maxLines: 1, lh: 42.5, ls: -0.34
      })
    }
    cardDrawPara(ctx, titleLay, 146, y + 59)

    if (!isLast) {
      ctx.fillStyle = cardLine2
      ctx.fillRect(cardPad, y + rowH - 1, cardInnerW, 1)
    }
    y += rowH
  }

  /* 表态引文 */
  var whyH = Math.max(whyLay.height, 47)
  ctx.fillStyle = cardLine
  ctx.fillRect(cardPad, whyTop, 3, whyH)
  cardDrawPara(ctx, whyLay, cardPad + 23, whyTop)

  /* FAQ */
  if (qText) cardDrawStr(ctx, qText, cardPad, cardBase(faqTop, 26, 39), 26, 700, cardInk, 0, 'left')
  cardDrawPara(ctx, faqLay, aX, faqTop)

  /* 提问卡（整幅贴底） */
  ctx.save()
  ctx.fillStyle = cardAskBg
  cardRoundRect(ctx, 0, askTop, cardW, askH, 26)
  ctx.fill()
  ctx.restore()
  var ay = askTop + 30
  ay += cardDrawPara(ctx, qLay, cardPad, ay)
  if (optTexts.length) {
    ay += 18
    var ox = cardPad
    for (i = 0; i < optTexts.length; i++) {
      cardSetFont(ctx, 25, 400)
      var tw = ctx.measureText(optTexts[i]).width
      var pw = tw + 44
      ctx.save()
      ctx.fillStyle = cardWhite
      cardRoundRect(ctx, ox, ay, pw, 60, 999)
      ctx.fill()
      ctx.strokeStyle = cardLine
      ctx.lineWidth = 1
      cardRoundRect(ctx, ox + 0.5, ay + 0.5, pw - 1, 59, 999)
      ctx.stroke()
      ctx.restore()
      cardDrawStr(ctx, optTexts[i], ox + 22, ay + 38.1, 25, 400, cardInk2, 0, 'left')
      ox += pw + 14
    }
    ay += 60
  }
  if (hintText) {
    ay += 16
    cardDrawStr(ctx, hintText, cardPad, cardBase(ay, 23, 34.5), 23, 400, cardMuted, 0, 'left')
  }

  /* CTA 页脚 */
  var ctaY = 1384
  var cx = cardDrawStr(ctx, '关注 ', cardPad, ctaY, 25, 400, cardMuted, 0, 'left')
  cx += cardDrawStr(ctx, cardStr(data.account), cx, ctaY, 25, 700, cardInk, 0, 'left')
  cardDrawStr(ctx, '，每天只改一处', cx, ctaY, 25, 400, cardMuted, 0, 'left')
  cardPager(ctx, '4 / 4')
}

/* ---------------- 入口 ---------------- */

function cardDraw(kind, data, canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return
  var ctx = canvas.getContext('2d')
  if (!ctx) return
  var w = canvas.width || cardW
  var h = canvas.height || cardH
  var d = data || {}
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.scale(w / cardW, h / cardH)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  try {
    if (kind === 'p2') cardDrawP2(ctx, d)
    else if (kind === 'p3') cardDrawP3(ctx, d)
    else if (kind === 'p4') cardDrawP4(ctx, d)
    else cardDrawP1(ctx, d)
  } finally {
    ctx.restore()
  }
}

