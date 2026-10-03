export const { parseHTML } = await import('https://gcore.jsdelivr.net/npm/linkedom/worker.min.js');

export const meta = {
  code: 'bakamh.com',
  base: 'bakamh.com',
  name: '巴卡漫画',
  host: ['bakamh.com'],
  word: ['漫画', '中文漫画', '韩漫', 'BL'],
}

export const routes = [
  {
    key: 'list',
    path: '/manga/',
    paging: { pageKey: 'page' },
    defaults: { m_orderby: 'latest' },
  },
  {
    key: 'search',
    match: 'word',
    path: '/',
    paging: { pageKey: 'page' },
    paramMap: { word: 's' },
    defaults: { post_type: 'wp-manga' },
  },
]

const abs = (value, base) => {
  if (!value) return ''
  try { return new URL(value, base).href } catch (_) { return value }
}

const cleanImage = (img, base) => {
  if (!img) return ''
  const src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || img.getAttribute('src') || ''
  return abs(src.trim(), base)
}

export const entryMeta = async () => [
  { mode: 'radio', name: '最近更新', code: 'm_orderby=latest' },
  { mode: 'radio', name: '最新发布', code: 'm_orderby=new-manga' },
  { mode: 'radio', name: '最多浏览', code: 'm_orderby=trending' },
  { mode: 'radio', name: '评分', code: 'm_orderby=rating' },
]

export const entryList = async ({ url, code }) => {
  console.info('[Bakamh] fetch list:', url)
  const { document } = await fetch(url, { headers: { 'accept-language': 'zh-CN,zh;q=0.9', 'referer': 'https://bakamh.com/' } }).then(v => v.text()).then(parseHTML)
  const nodes = [...document.querySelectorAll('.c-tabs-item__content'), ...document.querySelectorAll('.row.c-tabs-item__content')]
  const unique = new Map()
  for (const el of nodes) {
    const a = el.querySelector('.post-title a') || el.querySelector('.tab-thumb a') || el.querySelector('a[href*="/manga/"]')
    if (!a) continue
    const link = abs(a.getAttribute('href'), url)
    if (!link || !link.includes('/manga/')) continue
    const name = (el.querySelector('.post-title a')?.textContent || a.getAttribute('title') || '').trim()
    if (!name) continue
    const img = el.querySelector('.tab-thumb img, img')
    const cove = cleanImage(img, url)
    unique.set(link, { mode: 'comic', code: hash(`${code}:${link}`), link, cove, name, cardAction: scheme('call', { method: 'entryPost', link }) })
  }
  return [...unique.values()]
}

export const entryPost = async ({ link, url }) => {
  const target = link || url
  console.info('[Bakamh] fetch manga:', target)
  const { document } = await fetch(target, { headers: { 'accept-language': 'zh-CN,zh;q=0.9', 'referer': 'https://bakamh.com/' } }).then(v => v.text()).then(parseHTML)
  const title = document.querySelector('.post-title h1')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || ''
  const tags = [...document.querySelectorAll('.genres-content a, .tags-content a, .post-content_item .summary-content a')].map(a => a.textContent?.trim()).filter(Boolean).slice(0, 20).map(name => scheme('explore', { name, word: name }))
  const chapterAnchors = [...document.querySelectorAll('.wp-manga-chapter a'), ...document.querySelectorAll('.listing-chapters_wrap a[href]')]
  const seen = new Set()
  const chapters = []
  for (const a of chapterAnchors) {
    const chapterUrl = abs(a.getAttribute('href'), target)
    if (!chapterUrl || seen.has(chapterUrl)) continue
    seen.add(chapterUrl)
    const chapterName = (a.textContent || '').replace(/\s+/g, ' ').trim()
    const rowText = (a.closest('li')?.textContent || chapterName).replace(/\s+/g, ' ').trim()
    const locked = /需登录|🔒|解锁/.test(rowText)
    chapters.push({ name: locked ? `🔒 ${chapterName}` : chapterName, link: chapterUrl, locked })
  }
  chapters.reverse()
  const card = chapters.map(ch => ({ name: ch.name, cardAction: scheme('call', { method: 'entryChapter', link: ch.link, name: ch.name }) }))
  return { word: tags, card, title }
}

export const entryChapter = async ({ link, name }) => {
  console.info('[Bakamh] fetch chapter:', link)
  const response = await fetch(link, { headers: { 'accept-language': 'zh-CN,zh;q=0.9', 'referer': link }, redirect: 'follow' })
  const html = await response.text()
  if (/需登录|请登录|登录后|login/i.test(html) && !/reading-content|page-break|chapter-video-frame/.test(html)) {
    return { card: [{ name: `${name || '本章'}：需要登录`, data: [] }] }
  }
  const { document } = parseHTML(html)
  const imageNodes = [...document.querySelectorAll('.reading-content img'), ...document.querySelectorAll('.page-break img')]
  const images = []
  const seen = new Set()
  for (const img of imageNodes) {
    const src = cleanImage(img, link)
    if (!src || seen.has(src)) continue
    if (/logo|avatar|emoji|icon/i.test(src)) continue
    seen.add(src)
    images.push(src)
  }
  return { card: images.length ? [{ name: name || '阅读', data: images, headers: { referer: link } }] : [] }
}
