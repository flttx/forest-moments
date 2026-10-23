import { useForestStore } from './game/store'

export function FishingHud() {
  const f = useForestStore(s => s.fishing)
  const interact = useForestStore(s => s.interact)
  const cancel = useForestStore(s => s.cancelFishing)
  const reel = useForestStore(s => s.reel)
  if (!f) return null
  const title = f.paused ? '已暂停 · 回来继续钓鱼' : {
    casting: '正在抛竿', waiting: '静候浮漂下沉', bite: '咬钩了！现在提竿', reeling: '慢慢收线，留意张力', landing: '鱼儿出水了', caught: `${f.sizeCm} cm 锦鲤`, escaped: f.reason,
  }[f.phase]
  return <section className="fishing-hud" aria-label="钓鱼操作">
    <strong role="status">{title}</strong>
    {f.phase === 'reeling' && !f.paused && <>
      <label>收线进度 <progress aria-label="收线进度" value={f.progress} max={1} /></label>
      <label>鱼线张力 <meter aria-label="鱼线张力" value={f.tension} min={0} max={1} low={.3} high={.75} optimum={.4} /></label>
      <small>{f.tension > .72 ? '张力较高，松开空格让鱼线放松。' : '按住空格收线；松开可降低张力。'}</small>
      <button type="button" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); reel(true) }} onPointerUp={() => reel(false)} onPointerCancel={() => reel(false)} onLostPointerCapture={() => reel(false)}>按住收线 <kbd>Space</kbd></button>
    </>}
    {(f.paused || ['bite', 'caught', 'escaped'].includes(f.phase)) && <button type="button" onClick={interact}>{f.paused ? '继续钓鱼' : f.phase === 'bite' ? '提竿' : '再抛一竿'} <kbd>F</kbd></button>}
    {f.phase === 'waiting' && !f.paused && <small>浮漂明显下沉时按 F 提竿；提得太早或太迟都会错过。</small>}
    <button type="button" className="quiet" onClick={cancel}>收起钓具 <kbd>Esc</kbd></button>
  </section>
}

export function FishBook() {
  const book = useForestStore(s => s.fishBook)
  return <details className="fish-book">
    <summary>鱼簿 · {book.count} 尾</summary>
    {book.count ? <><p>锦鲤 · 最大 {book.bestCm} cm</p><ol>{book.recent.slice(0, 5).map((fish, i) => <li key={`${fish.at}-${i}`}>{fish.sizeCm} cm · {new Date(fish.at).toLocaleDateString('zh-CN')}</li>)}</ol></> : <p>池塘西岸可以钓到锦鲤。钓获后会记录在这里。</p>}
  </details>
}
