export const { parseHTML } = await import('https://gcore.jsdelivr.net/npm/linkedom/worker.min.js');

export const meta = {
  code: 'bakamh.com',
  base: 'bakamh.com',
  name: '巴卡漫画',
  host: ['bakamh.com'],
  word: ['漫画', '中文漫画', '韩漫', 'BL', 'GL'],
}

export const routes = [
  { key: 'list', type: 'template', pattern: '/manga/page/{page}/' },
  {
    key: 'search',
    match: 'word',
    type: 'template',
    pattern: '/page/{page}/?s={word}&post_type=wp-manga',
  },
]

const abs = (v, base) => {
  if (!v) return ''
  try { return new URL(v, base).href } catch (_) { return v }
}

const imgUrl = (img, base) => abs(
  img?.getAttribute('data-src') ||
  img?.getAttribute('data-lazy-src') ||
  img?.getAttribute('data-original') ||
  img?.getAttribute('src') || '', base
)

export const entryMeta = async () => [
  { mode: 'radio', name: '韩漫', code: 'section=manhwa' },
]

export const entryList = async ({ code, url }) => {
  console.info('[Bakamh] list:', url)
  const { document } = await fetch(url, {
    headers: { 'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7' }
  }).then(v => v.text()).then(parseHTML)

  return [...document.querySelectorAll('#loop-content > div')]
    .map(el => {
      const a = el.querySelector('h3 a, .post-title a, a[href*="/manga/"]')
      if (!a) return null
      const link = abs(a.getAttribute('href'), url)
      const name = (a.textContent || a.getAttribute('title') || '').trim()
      if (!link || !name) return null
      const cover = imgUrl(el.querySelector('img.img-responsive, img'), url)
      return {
        mode: 'comic',
        code: hash(`${code}:${link}`),
        link,
        cove: cover,
        name,
        cardAction: scheme('call', { method: 'entryPost', link }),
      }
    })
    .filter(Boolean)
}

export const entryPost = async ({ link }) => {
  console.info('[Bakamh] detail:', link)
  const { document } = await fetch(link, {
    headers: { 'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7' }
  }).then(v => v.text()).then(parseHTML)

  const tags = [...document.querySelectorAll('.genres-content a, .tags-content a')]
    .map(a => (a.textContent || '').trim())
    .filter(Boolean)
    .map(name => scheme('explore', { name, word: name }))

  const chapters = [...document.querySelectorAll('.listing-chapters_main a, .chapter-loveYou a')]
    .map(a => {
      const chapterUrl = a.getAttribute('chapter-data-url') || a.getAttribute('data-url') || a.getAttribute('href')
      const full = abs(chapterUrl, link)
      const name = (a.textContent || '').replace(/\s+/g, ' ').trim()
      if (!full || !name) return null
      return { name, url: full }
    })
    .filter(Boolean)
    .reverse()

  return {
    word: tags,
    card: chapters.map(ch => ({
      name: ch.name,
      cardAction: scheme('call', { method: 'entryChapter', url: ch.url }),
    }))
  }
}

export const entryChapter = async ({ url }) => {
  console.info('[Bakamh] chapter:', url)
  const { document } = await fetch(url, {
    headers: {
      'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'referer': url,
    }
  }).then(v => v.text()).then(parseHTML)

  const images = [...document.querySelectorAll('.reading-content .wp-manga-chapter-img')]
    .map(img => abs(
      img.getAttribute('data-src') ||
      img.getAttribute('data-manga-src') ||
      img.getAttribute('src') || '', url
    ))
    .filter(Boolean)

  return { card: images.length ? [{ data: images, headers: { referer: url } }] : [] }
}
