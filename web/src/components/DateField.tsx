import { useEffect, useId, useRef, useState } from 'react'

/**
 * Campo de data em `dd/mm/aaaa`, o formato que o operador escreve.
 *
 * **Existe porque `input type="date"` nao deixa escolher o formato.** O Chrome
 * o desenha no idioma da INTERFACE DO NAVEGADOR, e nao no `lang` do documento —
 * medido em 18/09/2026 na maquina do operador, que exibia `mm/dd/yyyy` com
 * `lang="pt-BR"` ja declarado em `web/index.html`. Num painel de desembaraco
 * aduaneiro, `03/09` e `09/03` sao datas diferentes e igualmente plausiveis: o
 * formato nao e preferencia, e sim leitura correta.
 *
 * **O calendario nativo nao foi perdido**: ele vive num `input type="date"`
 * fora de alcance, que o botao ao lado abre por `showPicker()`. Trocar o campo
 * por texto puro custaria ao operador o gesto que ele ja usa.
 *
 * **O valor que entra e sai e SEMPRE `AAAA-MM-DD`** — o mesmo que a URL e a API
 * carregam. A traducao vive aqui e em nenhum outro lugar; quem chama nunca ve
 * `dd/mm/aaaa`.
 */

/** `AAAA-MM-DD` → `dd/mm/aaaa`. Vazio continua vazio. */
export function isoToBr(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (partes === null) return ''
  return `${partes[3]}/${partes[2]}/${partes[1]}`
}

/**
 * `dd/mm/aaaa` → `AAAA-MM-DD`, ou vazio quando a data nao existe.
 *
 * O calendario e conferido de verdade: `31/02/2026` nao vira `02/03/2026`, que
 * e o que a normalizacao do `Date` faria (regra inviolavel 3 — data inventada e
 * pior que buraco visivel).
 */
export function brToIso(texto: string): string {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto)
  if (partes === null) return ''

  const [dia, mes, ano] = [Number(partes[1]), Number(partes[2]), Number(partes[3])]
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return ''
  }
  return `${partes[3]}-${partes[2]}-${partes[1]}`
}

/** Deixa so digitos e insere as barras conforme o operador digita. */
function mascarar(bruto: string): string {
  const digitos = bruto.replace(/\D/g, '').slice(0, 8)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
}

interface DateFieldProps {
  label: string
  /** `AAAA-MM-DD`, ou vazio. */
  value: string
  /** Recebe `AAAA-MM-DD`, ou vazio quando o campo e limpo. */
  onValue: (iso: string) => void
  className?: string
}

export function DateField({ label, value, onValue, className = '' }: DateFieldProps) {
  const id = useId()
  const [texto, setTexto] = useState(() => isoToBr(value))
  const nativo = useRef<HTMLInputElement>(null)

  /*
    O valor de fora vence, mas so quando MUDA de fato. Sem a comparacao, cada
    re-render devolveria o campo ao valor confirmado e apagaria o que o operador
    esta digitando — os tres primeiros digitos de `01/0` nao formam data, e a
    URL ainda nao os tem.
  */
  useEffect(() => {
    setTexto((atual) => (brToIso(atual) === value ? atual : isoToBr(value)))
  }, [value])

  function digitar(bruto: string): void {
    const mascarado = mascarar(bruto)
    setTexto(mascarado)

    if (mascarado === '') {
      onValue('')
      return
    }
    const iso = brToIso(mascarado)
    if (iso !== '') onValue(iso)
  }

  const incompleto = texto !== '' && brToIso(texto) === ''

  return (
    <div className={`flex flex-col gap-1 text-xs text-text-secondary ${className}`}>
      <label htmlFor={id}>{label}</label>

      <div className="flex items-center gap-1">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          aria-invalid={incompleto}
          value={texto}
          onChange={(event) => digitar(event.target.value)}
          className="w-28 rounded-control border border-border-control bg-surface-raised px-2 py-1 font-mono text-sm text-text-primary"
        />

        {/*
          O campo nativo fica FORA de alcance — `tabIndex={-1}` e `aria-hidden`
          —, mas continua renderizado: `showPicker()` recusa elemento que o
          navegador nao desenha. Ele nunca e lido nem focado; quem responde pelo
          valor e o campo de texto acima.
        */}
        <input
          ref={nativo}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          onChange={(event) => {
            setTexto(isoToBr(event.target.value))
            onValue(event.target.value)
          }}
          className="pointer-events-none absolute h-px w-px opacity-0"
        />

        <button
          type="button"
          aria-label={`Abrir o calendário — ${label}`}
          onClick={() => nativo.current?.showPicker()}
          className="motion-tint rounded-control border border-border-control px-2 py-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>
      </div>

      {incompleto && <span className="text-state-warning-fg">Data incompleta ou inexistente.</span>}
    </div>
  )
}
