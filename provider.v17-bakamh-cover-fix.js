export const { parseHTML } = await import('https://gcore.jsdelivr.net/npm/linkedom/worker.min.js');

export const meta = {
  code: 'wnacg-v9-test',
  base: 'bakamh.com',
  name: 'V17 封面修复',
  host: ['bakamh.com'],
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

export const entryList = async ({ code, page = 1 }) => {
  const base = 'https://bakamh.com'
  const pageNum = Number(page || 1)
  const candidates = [
    `${base}/manga/page/${pageNum}/`,
    `${base}/manga/?page=${pageNum}`,
    `${base}/manga/`
  ]

  let document = null
  let usedUrl = ''

  for (const target of candidates) {
    try {
      const parsed = await dio(target, { pipe: ['webview', 'cookies'] }).then(parseHTML)
      const doc = parsed?.document
      if (!doc) continue

      const count = doc.querySelectorAll(
        'div.page-item-detail, .manga__item, .c-tabs-item__content, .row.c-tabs-item__content, article, .item-summary'
      ).length

      if (count > 0 || target.endsWith('/manga/')) {
        document = doc
        usedUrl = target
        break
      }
    } catch (_) {}
  }

  if (!document) return []

  const selectors = [
    'div.page-item-detail',
    '.manga__item',
    '.c-tabs-item__content',
    '.row.c-tabs-item__content',
    'article'
  ]

  const all = []
  const seenNode = new Set()
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (!seenNode.has(el)) {
        seenNode.add(el)
        all.push(el)
      }
    }
  }

  const seenLink = new Set()
  return all.map(el => {
    const a =
      el.querySelector('.post-title a') ||
      el.querySelector('h3 a') ||
      el.querySelector('h2 a') ||
      el.querySelector('a[href*="/manga/"]')

    if (!a) return null

    const href = a.getAttribute('href') || ''
    if (!href) return null

    const link = new URL(href, usedUrl || base).href
    if (seenLink.has(link)) return null
    seenLink.add(link)

    const img =
      el.querySelector('.item-thumb img') ||
      el.querySelector('.tab-thumb img') ||
      el.querySelector('.summary_image img') ||
      el.querySelector('img')

    const srcset = img?.getAttribute('srcset') || ''
    const srcsetUrl = srcset
      ? srcset.split(',')
          .map(v => v.trim().split(/\\s+/, 1)[0])
          .filter(Boolean)
          .pop() || ''
      : ''

    const src =
      img?.getAttribute('data-src') ||
      img?.getAttribute('data-lazy-src') ||
      img?.getAttribute('data-lzl-src') ||
      img?.getAttribute('data-cfsrc') ||
      img?.getAttribute('data-manga-src') ||
      img?.getAttribute('data-original') ||
      srcsetUrl ||
      img?.getAttribute('src') || ''

    const name =
      a.getAttribute('title') ||
      el.querySelector('.post-title')?.textContent?.trim() ||
      el.querySelector('h3')?.textContent?.trim() ||
      el.querySelector('h2')?.textContent?.trim() ||
      a.textContent?.trim() ||
      img?.getAttribute('alt') || ''

    if (!name) return null

    return {
      mode: 'comic',
      code: hash(`${code}:bakamh:${link}`),
      link,
      cove: src ? new URL(src, usedUrl || base).href : '',
      name,
      cardAction: scheme('call', { method: 'entryPost', link })
    }
  }).filter(Boolean)
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