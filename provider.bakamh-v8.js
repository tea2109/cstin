export const { parseHTML } = await import('https://gcore.jsdelivr.net/npm/linkedom/worker.min.js');

export const meta = {
  code: 'bakamh-v8',
  base: 'bakamh.com',
  name: '巴卡漫画 V8',
  host: ['bakamh.com'],
  word: ['漫画', '中文']
}

// Agent: 根据 Wnacg 官网 HTML 源码精准对齐生成的声明式数组路由规则 喵🐾
export const routes = [
  {
    key: 'list',
    type: 'template',
    pattern: '/manga/',
  }
]

export const entryMeta = async () => [
  { mode: 'radio', name: '漫画', code: 'list=all' }
]

export const entryList = async ({ code, url }) => {
  const headers = {
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://bakamh.com/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
  }
  const { document } = await fetch('https://bakamh.com/manga/', { headers }).then(v => v.text()).then(parseHTML)
  const nodes = [...document.querySelectorAll('.page-item-detail, .c-tabs-item__content')]
  return nodes.map(el => {
    const a = el.querySelector('.post-title a, h3 a, a[href*="/manga/"]')
    if (!a) return null
    const href = a.getAttribute('href') || ''
    if (!href) return null
    const link = new URL(href, 'https://bakamh.com/').href
    const img = el.querySelector('.item-thumb img, .tab-thumb img, img')
    const src = img?.getAttribute('data-src') || img?.getAttribute('data-lazy-src') || img?.getAttribute('src') || ''
    return {
      mode: 'comic',
      code: hash(`${code}:${link}`),
      link,
      cove: src ? new URL(src, 'https://bakamh.com/').href : '',
      name: a.getAttribute('title') || a.textContent?.trim() || img?.getAttribute('alt') || '',
      cardAction: scheme('call', { method: 'entryPost', link })
    }
  }).filter(v => v && v.name)
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