import { useForestStore } from './game/store'
import { useT } from './i18n'
import { latestCatchChoice } from './game/expansion'

export function FishingHud() {
  const t = useT()
  const f = useForestStore(s => s.fishing)
  const interact = useForestStore(s => s.interact)
  const cancel = useForestStore(s => s.cancelFishing)
  const reel = useForestStore(s => s.reel)
  const keep = useForestStore(s => s.keepCatch)
  const release = useForestStore(s => s.releaseCatch)
  const choice = useForestStore(latestCatchChoice)
  const tankFull = useForestStore(s => s.homeBook.fish.length >= 5)
  if (!f) return null
  // The catch result appears here once; the notice line stays empty for it.
  const title = f.paused ? t('fishing.paused') : f.phase === 'caught' ? t('fishing.caught', { size: f.sizeCm, name: t(`fish.${f.species}`) }) : f.phase === 'escaped' ? (f.reason ? t(`fishing.${f.reason}`) : '') : t(`fishing.${f.phase}`)
  const tense = f.tension > .72
  return <section className={`paper-card fishing-hud${f.phase === 'bite' ? ' urgent' : ''}`} aria-label={t('fishing.label')}>
    <strong role="status">{title}</strong>
    {f.phase === 'reeling' && !f.paused && <>
      <label>{t('fishing.progress')} <progress aria-label={t('fishing.progressLabel')} value={f.progress} max={1} /></label>
      <label>{t('fishing.tension')} <meter aria-label={t('fishing.tensionLabel')} value={f.tension} min={0} max={1} low={.3} high={.75} optimum={.4} /></label>
      <button type="button" className={tense ? 'warn' : undefined} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); reel(true) }} onPointerUp={() => reel(false)} onPointerCancel={() => reel(false)} onLostPointerCapture={() => reel(false)}>
        {tense ? <>{t('fishing.release')} <kbd>Space</kbd></> : <>{t('fishing.hold')} <kbd>Space</kbd> {t('fishing.reelAction')}</>}
      </button>
    </>}
    {f.phase === 'caught' && (choice ? <small role="status">{t(choice === 'kept' ? 'fishing.kept' : 'fishing.released')}</small> : <>
      <button type="button" disabled={tankFull} onClick={keep}>{tankFull ? t('fishing.tankFull') : t('fishing.keep')}</button>
      <button type="button" onClick={release}>{t(f.site==='sea'?'fishing.letGoSea':'fishing.letGo')}</button>
    </>)}
    {(f.paused || ['bite', 'caught', 'escaped'].includes(f.phase)) && <button type="button" className="primary" onClick={interact}><kbd>F</kbd>{f.paused ? t('fishing.resume') : f.phase === 'bite' ? t('fishing.strike') : t('fishing.again')}</button>}
    <button type="button" className="quiet" onClick={cancel}><kbd>Esc</kbd>{t('fishing.stow')}</button>
  </section>
}
