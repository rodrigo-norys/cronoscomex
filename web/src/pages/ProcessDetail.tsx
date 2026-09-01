import type { ProcessDetailResponse, ProcessDto } from '../api-client.ts'
import { ColorFieldsForm } from '../components/ColorFieldsForm.tsx'
import { EditProcessForm } from '../components/EditProcessForm.tsx'
import { PageAlert } from '../components/PageAlert.tsx'
import { PendingEditsPanel } from '../components/PendingEditsPanel.tsx'
import { useProcessDetail } from '../hooks/useProcessDetail.ts'

/**
 * Detalhe do processo (RF-15). **A única tela onde `statusRaw` aparece.**
 *
 * §2.1 é explícita: o texto original de STATUS é exibido aqui e em lugar nenhum
 * mais — nunca usado para agrupar ou contar. A categoria classificada fica ao
 * lado dele, para a regra aplicada ficar visível em vez de presumida.
 *
 * Os três campos fora de escopo (`boletoRaw`, `paymentRaw`, `columnPRaw`) saem
 * como texto puro e rotulados: eles existem na planilha, não alimentam nenhum
 * indicador, e escondê-los faria o operador procurá-los onde não estão.
 */

interface ProcessDetailProps {
  processRef: string
  dataVersion: number
}

const CATEGORY_LABELS: Readonly<Record<ProcessDto['statusCategory'], string>> = {
  em_andamento: 'Em andamento',
  em_desembaraco: 'Em desembaraço',
  desembaracado: 'Desembaraçado',
  fechado_aguardando_draft: 'Fechado — aguardando draft',
}

const CHANNEL_LABELS: Readonly<Record<ProcessDto['customsChannel'], string>> = {
  verde: 'Canal Verde',
  vermelho: 'Canal Vermelho',
  indefinido: 'Indefinido',
}

export function ProcessDetail({ processRef, dataVersion }: ProcessDetailProps) {
  const { state, refresh } = useProcessDetail(processRef, dataVersion)

  if (state.status === 'erro') {
    return (
      <PageAlert
        className="panel-error"
        announcement={`Não foi possível carregar o processo. ${state.message}`}
      >
        <strong className="font-semibold">Não foi possível carregar o processo.</strong>{' '}
        {state.message}
      </PageAlert>
    )
  }

  /** `404` é resposta legítima, não falha — e a tela dela é outra. */
  if (state.status === 'naoEncontrado') {
    return (
      <section
        aria-label="Processo não encontrado"
        className="rounded-container border border-border-subtle bg-surface-raised p-8"
      >
        <h2 className="text-lg font-semibold text-text-secondary">Processo não encontrado</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Nenhum processo com a REF <strong className="font-mono">{processRef}</strong> na leitura
          atual. Ele pode ter saído da planilha, ou a REF pode estar digitada de outro jeito.
        </p>
      </section>
    )
  }

  if (state.status === 'semLeitura') {
    return (
      <PageAlert
        tone="status"
        className="panel-no-read"
        announcement="Nenhuma leitura da planilha foi concluída ainda. O processo aparece assim que a primeira terminar — a ausência aqui não significa que a REF não existe."
      >
        Nenhuma leitura da planilha foi concluída ainda. O processo aparece assim que a primeira
        terminar — a ausência aqui não significa que a REF não existe.
      </PageAlert>
    )
  }

  if (state.status === 'carregando') {
    return <p className="panel-loading">Carregando processo…</p>
  }

  const { process, anomalies, statusHistory, daysInCurrentCategory, pendingEdits } = state.detail

  return (
    <div className="flex flex-col gap-4">
      <Identification process={process} />
      <EditProcessForm processRef={process.ref} onEnqueued={refresh} />
      {/* `importerOutsideRj: null` significa cor NAO reconhecida pelo mapa, e
          nao "dentro do RJ": o formulario recebe `null` e diz isso. */}
      <ColorFieldsForm
        processRef={process.ref}
        current={
          process.importerOutsideRj === null
            ? null
            : {
                responsible: process.colorResponsible,
                customsChannel: process.customsChannel,
                importerOutsideRj: process.importerOutsideRj,
              }
        }
        onEnqueued={refresh}
      />
      <PendingEditsPanel edits={pendingEdits} onChanged={refresh} />
      <StatusBlock process={process} daysInCurrentCategory={daysInCurrentCategory} />
      <Fields process={process} />
      <OutOfScope process={process} />
      <Anomalies items={anomalies} />
      <StatusHistory events={statusHistory} daysInCurrentCategory={daysInCurrentCategory} />
    </div>
  )
}

function Identification({ process }: { process: ProcessDto }) {
  return (
    <section
      aria-label="Identificação"
      className="rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="font-mono text-xl font-semibold">{process.ref}</h2>
      <p className="mt-1 text-xs text-text-muted">Linha {process.sourceRow} da planilha</p>
    </section>
  )
}

/**
 * O texto original ao lado da categoria — o critério de aceite pede os dois
 * juntos, e é a única forma de a regra aplicada ficar auditável na tela.
 */
function StatusBlock({
  process,
  daysInCurrentCategory,
}: {
  process: ProcessDto
  daysInCurrentCategory: number | null
}) {
  return (
    <section
      aria-label="Status"
      className="rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Status</h2>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Texto original (STATUS)" value={process.statusRaw} mono />
        <Field label="Categoria classificada" value={CATEGORY_LABELS[process.statusCategory]} />
        <Field
          label="Dias na categoria atual"
          value={daysInCurrentCategory === null ? '' : String(daysInCurrentCategory)}
        />
      </dl>
      <p className="mt-3 text-xs text-text-muted">
        O texto original é exibido apenas aqui: ele nunca é usado para agrupar ou contar (§2.1). A
        categoria ao lado é o resultado da classificação.
      </p>
    </section>
  )
}

function Fields({ process }: { process: ProcessDto }) {
  return (
    <section
      aria-label="Campos do processo"
      className="rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Campos</h2>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Cliente" value={process.client} />
        <Field label="Processo do cliente" value={process.clientProcess} mono />
        <Field label="Importador" value={process.importer} />
        <Field label="Agente" value={process.agent} />
        <Field label="Navio" value={process.vessel} />
        <Field label="Porto" value={process.port} />
        <Field label="Mercadoria" value={process.goods} />
        <Field label="BL" value={process.billOfLading} mono />
        <Field label="Container" value={process.container} mono />
        <Field label="ETA2" value={formatDay(process.eta2)} mono />
        <Field label="Registro (RG)" value={formatDay(process.registrationDate)} mono />
        <Field label="Docs enviados" value={formatDay(process.docsSentDate)} mono />
        <Field label="Canal" value={CHANNEL_LABELS[process.customsChannel]} />
        <Field label="Responsável" value={process.responsibleLabel} />
        <Field label="Importador fora do RJ" value={formatBoolean(process.importerOutsideRj)} />
      </dl>
    </section>
  )
}

/**
 * As três colunas que a especificação declara fora de escopo (§2). Elas são
 * lidas e exibidas, e **rotuladas**: sem o rótulo, o operador as leria como
 * insumo de indicador.
 */
function OutOfScope({ process }: { process: ProcessDto }) {
  return (
    <section
      aria-label="Campos fora de escopo"
      className="rounded-container border border-dashed border-border-subtle bg-surface-sunken p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Fora de escopo para indicadores</h2>
      <p className="mt-1 text-xs text-text-secondary">
        Exibidos como texto puro, exatamente como estão na planilha. Nenhum indicador os usa (§2).
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Coluna 13 (boleto)" value={process.boletoRaw} mono />
        <Field label="R$ enviado" value={process.paymentRaw} mono />
        <Field label="Coluna P" value={process.columnPRaw} mono />
      </dl>
    </section>
  )
}

/** A explicação vem do domínio, junto do código — nunca montada aqui. */
function Anomalies({ items }: { items: ProcessDetailResponse['anomalies'] }) {
  return (
    <section
      aria-label="Anomalias"
      className="rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Anomalias</h2>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">
          Nenhuma divergência registrada nesta linha na leitura atual.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((anomaly) => (
            <li
              key={anomaly.code}
              className="rounded-container border border-state-warning-border bg-state-warning-bg px-3 py-2 text-sm"
            >
              <strong className="font-mono text-xs text-state-warning-fg">{anomaly.code}</strong>
              <p className="text-state-warning-fg">{anomaly.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Duas ausências diferentes, e a tela precisa dizer qual.
 *
 * `daysInCurrentCategory` é o que as separa: `null` significa que o histórico
 * não conhece este processo — nenhum evento foi gravado para ele —, e um número
 * significa que conhece, e que nada mudou desde então. Sem essa distinção,
 * "nenhuma mudança" afirmaria estabilidade que ninguém mediu (regra inviolável
 * 3) exatamente no primeiro dia de uso, quando ela é falsa em 649 processos.
 *
 * A lista traz só mudanças de categoria: a primeira observação do processo e as
 * trocas de cor são gravadas e alimentam a série mensal, mas não são transições
 * que o operador possa ler como "mudou de X para Y".
 */
function StatusHistory({
  events,
  daysInCurrentCategory,
}: {
  events: ProcessDetailResponse['statusHistory']
  daysInCurrentCategory: number | null
}) {
  return (
    <section
      aria-label="Histórico de categoria"
      className="rounded-container border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Histórico de categoria</h2>

      {events.length === 0 && daysInCurrentCategory === null ? (
        <p className="mt-2 text-sm text-text-secondary">
          Nenhum evento registrado para este processo. O histórico começa quando a aplicação passa a
          acompanhar a planilha, e não há retroatividade anterior a isso (A-43) — vazio aqui{' '}
          <strong>não</strong> significa que o processo nunca mudou de categoria.
        </p>
      ) : events.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">
          Nenhuma mudança de categoria desde que o registro começou. A primeira observação do
          processo e as trocas de cor da linha não aparecem aqui.
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-1">
          {events.map((event) => (
            <li key={event.ts} className="flex gap-2 text-sm">
              <time dateTime={event.ts} className="tabular-nums text-text-muted">
                {formatTimestamp(event.ts)}
              </time>
              <span>
                {CATEGORY_LABELS[event.from]} → <strong>{CATEGORY_LABELS[event.to]}</strong>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Campo vazio vira traço, sempre — inclusive em `fechado_aguardando_draft`. */
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      {/* `tabular-nums` viaja com o mono: data e numero so se comparam entre
          linhas quando o digito tem largura fixa (`H-62`). */}
      <dd
        className={`text-sm ${mono ? 'font-mono tabular-nums' : ''} ${value === '' ? 'text-text-muted' : ''}`}
      >
        {value === '' ? '—' : value}
      </dd>
    </div>
  )
}

function formatDay(isoDay: string | null): string {
  if (isoDay === null) return ''
  const [year, month, day] = isoDay.split('-')
  return `${day}/${month}/${year}`
}

function formatTimestamp(iso: string): string {
  const [day = ''] = iso.split('T')
  return formatDay(day)
}

function formatBoolean(value: boolean | null): string {
  if (value === null) return ''
  return value ? 'Sim' : 'Não'
}
