import type { SchemaDivergence } from '../../../src/domain/sheet-schema.ts'
import { describeDivergence } from '../../../src/domain/sheet-schema.ts'

/**
 * O que o cabecalho da planilha tem de diferente do esquema declarado (`H-96`).
 *
 * **A frase vem do DOMINIO**, por `describeDivergence`: a tela desenha, e nao
 * redige. Escrever a frase aqui daria duas fontes para o mesmo texto — a do
 * painel e a do que o servidor conhece —, e elas divergem no primeiro ajuste.
 *
 * **Nada aqui bloqueia nada.** A leitura segue, os processos entram, e o painel
 * nunca para (decisao do usuario em 17/09/2026). O que esta secao entrega e o
 * motivo, nomeando as duas pontas, que e o que `RF-44` exige.
 *
 * **Uma linha por MUDANCA, e nao por sintoma.** Inserir uma coluna desloca 14, e
 * o operador fez um gesto so: o dominio ja agrupa o bloco, e a contagem daqui
 * e a mesma que a lateral exibe.
 */
export function SchemaDivergences({
  divergences = [],
}: {
  divergences?: readonly SchemaDivergence[]
}) {
  /*
    **O padrao vazio nao e conveniencia, e conserto de um defeito medido.** Sem
    ele, `divergences.length` sobre `undefined` lancava `TypeError` e derrubava
    a PAGINA INTEIRA — medido em 17/09/2026, com 19 testes reprovando, entre
    eles varios sem relacao nenhuma com este painel.

    Um aviso que derruba a tela e o oposto do que `H-96` entrega: a historia
    existe para o painel nunca parar.
  */
  if (divergences.length === 0) return null

  const total = divergences.length

  return (
    <section aria-label="Diferenças no cabeçalho da planilha" className="mt-8">
      <h3 className="text-sm font-semibold text-text-primary">
        Diferenças no cabeçalho da planilha
      </h3>

      <p className="mt-2 text-sm text-text-secondary">
        {total === 1
          ? 'Uma coluna da planilha está diferente do que o painel conhece.'
          : `${total} colunas da planilha estão diferentes do que o painel conhece.`}{' '}
        O painel continua lendo e mostrando os processos — o que muda é que agora você sabe o que
        mudou.
      </p>

      {/*
        `border-border-subtle` e sem sombra: `C04` cobra a borda sutil de todo
        papel de secao que nao seja o painel modal, e `D-22` bane sombra do
        conjunto inteiro. A elevacao vem da borda e do fundo `raised`.
      */}
      <ul className="mt-2 flex flex-col gap-2 rounded-container border border-border-subtle bg-surface-raised p-4">
        {divergences.map((one) => (
          <li
            key={`${one.kind}-${one.column}-${one.expectedColumn}`}
            className="flex gap-3 text-sm"
          >
            {/*
              A faixa lateral e o canal NAO-cromatico: `A11` proibe informacao
              so por cor, e o texto ao lado ja diz tudo — a faixa marca a linha
              como aviso sem depender de ninguem enxergar a cor.
            */}
            <span aria-hidden="true" className="w-0.5 shrink-0 bg-state-warning-fg" />
            <span className="text-text-primary">{describeDivergence(one)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-sm text-text-secondary">
        Se a mudança foi proposital, a planilha e o painel precisam voltar a concordar. Se não foi,
        desfazer a alteração no Excel resolve.
      </p>
    </section>
  )
}
