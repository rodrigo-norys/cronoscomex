import type { PageDefinition } from '../router.ts'

/**
 * Buraco visivel, nunca `TODO` escondido — a mesma regra que vale para o dado
 * (regra inviolavel 3) vale para a interface. A casca hospeda as sete paginas
 * desde ja; cada historia de `H-16` a `H-22` troca um destes marcadores por
 * conteudo, e o que ainda nao existe **diz** que nao existe.
 */
// `processRef` e nao `ref`: `ref` e prop reservada do React, e o placeholder
// nao vale um encontro com essa regra.
export function PendingPage({
  page,
  processRef,
}: {
  page: PageDefinition
  processRef?: string | null
}) {
  return (
    <section className="rounded border border-dashed border-slate-300 bg-slate-50 p-8">
      <h2 className="text-lg font-semibold text-slate-700">{page.label}</h2>
      <p className="mt-2 text-sm text-slate-600">
        Página ainda não implementada. Ela chega em <strong>{page.story}</strong>.
      </p>
      {processRef ? (
        <p className="mt-2 font-mono text-sm text-slate-500">REF: {processRef}</p>
      ) : null}
    </section>
  )
}

export function NotFoundPage() {
  return (
    <section className="rounded border border-slate-300 bg-white p-8">
      <h2 className="text-lg font-semibold text-slate-700">Página não encontrada</h2>
      <p className="mt-2 text-sm text-slate-600">
        O endereço digitado não corresponde a nenhuma página do painel.
      </p>
    </section>
  )
}
