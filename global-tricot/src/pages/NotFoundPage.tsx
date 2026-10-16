import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { LinkButton } from '../components/ui/Button'
import { EmptyState } from '../components/ui/Feedback'

export default function NotFoundPage() {
  useDocumentMeta({ title: 'Página não encontrada | Global Tricot', noindex: true })
  return (
    <div className="shell py-20">
      <EmptyState
        title="Página não encontrada"
        action={
          <>
            <LinkButton to="/catalogo">Ver catálogo</LinkButton>
            <LinkButton to="/" variant="secondary">Ir para o início</LinkButton>
          </>
        }
      >
        O endereço pode ter mudado ou a peça deixou de ser vendida. Veja o catálogo para encontrar o que procura.
      </EmptyState>
    </div>
  )
}
