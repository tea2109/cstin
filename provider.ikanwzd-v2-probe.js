export const { parseHTML } = await import('https://gcore.jsdelivr.net/npm/linkedom/worker.min.js');

export const meta = {
  code: 'ikanwzd-v1',
  base: 'ikanwzd.cc',
  name: 'ikanwzd V2 DOM探测',
  host: ['www.ikanwzd.cc', 'ikanwzd.cc'],
  word: ['R18', '本子', '漫画'],
}

// Agent: 根据 Wnacg 官网 HTML 源码精准对齐生成的声明式数组路由规则 喵🐾
export const routes = [
  {
    key: 'list',
    type: 'template',
    pattern: '/albums-index-page-{page}.html',
  },
  {
    key: 'ranking',
    match: 'type',
    type: 'template',
    pattern: '/albums-{albums}-page-{page}-type-{type}-cate-{cate}.html',
    defaults: { albums: 'favorite_ranking' }
  },
  {
    key: 'tag',
    match: 'tag',
    type: 'template',
    pattern: '/albums-index-page-{page}-tag-{tag}.html',
  },
  {
    key: 'cate',
    match: 'cate',
    type: 'template',
    pattern: '/albums-index-page-{page}-cate-{cate}.html',
  },
  {
    key: 'search',
    match: 'word',
    path: '/search/',
    paging: { pageKey: 'p' },
    paramMap: { word: 'q' },
    defaults: { syn: 'yes', f: '_all', s: 'create_time_DESC' }
  }
]

export const entryMeta = async () => [
  { mode: 'radio', name: '最近更新', code: 'albums=index' },
  { mode: 'radio', name: '今日排行', code: 'albums=favorite_ranking&type=day' },
  { mode: 'radio', name: '本周排行', code: 'albums=favorite_ranking&type=week' },
  { mode: 'radio', name: '本月排行', code: 'albums=favorite_ranking&type=month' },
  { mode: 'radio', name: '今年排行', code: 'albums=favorite_ranking&type=year' }
]

export const entryList = async ({ code }) => {
  const target = 'https://www.ikanwzd.cc/'
  const { document } = await fetch(target).then(v => v.text()).then(parseHTML)

  const testUrl = 'https://wnacg.ru/albums-index-page-1.html'
  const { document: testDoc } = await fetch(testUrl).then(v => v.text()).then(parseHTML)
  const cover = testDoc.querySelector('.pic_box a img')?.getAttribute('src') || ''
  const fullCover = cover ? new URL(cover, testUrl).href : ''

  const items = []
  const seen = new Set()

  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || ''
    const text = (a.textContent || '').replace(/\s+/g, ' ').trim()
    if (!href || !text) continue

    let full = ''
    try { full = new URL(href, target).href } catch (_) { continue }
    if (!full.includes('ikanwzd.cc')) continue
    if (seen.has(full)) continue

    const low = href.toLowerCase()
    if (
      low === '/' ||
      low.startsWith('javascript:') ||
      low.startsWith('#') ||
      /login|register|history|rank|category|genre|search|author|tag/.test(low)
    ) continue

    seen.add(full)
    items.push({
      mode: 'comic',
      code: hash(`${code}:probe:${full}`),
      link: full,
      cove: fullCover,
      name: text.slice(0, 80) + ' | ' + href.slice(0, 100),
      cardAction: scheme('call', { method: 'entryPost', link: full })
    })

    if (items.length >= 30) break
  }

  return items
}

export const entryPost = async ({ link }) => {
  console.info('[wnacg] fetch detail link from Dart Engine:', link)
  const { document } = await fetch(link).then(v => v.text()).then(parseHTML)
  const metaInfo = [...document.querySelectorAll('.uwconn > label')]
    .map(el => (el.textContent || '').replace(/[：:]/g, '').replace('分類', '').replace('頁數', '').trim())
    .filter(Boolean)
    .map(m => scheme('explore', { name: m, word: m }))
  const tags = [...document.querySelectorAll('.addtags a.tagshow')].map(el => {
    const tagName = (el.textContent || '').trim()
    return tagName ? scheme('explore', { name: tagName, tag: tagName }) : null
  }).filter(Boolean)
  const galleryUrl = link.replace('photos-index', 'photos-gallery')
  const galleryText = await fetch(galleryUrl).then(v => v.text())
  const regex = RegExp(String.raw`//[^\"]+/[^\"]+\.[^\"]+`, 'g')
  const matches = Array.from(galleryText.matchAll(regex))
  const gallery = matches.map((e) => 'https:' + e[0].substring(0, e[0].length - 1))
  return {
    word: [...metaInfo, ...tags],
    card: gallery.length > 0 ? [{ data: gallery }] : []
  }
}