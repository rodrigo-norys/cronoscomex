import { PAGE_LIVE_REGION_ID, PAGE_LIVE_STATUS_ID } from '../../src/components/PageAlert.tsx'

/**
 * As duas regiões vivas da casca, para as suítes que montam uma página sozinha.
 *
 * `H-44` fez as sete páginas anunciarem por portal, no nó que `H-43` deixou na
 * casca — é a única forma de o nó sobreviver ao `return` antecipado do estado de
 * erro, e o anúncio depende justamente disso. Renderizada isolada, a página não
 * tem casca em volta, e o portal não encontra alvo.
 *
 * Montar as regiões no teste não é contornar a ausência: é reproduzir o
 * ambiente real, onde a página **sempre** vive dentro da casca. Sem isto cada
 * suíte de página verificaria uma árvore que não existe em execução.
 *
 * `App.test.tsx` **não** usa este suporte — lá a casca monta as regiões de
 * verdade, e duplicá-las quebraria as consultas por papel.
 */
export function mountLiveRegions(): void {
  for (const [id, role] of [
    [PAGE_LIVE_REGION_ID, 'alert'],
    [PAGE_LIVE_STATUS_ID, 'status'],
  ] as const) {
    const region = document.createElement('div')
    region.id = id
    region.setAttribute('role', role)
    document.body.appendChild(region)
  }
}

export function unmountLiveRegions(): void {
  for (const id of [PAGE_LIVE_REGION_ID, PAGE_LIVE_STATUS_ID]) {
    document.getElementById(id)?.remove()
  }
}

/**
 * A região viva que **já recebeu texto**.
 *
 * `H-43` e `H-44` puseram as regiões no DOM desde a montagem — é a condição do
 * anúncio. Esperar por "existe algum `role=alert`" passou a resolver no primeiro
 * render, antes de a mensagem chegar; o que se espera é o conteúdo.
 */
export async function findLiveRegion(role: 'alert' | 'status'): Promise<HTMLElement> {
  const { waitFor } = await import('@testing-library/react')
  const id = role === 'alert' ? PAGE_LIVE_REGION_ID : PAGE_LIVE_STATUS_ID

  return waitFor(() => {
    const region = document.getElementById(id)
    if (region === null) throw new Error(`região viva ${id} não está montada`)
    if ((region.textContent ?? '').trim() === '') throw new Error('região viva ainda sem texto')
    return region
  })
}
