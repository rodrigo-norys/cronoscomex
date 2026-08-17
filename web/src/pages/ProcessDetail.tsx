import type { ProcessDetailResponse, ProcessDto } from '../api-client.ts'
import { ColorFieldsForm } from '../components/ColorFieldsForm.tsx'
import { EditProcessForm } from '../components/EditProcessForm.tsx'
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
  vermelho: 'Canal Vermelho',
  nenhum: 'Nenhum',
  indefinido: 'Indefinido',
}

const RESPONSIBLE_LABELS: Readonly<Record<ProcessDto['responsible'], string>> = {
  colaborador1: 'Colaborador 1',
  colaborador2: 'Colaborador 2',
  colaborador1_outros_clientes: 'Colaborador 1 — outros clientes',
  indefinido: 'Indefinido',
}

export function ProcessDetail({ processRef, dataVersion }: ProcessDetailProps) {
  const { state, refresh } = useProcessDetail(processRef, dataVersion)

  if (state.status === 'erro') {
    return (
      <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        <strong className="font-semibold">Não foi possível carregar o processo.</strong>{' '}
        {state.message}
      </p>
    )
  }

  /** `404` é resposta legítima, não falha — e a tela dela é outra. */
  if (state.status === 'naoEncontrado') {
    return (
      <section
        aria-label="Processo não encontrado"
        className="rounded border border-slate-300 bg-white p-8"
      >
        <h2 className="text-lg font-semibold text-slate-700">Processo não encontrado</h2>
        <p className="mt-2 text-sm text-slate-600">
          Nenhum processo com a REF <strong className="font-mono">{processRef}</strong> na leitura
          atual. Ele pode ter saído da planilha, ou a REF pode estar digitada de outro jeito.
        </p>
      </section>
    )
  }

  if (state.status === 'semLeitura') {
    return (
      <p role="status" className="rounded border border-slate-300 bg-white p-4 text-sm">
        Nenhuma leitura da planilha foi concluída ainda. O processo aparece assim que a primeira
        terminar — a ausência aqui não significa que a REF não existe.
      </p>
    )
  }

  if (state.status === 'carregando') {
    return (
      <p className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Carregando processo…
      </p>
    )
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
                responsible: process.responsible,
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
    <section aria-label="Identificação" className="rounded border border-slate-200 bg-white p-4">
      <h2 className="font-mono text-xl font-semibold">{process.ref}</h2>
      <p className="mt-1 text-xs text-slate-500">Linha {process.sourceRow} da planilha</p>
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
    <section aria-label="Status" className="rounded border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Status</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Texto original (STATUS)" value={process.statusRaw} mono />
        <Field label="Categoria classificada" value={CATEGORY_LABELS[process.statusCategory]} />
        <Field
          label="Dias na categoria atual"
          value={daysInCurrentCategory === null ? '' : String(daysInCurrentCategory)}
        />
      </dl>
      <p className="mt-3 text-xs text-slate-500">
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
      className="rounded border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-slate-700">Campos</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Cliente" value={process.client} />
        <Field label="Importador" value={process.importer} />
        <Field label="Agente" value={process.agent} />
        <Field label="Navio" value={process.vessel} />
        <Field label="Porto" value={process.port} />
        <Field label="Mercadoria" value={process.goods} />
        <Field label="BL" value={process.billOfLading} mono />
        <Field label="Container" value={process.container} mono />
        <Field label="ETA2" value={formatDay(process.eta2)} />
        <Field label="Registro (RG)" value={formatDay(process.registrationDate)} />
        <Field label="Docs enviados" value={formatDay(process.docsSentDate)} />
        <Field label="Canal" value={CHANNEL_LABELS[process.customsChannel]} />
        <Field label="Responsável" value={RESPONSIBLE_LABELS[process.responsible]} />
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
      className="rounded border border-dashed border-slate-300 bg-slate-50 p-4"
    >
      <h2 className="text-sm font-semibold text-slate-700">Fora de escopo para indicadores</h2>
      <p className="mt-1 text-xs text-slate-600">
        Exibidos como texto puro, exatamente como estão na planilha. Nenhum indicador os usa (§2).
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
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
    <section aria-label="Anomalias" className="rounded border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Anomalias</h2>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          Nenhuma divergência registrada nesta linha na leitura atual.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((anomaly) => (
            <li
              key={anomaly.code}
              className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
            >
              <strong className="font-mono text-xs text-amber-900">{anomaly.code}</strong>
              <p className="text-amber-900">{anomaly.detail}</p>
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
      className="rounded border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-slate-700">Histórico de categoria</h2>

      {events.length === 0 && daysInCurrentCategory === null ? (
        <p className="mt-2 text-sm text-slate-600">
          Nenhum evento registrado para este processo. O histórico começa quando a aplicação passa a
          acompanhar a planilha, e não há retroatividade anterior a isso (A-43) — vazio aqui{' '}
          <strong>não</strong> significa que o processo nunca mudou de categoria.
        </p>
      ) : events.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          Nenhuma mudança de categoria desde que o registro começou. A primeira observação do
          processo e as trocas de cor da linha não aparecem aqui.
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-1">
          {events.map((event) => (
            <li key={event.ts} className="flex gap-2 text-sm">
              <time dateTime={event.ts} className="tabular-nums text-slate-500">
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
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-sm ${mono ? 'font-mono' : ''} ${value === '' ? 'text-slate-400' : ''}`}>
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
