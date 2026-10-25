import { useForestStore } from './game/store'

export function FishingHud() {
  const f = useForestStore(s => s.fishing)
  const interact = useForestStore(s => s.interact)
  const cancel = useForestStore(s => s.cancelFishing)
  const reel = useForestStore(s => s.reel)
  if (!f) return null
  // The catch result appears here once; the notice line stays empty for it.
  const title = f.paused ? '已暂停' : {
    casting: '正在抛竿…', waiting: '等待咬钩', bite: '咬钩了！', reeling: '收线中', landing: '鱼儿出水了', caught: `钓到 ${f.sizeCm} cm 锦鲤`, escaped: f.reason,
  }[f.phase]
  const tense = f.tension > .72
  return <section className={`paper-card fishing-hud${f.phase === 'bite' ? ' urgent' : ''}`} aria-label="钓鱼">
    <strong role="status">{title}</strong>
    {f.phase === 'reeling' && !f.paused && <>
      <label>进度 <progress aria-label="收线进度" value={f.progress} max={1} /></label>
      <label>张力 <meter aria-label="鱼线张力" value={f.tension} min={0} max={1} low={.3} high={.75} optimum={.4} /></label>
      <button type="button" className={tense ? 'warn' : undefined} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); reel(true) }} onPointerUp={() => reel(false)} onPointerCancel={() => reel(false)} onLostPointerCapture={() => reel(false)}>
        {tense ? <>松开 <kbd>Space</kbd></> : <>按住 <kbd>Space</kbd> 收线</>}
      </button>
    </>}
    {(f.paused || ['bite', 'caught', 'escaped'].includes(f.phase)) && <button type="button" className="primary" onClick={interact}><kbd>F</kbd>{f.paused ? '继续' : f.phase === 'bite' ? '提竿' : '再抛一竿'}</button>}
    <button type="button" className="quiet" onClick={cancel}><kbd>Esc</kbd>收起</button>
  </section>
}
