export const { parseHTML } = await import('https://gcore.jsdelivr.net/npm/linkedom/worker.min.js');

export const meta = {
  code: 'bakamh.com',
  base: 'bakamh.com',
  name: '巴卡漫画 V3',
  host: ['bakamh.com'],
  word: ['R18', '本子', '漫画'],
}

// Agent: 根据 Wnacg 官网 HTML 源码精准对齐生成的声明式数组路由规则 喵🐾
export const routes = [
  {
    key: 'list',
    type: 'template',
    pattern: '/manga/page/{page}/',
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

export const entryMeta = async ({ url, host }) => {
  const { document } = await fetch(url).then(v => v.text()).then(parseHTML)
  const items = []
  items.push({ mode: 'radio', name: '最近更新', code: 'albums=index' })
  items.push({ mode: 'radio', name: '今日排行', code: 'albums=favorite_ranking&type=day' })
  items.push({ mode: 'radio', name: '本周排行', code: 'albums=favorite_ranking&type=week' })
  items.push({ mode: 'radio', name: '本月排行', code: 'albums=favorite_ranking&type=month' })
  items.push({ mode: 'radio', name: '今年排行', code: 'albums=favorite_ranking&type=year' })

  const navItems = [...document.querySelectorAll('#album_tabs > li')]
  for (const li of navItems) {
    const mainA = li.querySelector('a')
    const name = mainA?.textContent?.trim()
    const href = mainA?.getAttribute('href') || ''

    if (!name || name === '首頁' || name === '論壇' || name === '更新' || name === '排行') continue
    if (href.includes('wnbbs')) continue
    if (href.startsWith('http') && !href.includes(host)) continue

    items.push({ mode: 'line', name: name })

    const mainCate = href.match(/cate-(\d+)/)?.[1]
    if (mainCate) {
      items.push({ mode: 'radio', name: `全部${name}`, code: `cate=${mainCate}` })
    }

    const subs = li.querySelectorAll('.onemenulayout a')
    for (const sub of subs) {
      const subName = sub.textContent?.trim()
      const subHref = sub.getAttribute('href') || ''

      if (subHref.startsWith('http') && !subHref.includes(host)) continue

      const subCate = subHref.match(/cate-(\d+)/)?.[1]
      if (subCate) {
        items.push({ mode: 'radio', name: `${name}-${subName}`, code: `cate=${subCate}` })
      }
    }
  }

  return items
}

export const entryList = async ({ code, url }) => {
  console.info('[Bakamh] fetch list url:', url)
  const { document } = await fetch(url).then(v => v.text()).then(parseHTML)

  const candidates = [
    ...document.querySelectorAll('#loop-content .page-item-detail'),
    ...document.querySelectorAll('#loop-content .c-tabs-item__content'),
    ...document.querySelectorAll('#loop-content > div'),
  ]

  const seen = new Set()
  return candidates.map(el => {
    const a =
      el.querySelector('.post-title a') ||
      el.querySelector('h3 a') ||
      el.querySelector('a[href*="/manga/"]')
    if (!a) return null

    const href = a.getAttribute('href') || ''
    const fullLink = new URL(href, url).href
    if (!href || seen.has(fullLink)) return null
    seen.add(fullLink)

    const img = el.querySelector('.item-thumb img, .tab-thumb img, img')
    const src =
      img?.getAttribute('data-src') ||
      img?.getAttribute('data-lazy-src') ||
      img?.getAttribute('data-original') ||
      img?.getAttribute('src') || ''
    const fullCove = src ? new URL(src, url).href : ''

    const name =
      a.getAttribute('title') ||
      (a.textContent || '').trim() ||
      img?.getAttribute('alt') || ''

    if (!name) return null

    return {
      mode: 'comic',
      code: hash(`${code}:${fullLink}`),
      link: fullLink,
      cove: fullCove,
      name,
      cardAction: scheme('call', { method: 'entryPost', link: fullLink })
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