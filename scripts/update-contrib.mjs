// 抓取 GitHub 的 contributions 片段，重新生成首页「贡献」区块：
//   1) 53 周 × 7 天的像素贡献图（静态 SVG，含每日 tooltip）
//   2) 当月的 Contribution activity 列表（翻译成中文）
// 用法：node site/scripts/update-contrib.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const USER = 'zhangjun005'
const HERE = dirname(fileURLToPath(import.meta.url))
const PAGE = join(HERE, '..', 'index.html')
// 这个片段同时包含日历和 contribution activity（profile 页里也是懒加载它）
const URL = `https://github.com/${USER}?action=show&controller=profiles&tab=contributions&user_id=${USER}`

const LEVELS = ['#ededed', '#c6efd5', '#86d9a8', '#3fae72', '#157f4a']
const CELL = 11
const GAP = 3
const EN_MONTHS = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
}

const res = await fetch(URL, {
  headers: {
    'user-agent': 'Mozilla/5.0 (compatible; homepage-contrib/2.0)',
    accept: 'text/html',
    'x-requested-with': 'XMLHttpRequest',
  },
})
if (!res.ok) throw new Error(`GitHub 返回 ${res.status}`)
const html = await res.text()

const strip = (s) =>
  s
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

/* ---------------- 日历 ---------------- */
const tds = [...html.matchAll(/<td[^>]*>/g)]
  .map((m) => m[0])
  .map((tag) => ({
    id: /id="([^"]+)"/.exec(tag)?.[1],
    date: /data-date="(\d{4}-\d{2}-\d{2})"/.exec(tag)?.[1],
    level: Number(/data-level="(\d)"/.exec(tag)?.[1] ?? -1),
  }))
  .filter((t) => t.date && t.level >= 0)
if (tds.length < 200) throw new Error(`日历解析失败，只找到 ${tds.length} 个格子`)

const counts = new Map()
for (const m of html.matchAll(/<tool-tip\b[^>]*for="([^"]+)"[^>]*>([\s\S]*?)<\/tool-tip>/g)) {
  const text = strip(m[2])
  const n = /no contributions/i.test(text)
    ? 0
    : Number((/^([\d,]+)\s+contribution/.exec(text)?.[1] ?? '0').replace(/,/g, ''))
  counts.set(m[1], n)
}
const dayCount = new Map()
for (const t of tds) if (t.id && counts.has(t.id)) dayCount.set(t.date, counts.get(t.id))

const total = (/([\d,]+)\s*contributions?\s*in the last year/.exec(html) ?? [])[1] ?? '—'

tds.sort((a, b) => a.date.localeCompare(b.date))
const first = new Date(tds[0].date + 'T00:00:00Z')
const offset = first.getUTCDay()
const span = Math.round((new Date(tds.at(-1).date + 'T00:00:00Z') - first) / 86400000) + 1
const cols = Math.ceil((span + offset) / 7)
const width = cols * (CELL + GAP) - GAP
const height = 7 * (CELL + GAP) - GAP

const buckets = LEVELS.map(() => [])
for (const d of tds) {
  const idx = Math.round((new Date(d.date + 'T00:00:00Z') - first) / 86400000) + offset
  const x = Math.floor(idx / 7) * (CELL + GAP)
  const y = (idx % 7) * (CELL + GAP)
  const n = dayCount.get(d.date) ?? 0
  const label = `${d.date.slice(5).replace('-', ' 月 ')} 日 · ${n} 次贡献`
  const title = n > 0 ? `<title>${label}</title>` : ''
  buckets[d.level].push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}">${title}</rect>`)
}

const svg = `<svg class="contrib__grid" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" role="img" aria-label="GitHub 过去一年 ${total} 次贡献">${buckets
  .map((rects, level) => (rects.length ? `<g fill="${LEVELS[level]}">${rects.join('')}</g>` : ''))
  .join('')}</svg>`

/* ---------------- Contribution activity ---------------- */
const region = html.slice(html.indexOf('contribution-activity-listing'))
const monthText = strip((/<h3[^>]*>[\s\S]*?color-bg-default pl-2 tmp-pr-3[^>]*>([\s\S]*?)<\/span>/.exec(region) ?? [])[1] ?? '')
const monthMatch = /([A-Za-z]+)\s+(\d{4})/.exec(monthText)
const monthLabel = monthMatch ? `${monthMatch[2]} 年 ${EN_MONTHS[monthMatch[1]] ?? '?'} 月` : ''

const shortRepo = (full) => String(full).split('/').pop()
const repoLink = (repo) =>
  `<a href="https://github.com/${USER}/${repo}" target="_blank" rel="noopener">${shortRepo(repo)}</a>`
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const monthKey = monthMatch
  ? `${monthMatch[2]}-${String(EN_MONTHS[monthMatch[1]] ?? 0).padStart(2, '0')}`
  : ''

const itemBlocks = region.split('class="TimelineItem"').slice(1)
const activityRows = []

for (const block of itemBlocks) {
  let text = strip(block)
  text = text.split(/Loading|Show more activity/)[0].trim()
  text = text.replace(/^[^A-Za-z]+/, '').trim()
  if (!text) continue

  // 仓库明细：owner/repo + 数字 + commits
  const repoStats = [...text.matchAll(/[\w.-]+\/([\w.-]+)\s+([\d,]+)\s+commits?/g)].map((m) => ({
    repo: m[1],
    n: m[2].replace(/,/g, ''),
  }))
  const repoHrefs = [...new Set([...block.matchAll(new RegExp(`href="/${USER}/([A-Za-z0-9._-]+)(?:/|")`, 'g'))].map((m) => m[1]))]

  let html2 = ''
  let m
  if ((m = /^Created ([\d,]+) commits? in ([\d,]+) repositor(?:y|ies)/.exec(text))) {
    html2 = `在 ${m[2]} 个仓库提交了 <b>${m[1]}</b> 个 commit`
  } else if ((m = /^Created ([\d,]+) repositor(?:y|ies)/.exec(text))) {
    html2 = `新建了 <b>${m[1]}</b> 个仓库`
  } else if ((m = /^Created a pull request in ([\w./-]+) that received ([\d,]+) comments?/.exec(text))) {
    html2 = `在 ${shortRepo(m[1])} 提交了 1 个 PR（收到 <b>${m[2]}</b> 条评论）`
  } else if ((m = /^Opened ([\d,]+) other pull requests? in ([\d,]+) repositor(?:y|ies)/.exec(text))) {
    const merged = /([\d,]+)\s+merged/.exec(text)?.[1]
    html2 = `另外打开了 <b>${m[1]}</b> 个 PR${merged ? `（<b>${merged}</b> 个已合并）` : ''}`
  } else if ((m = /^Opened ([\d,]+) pull requests?/.exec(text))) {
    html2 = `打开了 <b>${m[1]}</b> 个 PR`
  } else if ((m = /^Reviewed ([\d,]+) pull requests?/.exec(text))) {
    html2 = `评审了 <b>${m[1]}</b> 个 PR`
  } else if ((m = /^Opened ([\d,]+) issues?/.exec(text))) {
    html2 = `打开了 <b>${m[1]}</b> 个 issue`
  } else if ((m = /^Created ([\d,]+) releases?/.exec(text))) {
    html2 = `发布了 <b>${m[1]}</b> 个版本`
  } else {
    html2 = text
      .split(/\sThis contribution|\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/i)[0]
      .slice(0, 90)
  }

  const detail = repoStats.length
    ? repoStats.map((r) => `${repoLink(r.repo)} <span class="activity__num">${r.n}</span>`).join(' · ')
    : repoHrefs.slice(0, 4).map(repoLink).join(' · ')

  // 标题里已经出现过仓库名时不重复
  const single = repoHrefs.length === 1 ? shortRepo(repoHrefs[0]) : ''
  const detailHtml = single && html2.includes(single) && !repoStats.length ? '' : detail

  activityRows.push({ text: html2, detail: detailHtml })
}

/* GitHub 的 contribution activity 时间线不列 release，这里用 Releases API 把本月的发布补上 */
const GH_TOKEN = process.env.GITHUB_TOKEN
const apiHeaders = {
  accept: 'application/vnd.github+json',
  'user-agent': 'homepage-contrib/2.0',
  ...(GH_TOKEN ? { authorization: `Bearer ${GH_TOKEN}` } : {}),
}

const releaseRows = []
if (monthKey) {
  try {
    const reposRes = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100`, { headers: apiHeaders })
    if (reposRes.ok) {
      const repos = (await reposRes.json()).filter((r) => !r.fork)
      for (const repo of repos) {
        const relRes = await fetch(`https://api.github.com/repos/${repo.full_name}/releases?per_page=30`, {
          headers: apiHeaders,
        })
        if (!relRes.ok) continue
        for (const rel of await relRes.json()) {
          if (!rel.published_at || rel.published_at.slice(0, 7) !== monthKey) continue
          const d = new Date(rel.published_at)
          releaseRows.push({
            kind: 'release',
            text: `发布了 <b>${esc(rel.tag_name || rel.name)}</b>`,
            detail: `${repoLink(repo.name)} · ${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日`,
          })
        }
      }
    }
  } catch {
    /* 补不到 release 不影响主流程 */
  }
}

const rows = [...releaseRows, ...activityRows]

const activity = [
  '<div class="activity__head">',
  `  <h3 class="activity__title">最近活动<span class="activity__en">contribution activity</span></h3>`,
  `  <span class="activity__month">${monthLabel}</span>`,
  '</div>',
  '<ul class="activity__list">',
  ...rows.map(
    (r) =>
      `  <li class="activity__item"><span class="activity__dot${r.kind === 'release' ? ' activity__dot--release' : ''}" aria-hidden="true"></span><span class="activity__text">${r.text}${
        r.detail ? `<span class="activity__repos">${r.detail}</span>` : ''
      }</span></li>`
  ),
  '</ul>',
  `  <p class="activity__more">更早的活动见 <a href="https://github.com/${USER}" target="_blank" rel="noopener">github.com/${USER}</a></p>`,
].join('\n')

/* ---------------- 写回 index.html ---------------- */
const page = await readFile(PAGE, 'utf8')
const contribRe = /<!-- contrib:start -->[\s\S]*?<!-- contrib:end -->/
const activityRe = /<!-- activity:start -->[\s\S]*?<!-- activity:end -->/
if (!contribRe.test(page)) throw new Error('index.html 里找不到 contrib 标记')
if (!activityRe.test(page)) throw new Error('index.html 里找不到 activity 标记')

const contribBlock = [
  '<div class="contrib__head">',
  `  <span class="contrib__total">${total}</span>`,
  `  <span class="contrib__label">contributions in the last year · ${cols} 周 · github.com/${USER}</span>`,
  '</div>',
  svg,
  '<div class="contrib__legend" aria-hidden="true">',
  '  <span>少</span>',
  ...LEVELS.map((c) => `  <i style="background:${c}"></i>`),
  '  <span>多</span>',
  '</div>',
].join('\n')

let next = page.replace(contribRe, `<!-- contrib:start -->\n${contribBlock}\n<!-- contrib:end -->`)
next = next.replace(activityRe, `<!-- activity:start -->\n${activity}\n<!-- activity:end -->`)
await writeFile(PAGE, next, 'utf8')

console.log(
  `已更新：${tds.length} 天 / ${cols} 列 / 总计 ${total} 次贡献；本月活动 ${activityRows.length} 条 + ${releaseRows.length} 个 release（${monthLabel}）`
)
