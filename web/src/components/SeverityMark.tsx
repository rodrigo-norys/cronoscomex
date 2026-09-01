/**
 * A marca de severidade: faixa lateral mais icone (`H-61`, `H-62`, `D-22`).
 *
 * **Severidade e canal deixam de se distinguir por matiz.** Canal aduaneiro e
 * pilula preenchida com rotulo escrito (IND-06); severidade e faixa lateral com
 * icone. A **regra inviolavel 4** e o que esta em jogo: cor nao infere status, e
 * dois sistemas que so diferem no tom convidam exatamente essa leitura.
 *
 * **O icone se soma ao texto, nunca o substitui.** `SC 1.4.1` e o `ACHADO 18`:
 * a informacao de gravidade nao pode depender de enxergar um desenho, e por isso
 * quem chama continua escrevendo o que aconteceu.
 *
 * SVG inline, e nao biblioteca de icones — o plano nao preve a dependencia.
 * `currentColor` faz o traco sobreviver a `forced-colors: active`, onde o agente
 * de usuario descarta a paleta do autor.
 *
 * Existe como componente porque o padrao aparece em **seis** lugares: a fila de
 * alertas, o painel de ingestao, e os quatro paineis de erro de formulario.
 * Copiar doze linhas de `path` seis vezes garante que a sexta divirja.
 */

export type SeverityTone = 'error' | 'warning'

/** A faixa lateral, por tom. `forced-colors:border-l-4` porque sob o modo
 * forcado a COR da faixa e substituida, e so a espessura sobrevive. */
const BAND: Readonly<Record<SeverityTone, string>> = {
  error: 'border-l-4 border-l-state-error-fg forced-colors:border-l-4',
  warning: 'border-l-4 border-l-state-warning-fg forced-colors:border-l-4',
}

export function severityBand(tone: SeverityTone): string {
  return BAND[tone]
}

/**
 * O icone, decorativo por construcao: `aria-hidden`, porque quem carrega a
 * informacao e o texto ao lado.
 */
export function SeverityIcon({ tone }: { tone: SeverityTone }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="mt-0.5 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      {tone === 'error' ? (
        // Triangulo de atencao: contorno fechado, legivel a 16 px.
        <>
          <path d="M8 2.5 14.5 13.5h-13z" strokeLinejoin="round" />
          <path d="M8 6.5v3.5" />
          <circle cx="8" cy="11.75" r="0.6" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5.5v3.5" />
          <circle cx="8" cy="11" r="0.6" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  )
}
