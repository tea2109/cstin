export const { parseHTML } = await import('https://gcore.jsdelivr.net/npm/linkedom/worker.min.js');

export const meta = {
  code: 'ikanwzd-v1',
  base: 'ikanwzd.cc',
  name: 'ikanwzd V1 诊断',
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
  let diag = 'IKAN UNKNOWN'
  try {
    const target = 'https://www.ikanwzd.cc/'
    const res = await fetch(target, { redirect: 'follow' })
    const html = await res.text()
    const { document: doc } = parseHTML(html)
    const title = (doc.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
    diag = `IKAN ${res.status} LEN=${html.length}${title ? ' TITLE=' + title : ''}`
  } catch (e) {
    diag = 'IKAN ERR=' + String(e).slice(0, 100)
  }

  const testUrl = 'https://wnacg.ru/albums-index-page-1.html'
  const { document } = await fetch(testUrl).then(v => v.text()).then(parseHTML)
  return [...document.querySelectorAll('.pic_box a')]
    .filter(el => el.getAttribute('href')?.includes('/photos'))
    .slice(0, 12)
    .map(el => {
      const href = el.getAttribute('href') || ''
      const aid = href.match(/aid-(\d+)/)?.[1] || href
      const fullLink = new URL(href, testUrl).href
      const imgSrc = el.querySelector('img')?.getAttribute('src')
      const fullCove = imgSrc ? new URL(imgSrc, testUrl).href : ''
      const originalName = el.getAttribute('title') || el.querySelector('img')?.getAttribute('alt') || ''
      return {
        mode: 'comic',
        code: hash(`${code}:ikan-v1:${aid}`),
        link: fullLink,
        cove: fullCove,
        name: '[' + diag + '] ' + originalName,
        cardAction: scheme('call', { method: 'entryPost', link: fullLink })
      }
    })
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