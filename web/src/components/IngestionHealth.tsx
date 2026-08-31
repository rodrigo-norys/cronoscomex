import type { HealthResponse, QuarantineResponse } from '../api-client.ts'
import { navigate, WORKBOOK_SETUP_PAGE } from '../router.ts'

/**
 * Painel de saude da ingestao (RF-16).
 *
 * E **outra coisa** que a faixa de estado da casca: a faixa avisa que o dado
 * esta congelado — frescor —, este painel mede a leitura em si. Por isso os
 * dois coexistem, e o aviso de `degradado` continua sendo da casca (A-57).
 */

/** RNF-24. Acima disto a carga e reprovada e o mapeamento e corrigido antes de
 * prosseguir — por isso o valor e destacado, nao apenas exibido. */
const QUARANTINE_LIMIT = 0.02

interface IngestionHealthProps {
  health: HealthResponse | null
  quarantine: QuarantineResponse | null
}

export function IngestionHealth({ health, quarantine }: IngestionHealthProps) {
  if (health === null) return null

  const rate = quarantine?.quarantineRate ?? null
  const overLimit = rate !== null && rate > QUARANTINE_LIMIT

  return (
    <section
      aria-label="Saúde da ingestão"
      className="rounded border border-border-subtle bg-surface-raised p-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">Saúde da ingestão</h2>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Metric label="Linhas lidas" value={health.rowsRead.toLocaleString('pt-BR')} />
        <Metric label="Aceitas" value={health.rowsAccepted.toLocaleString('pt-BR')} />
        <Metric
          label="Em quarentena"
          value={health.rowsQuarantined.toLocaleString('pt-BR')}
          emphasis={health.rowsQuarantined > 0}
        />
        <Metric
          label="Taxa de quarentena"
          value={rate === null ? '—' : formatRate(rate)}
          emphasis={overLimit}
        />
        <Metric label="Última leitura" value={formatInstant(health.lastReadAt)} />
        <Metric
          label="Duração"
          value={health.lastReadDurationMs === null ? '—' : `${health.lastReadDurationMs} ms`}
        />
      </dl>

      {/* A regiao existe desde a montagem (`H-43`), e so o texto dentro dela
          muda: um `role="alert"` que nasce populado nao e anunciado. */}
      <p
        role="alert"
        className={
          overLimit
            ? 'mt-3 rounded border border-state-error-border bg-state-error-bg px-3 py-2 text-sm text-state-error-fg'
            : 'sr-only'
        }
      >
        {overLimit && (
          <>
            <strong className="font-semibold">Acima do limite de 2%.</strong> A carga precisa ser
            revista antes de os números serem usados: linhas não interpretadas não entram em
            indicador nenhum.
          </>
        )}
      </p>

      {/*
        O segundo dos tres caminhos ate a tela de configuracao (`H-38`). Fica
        aqui porque este painel e onde o operador ja esta olhando o estado da
        leitura — e trocar a planilha e a acao seguinte natural de quem conclui
        que esta lendo o arquivo errado.
      */}
      <p className="mt-3 text-sm text-text-secondary">
        Lendo{' '}
        <a
          href={WORKBOOK_SETUP_PAGE.path}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            navigate(WORKBOOK_SETUP_PAGE.path)
          }}
          className="underline hover:text-text-primary"
        >
          a planilha configurada
        </a>{' '}
        — clique para conferir o caminho ou apontar outro arquivo.
      </p>

      {health.rowsQuarantined > 0 && (
        <p className="mt-3 text-sm text-text-secondary">
          <a href="/api/quarantine" className="underline hover:text-text-primary">
            Ver o relatório de quarentena
          </a>{' '}
          — {health.rowsQuarantined.toLocaleString('pt-BR')}{' '}
          {health.rowsQuarantined === 1 ? 'linha não interpretada' : 'linhas não interpretadas'},
          com o motivo de cada uma.
        </p>
      )}
    </section>
  )
}

function Metric({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd
        className={`tabular-nums ${emphasis ? 'font-semibold text-state-error-fg' : 'text-text-primary'}`}
      >
        {value}
      </dd>
    </div>
  )
}

function formatRate(rate: number): string {
  return `${(rate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

function formatInstant(isoInstant: string | null): string {
  if (isoInstant === null) return 'ainda não houve'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(isoInstant),
  )
}
