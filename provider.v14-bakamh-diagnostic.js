export const { parseHTML } = await import('https://gcore.jsdelivr.net/npm/linkedom/worker.min.js');

export const meta = {
  code: 'wnacg-v9-test',
  base: 'bakamh.com',
  name: 'V14 巴卡请求诊断',
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

export const entryList = async ({ code }) => {
  let diag = 'BAKA UNKNOWN'
  try {
    const endpoint = 'https://bakamh.com/wp-admin/admin-ajax.php'
    const body = [
      'action=madara_load_more',
      'page=0',
      'template=' + encodeURIComponent('madara-core/content/content-archive'),
      'vars%5Bpaged%5D=1',
      'vars%5Btemplate%5D=archive',
      'vars%5Bposts_per_page%5D=25',
      'vars%5Bpost_type%5D=wp-manga',
      'vars%5Bpost_status%5D=publish',
      'vars%5Bmanga_archives_item_layout%5D=big_thumbnail',
      'vars%5Borderby%5D=meta_value_num',
      'vars%5Bmeta_key%5D=_latest_update',
      'vars%5Border%5D=DESC'
    ].join('&')

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://bakamh.com/',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
      },
      body
    })
    const html = await res.text()
    const { document } = parseHTML(html)
    const count = document.querySelectorAll('div.page-item-detail, .manga__item, .c-tabs-item__content').length
    const title = (document.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)
    diag = `BAKA ${res.status} LEN=${html.length} ITEMS=${count}${title ? ' TITLE=' + title : ''}`
  } catch (e) {
    diag = 'BAKA ERR=' + String(e).slice(0, 80)
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
        code: hash(`${code}:v14:${aid}`),
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