import styles from '../App.module.css'
import { fmtDur } from '../lib/format'
import { ENTRY_KINDS } from '../lib/storage'
import { TimeField, ChipPicker } from './pickers'

// barra de captura persistente — o tempo é o herói; projeto + categoria já vêm dos últimos usados
export function TimerBar({
  active, elapsed, desc, projectId, categoryId, kindId, projects, categories, startStr,
  onDescChange, onProjectChange, onCategoryChange, onKindChange, onStart, onStop, onDiscard, onStartTimeChange,
}) {
  return (
    <section className={`${styles.timerBand} ${active ? styles.timerBandActive : ''}`}>
      <div className={styles.timerBandFields}>
        <input
          className={styles.timerInput}
          placeholder="O que você está trabalhando?"
          value={desc}
          onChange={e => onDescChange(e.target.value)}
        />
        <ChipPicker large value={projectId} options={projects} onChange={onProjectChange} icon="ti-folder" title="Projeto" />
        <ChipPicker large value={categoryId} options={categories} onChange={onCategoryChange} allowNone noneLabel="Sem categoria" icon="ti-tag" title="Categoria" />
        <ChipPicker large value={kindId} options={ENTRY_KINDS} onChange={onKindChange} icon="ti-layout-grid" title="Classificação" />
      </div>

      {active && (
        <div className={styles.timerStartEdit}>
          <span className={styles.timerStartLabel}><i className="ti ti-clock-edit" aria-hidden="true" />Início</span>
          <TimeField value={startStr} onChange={onStartTimeChange} />
        </div>
      )}

      <div className={styles.timerReadout}>
        {active && <span className={styles.pulseDot} aria-hidden="true" />}
        <span className={`${styles.timerDisplay} ${active ? styles.timerActive : ''}`}>{fmtDur(elapsed)}</span>
      </div>

      <div className={styles.timerBtnWrap}>
        {active && (
          <button type="button" className={styles.iconBtn} onClick={onDiscard} aria-label="Descartar timer (sem salvar)" title="Descartar (não salva entrada)">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        )}
        <button
          className={`${styles.btnPrimary} ${styles.btnTimer} ${active ? styles.btnStop : ''}`}
          onClick={active ? onStop : onStart}
          title={active ? 'Parar (Space)' : 'Iniciar (Space)'}
        >
          <i className={`ti ${active ? 'ti-player-stop' : 'ti-player-play'}`} aria-hidden="true" />
          {active ? 'Parar' : 'Iniciar'}
        </button>
        <span className={styles.kbdHint}><kbd>Space</kbd></span>
      </div>
    </section>
  )
}
