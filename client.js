window.__ModuleLoader__.load({
  id: 'dsh-nutrition-desk',
  factory(require) {
    const React = require('react')
    const h = React.createElement
// ---- src/card.js ----
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

.nu-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.nu-card{display:flex;flex-direction:column;min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;overflow:hidden;background:var(--dsw-alias-bg-base)}
.nu-card-head{display:flex;align-items:center;gap:8px;padding:9px 10px 9px 13px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.nu-card-index{font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);letter-spacing:.04em}
.nu-card-name{font-size:12.5px;font-weight:600}
.nu-card-btn{margin-left:auto}
.nu-canvas-wrap{position:relative;width:100%;aspect-ratio:3/4;background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent)}
.nu-canvas{display:block;width:100%;height:100%}
.nu-legacy{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:22px 20px;border:1px dashed var(--dsw-alias-border-l2);border-radius:14px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 2%,transparent)}
.nu-legacy-title{margin:0;font-size:14px;font-weight:650}
.nu-legacy-desc{margin:0;font-size:13px;line-height:1.7;color:var(--dsw-alias-label-secondary)}

/* 本餐照片（可选） */
.nu-photo{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 3%,transparent)}
.nu-photo-thumb{width:96px;height:96px;flex:none;border-radius:10px;object-fit:cover;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);display:block}
.nu-photo-main{flex:1 1 180px;min-width:0;display:flex;flex-direction:column;gap:3px}
.nu-photo-title{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary)}
.nu-photo-name{font-size:12.5px;color:var(--dsw-alias-label-primary);word-break:break-all}
.nu-photo-hint{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}
.nu-photo-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.nu-file{display:none}
.nu-photo-error{margin-top:8px;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}

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
.nu-skeleton-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.nu-skel{position:relative;aspect-ratio:3/4;border-radius:14px;border:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);animation:nu-pulse 1.5s ease-in-out infinite}
.nu-skel::after{content:"";position:absolute;inset:14% 10%;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);opacity:.6}
.nu-skeleton-row{display:flex;align-items:center;gap:8px;margin:12px 0 14px;font-size:12.5px;color:var(--dsw-alias-label-secondary)}

.nu-loading{padding:24px 0 0}
.nu-loading-block{height:96px;margin-top:20px;border-radius:16px;border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent);animation:nu-pulse 1.5s ease-in-out infinite}
.nu-loading-block.is-tall{height:220px}

@media (max-width:1080px){
  .nu-cards,.nu-skeleton-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .nu-card,.nu-skel{width:100%}
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
  .nu-cards,.nu-skeleton-grid{grid-template-columns:minmax(0,1fr);justify-items:center}
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
  { kind: 'p1', name: '封面', label: '下载封面', file: '01-封面.png' },
  { kind: 'p2', name: '盘子', label: '下载盘子', file: '02-盘子.png' },
  { kind: 'p3', name: '体检', label: '下载体检', file: '03-体检.png' },
  { kind: 'p4', name: '改一处', label: '下载改一处', file: '04-改一处.png' },
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

/** 卡片账号：档案里的自媒体账号（纯文字、不带 @），空则回退到发布账号。 */
const panelAccountFallback = 'AI说餐谱';

function panelAccountName(profile) {
  const name = profile && profile.name ? String(profile.name).trim() : '';
  if (!name) return panelAccountFallback;
  return name.replace(/^@+/, '').trim() || panelAccountFallback;
}

/** 卡片左下身份行：42 岁 · 175cm · 67kg（模板不带性别） */
function panelProfileLine(profile) {
  const data = profile || {};
  const head = [];
  if (Number(data.age) > 0) head.push(Number(data.age) + ' 岁');
  const parts = [];
  if (head.length) parts.push(head.join(' '));
  if (Number(data.height) > 0) parts.push(Number(data.height) + 'cm');
  if (Number(data.weight) > 0) parts.push(Number(data.weight) + 'kg');
  return parts.join(' · ');
}

/** 新版四页图文（p1-p4）才有 cover；旧结果没有。 */
function panelHasDeck(result) {
  return Boolean(result && result.cover && typeof result.cover === 'object');
}

/** 组装传给 cardDraw 的 data：Host 结果 + 面板本地字段（日期 / 账号 / 身份行 / 照片 / 原文）。 */
function panelCardData(result, profile, mealType, text, photo) {
  const base = result && typeof result === 'object' ? result : {};
  return Object.assign({}, base, {
    mealType: base.mealType || mealType,
    date: panelDateText(),
    account: panelAccountName(profile),
    profileLine: panelProfileLine(profile),
    photo: photo || null,
    mealText: String(text || base.mealText || '').trim(),
  });
}

/** 把接口返回的图文文案整理成可渲染的结构（旧数据没有 post 时用现有字段拼）。 */
function panelPostOf(result, profile) {
  const data = result && result.post && typeof result.post === 'object' ? result.post : {};
  const mealType = (result && result.mealType) || '这一餐';
  const deck = panelHasDeck(result);
  const p = profile || {};
  const gender = p.gender === 'male' ? '男' : p.gender === 'female' ? '女' : '';
  const title = String(data.title || '')
    || ((result && result.headline ? String(result.headline) : '这一餐吃得怎么样') + ' #' + mealType);
  const body = String(data.body || '')
    || (result && result.summary ? String(result.summary) : '');
  // v2 不再输出「备注：性别、年龄…」那一行（身份已经在封面左下角）。
  const remark = String(data.remark || '')
    || (deck ? '' : ['备注：' + (gender || '—'), (p.age || '—') + '岁', (p.height || '—') + 'cm', (p.weight || '—') + 'kg'].join('、'));
  const tags = (Array.isArray(data.tags) && data.tags.length ? data.tags : ['#AI说餐谱', '#' + mealType, '#上班族', '#久坐族'])
    .map(function (tag) { return String(tag); })
    .slice(0, 4);
  const lines = Array.isArray(data.lines) && data.lines.length
    ? data.lines.map(function (line) { return String(line); })
    : panelSplitClauses(body);
  const text = String(data.text || '')
    || [title, lines.join('\n'), remark, tags.join(' ')].filter(Boolean).join('\n\n');
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

/** 把本地照片对象解码成可画进 canvas 的 HTMLImageElement；失败返回 null（回退无照片版式）。 */
async function panelDecodePhoto(photo) {
  if (!photo || !photo.url) return null;
  try {
    if (photo.img && photo.img.src === photo.url) {
      if (!photo.img.complete) await photo.img.decode();
      return photo.img.naturalWidth > 0 ? photo.img : null;
    }
    const image = new Image();
    image.src = photo.url;
    await image.decode();
    return image.naturalWidth > 0 ? image : null;
  } catch (err) {
    return null;
  }
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

  // 生成这一餐时用的原文（编辑框之后可能被改，卡片仍用当次原文）
  const [resultText, setResultText] = React.useState('');
  // 本餐照片：只在浏览器本地使用，{ url, img, name }，不上传 Host
  const [photo, setPhoto] = React.useState(null);
  const [photoError, setPhotoError] = React.useState('');

  const resultRef = React.useRef(null);
  const copyTimerRef = React.useRef(0);
  const pendingScrollRef = React.useRef(false);
  const canvasARef = React.useRef(null);
  const canvasBRef = React.useRef(null);
  const canvasCRef = React.useRef(null);
  const canvasDRef = React.useRef(null);
  const canvasRefs = React.useMemo(function () {
    return [canvasARef, canvasBRef, canvasCRef, canvasDRef];
  }, [canvasARef, canvasBRef, canvasCRef, canvasDRef]);
  const fileInputRef = React.useRef(null);
  const photoRef = React.useRef(null);

  const metrics = panelBodyMetrics(profile);
  const savedMetrics = panelBodyMetrics(savedProfile);
  const summaryChips = panelSummaryChips(savedProfile);
  const post = result ? panelPostOf(result, savedProfile || profile) : null;
  const hasDeck = panelHasDeck(result);
  const cardMealText = resultText || mealText.trim();
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
        if (last && typeof last.text === 'string') {
          setMealText(last.text);
          setResultText(last.text);
        }
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

  /* 结果变化后画四页卡片；字体加载完再补画一次 */
  React.useEffect(function () {
    if (!hasDeck) return undefined;
    let cancelled = false;
    const draw = function () {
      if (cancelled) return;
      // 档案还没单独保存过时，用当前表单值兜底，保证卡片账号/身份行有内容。
      const profileForCard = Object.keys(savedProfile || {}).length > 0
        ? savedProfile
        : panelNormalizeProfile(profile);
      const data = panelCardData(result, profileForCard, mealType, cardMealText, photo && photo.img);
      for (let i = 0; i < canvasRefs.length; i += 1) {
        const canvas = canvasRefs[i].current;
        if (!canvas) continue;
        canvas.width = 1080;
        canvas.height = 1440;
        try {
          if (typeof cardDraw === 'function') cardDraw(panelCardMeta[i].kind, data, canvas);
        } catch (err) {
          /* 单张卡片画失败不影响其余几页 */
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
  }, [result, hasDeck, savedProfile, profile, mealType, cardMealText, photo, canvasRefs]);

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
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
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

  /* ---------- 本餐照片（仅浏览器本地，不上传） ---------- */
  const revokePhoto = function () {
    if (photoRef.current && photoRef.current.url) URL.revokeObjectURL(photoRef.current.url);
    photoRef.current = null;
  };

  const onPickPhotoFile = async function (file) {
    if (!file) return;
    if (!/^image\//.test(String(file.type || ''))) {
      setPhotoError('请选择图片文件（JPG / PNG）');
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch (err) {
      URL.revokeObjectURL(url);
      setPhotoError('这张图片读不出来，换一张试试');
      return;
    }
    if (!image.naturalWidth) {
      URL.revokeObjectURL(url);
      setPhotoError('这张图片读不出来，换一张试试');
      return;
    }
    revokePhoto();
    const next = { url: url, img: image, name: file.name || '本餐照片' };
    photoRef.current = next;
    setPhoto(next);
    setPhotoError('');
  };

  const onPhotoFileChange = function (event) {
    const input = event.target;
    const file = input && input.files ? input.files[0] : null;
    if (input) input.value = '';
    if (file) onPickPhotoFile(file);
  };

  const onRemovePhoto = function () {
    revokePhoto();
    setPhoto(null);
    setPhotoError('');
  };

  const onPastePhoto = function (event) {
    const clipboard = event.clipboardData;
    if (!clipboard || !clipboard.items) return;
    for (let i = 0; i < clipboard.items.length; i += 1) {
      const item = clipboard.items[i];
      if (item.kind === 'file' && /^image\//.test(String(item.type || ''))) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          onPickPhotoFile(file);
          return;
        }
      }
    }
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
      // 照片只在浏览器本地解码；失败就回退成无照片版式，不影响生成。
      if (photo && photo.url) {
        const decoded = await panelDecodePhoto(photo);
        if (!decoded) {
          setPhotoError('照片读取失败，这次按无照片生成');
          if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
          photoRef.current = null;
          setPhoto(null);
        } else if (!photo.img || photo.img !== decoded) {
          const nextPhoto = Object.assign({}, photo, { img: decoded });
          photoRef.current = nextPhoto;
          setPhoto(nextPhoto);
        }
      } else {
        setPhotoError('');
      }
      const data = await panelRequest('analyze', { type: mealType, text: text, profile: panelNormalizeProfile(profile) });
      const nextResult = data.result && typeof data.result === 'object' ? data.result : null;
      if (!nextResult) throw new Error('没有拿到分析结果，请重试');
      pendingScrollRef.current = true;
      setResult(nextResult);
      setResultText(text);
      // Host 在 analyze 时会把当前档案落库，这里同步一份，卡片账号/身份行立刻更新。
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
    if (!hasDeck || downloading) return;
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
    if (!hasDeck || saveBusy) return;
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
      const texts = post && post.text ? [{ name: '05-图文文案.md', content: post.text }] : [];
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
        h('div', { className: 'nu-photo' },
          photo ? h('img', { className: 'nu-photo-thumb', src: photo.url, alt: '本餐照片缩略图' }) : null,
          h('div', { className: 'nu-photo-main' },
            h('div', { className: 'nu-photo-title' }, '本餐照片（可选）'),
            photo
              ? h('div', { key: 'name', className: 'nu-photo-name' }, photo.name || '本餐照片')
              : null,
            h('div', { className: 'nu-photo-hint' }, photo
              ? '只在这台电脑上使用，不会上传'
              : '点选照片，或直接把照片粘贴到页面里；没有照片也能生成')
          ),
          h('div', { className: 'nu-photo-actions' },
            h('input', {
              className: 'nu-file',
              ref: fileInputRef,
              type: 'file',
              accept: 'image/*',
              'aria-label': '选择本餐照片文件',
              onChange: onPhotoFileChange,
            }),
            h('button', {
              type: 'button',
              className: 'nu-btn nu-btn-sm',
              'aria-label': photo ? '换一张照片' : '选择本餐照片',
              onClick: function () {
                if (fileInputRef.current) fileInputRef.current.click();
              },
            }, photo ? '换一张' : '选择照片'),
            photo ? h('button', {
              type: 'button',
              className: 'nu-btn nu-btn-sm',
              'aria-label': '移除照片',
              onClick: onRemovePhoto,
            }, '移除') : null
          )
        ),
        photoError ? h('div', { className: 'nu-photo-error', role: 'status' }, photoError) : null,
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
          }, meta.label)
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
      h('p', { className: 'nu-empty-desc' }, '填好个人档案，写下这一餐吃了什么，点「生成营养图文」，就会得到封面、盘子、体检、改一处四张 3:4 图文，外加一段可直接发布的图文文案。'),
      h('div', { className: 'nu-empty-steps' },
        h('span', { className: 'nu-empty-step' }, h('i', null, '01'), '填档案'),
        h('span', { className: 'nu-empty-step' }, h('i', null, '02'), '记一餐'),
        h('span', { className: 'nu-empty-step' }, h('i', null, '03'), '出四张图')
      )
    );
  };

  /* 旧版结果（v1，只有三张卡片、没有 cover）：提示重新生成，不画卡片也不崩 */
  const renderLegacy = function () {
    return h('div', { className: 'nu-legacy', role: 'status' },
      h('p', { className: 'nu-legacy-title' }, '这版图文是旧格式'),
      h('p', { className: 'nu-legacy-desc' }, '重新生成一次即可看到新版四页图文（封面 / 盘子 / 体检 / 改一处）。'),
      h('button', {
        type: 'button',
        className: 'nu-btn nu-btn-sm',
        'aria-label': '重新生成图文',
        disabled: !canGenerate,
        onClick: onGenerate,
      }, analyzing ? '生成中…' : '重新生成')
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
        h('span', { className: 'nu-post-hint' }, post.remark ? '标题 + 正文 + 备注 + 标签，可直接发布' : '标题 + 正文 + 标签，可直接发布'),
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
        post.remark ? h('div', { className: 'nu-post-row' },
          h('span', { className: 'nu-post-label' }, '备注'),
          h('p', { className: 'nu-post-text nu-post-muted', 'data-part': 'remark' }, post.remark)
        ) : null,
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
          h('div', { className: 'nu-section-sub' }, post && post.remark
            ? '标题 + 正文（一句一行）+ 备注 + 标签，可直接发视频号'
            : '标题 + 正文（一句一行）+ 标签，可直接发视频号')
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
          h('div', { className: 'nu-section-sub' }, hasDeck
            ? '四张 3:4 图文，可直接发视频号'
            : result ? '旧版结果，重新生成即可看到四页图文' : '生成后会显示在这里')
        ),
        h('div', { className: 'nu-section-tools' },
          h('button', {
            type: 'button',
            className: 'nu-btn nu-btn-sm',
            'aria-label': '保存到电脑',
            disabled: !hasDeck || saveBusy,
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
            disabled: !hasDeck || downloading,
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
          : (result
              ? (hasDeck ? h('div', null, renderCards(), renderSavedPath()) : renderLegacy())
              : renderEmpty())
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

  return h('div', { className: 'nu-page', onPaste: onPastePhoto },
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
