import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageManager, type ImageItem } from './ImageManager'

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

function Harness({ initial = [] as ImageItem[] }) {
  const [items, setItems] = useState(initial)
  return (
    <>
      <ImageManager items={items} onChange={setItems} colors={['Rosa']} />
      <output data-testid="state">{JSON.stringify(items.map((i) => ({ main: i.is_main, name: i.file?.name ?? i.id })))}</output>
    </>
  )
}
const state = () => JSON.parse(screen.getByTestId('state').textContent as string)
const file = (name: string, type: string, size = 1000) => new File([new Uint8Array(size)], name, { type })

describe('gerenciador de imagens', () => {
  it('aceita imagens válidas e define a primeira como principal', async () => {
    render(<Harness />)
    await userEvent.setup().upload(screen.getByLabelText(/Adicionar fotos/), [file('a.jpg', 'image/jpeg'), file('b.png', 'image/png')])
    expect(state()).toEqual([{ main: true, name: 'a.jpg' }, { main: false, name: 'b.png' }])
  })
  it('rejeita tipo inválido e arquivo gigante, informando o motivo', async () => {
    render(<Harness />)
    await userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText(/Adicionar fotos/), [file('doc.pdf', 'application/pdf'), file('big.jpg', 'image/jpeg', 16 * 1024 * 1024)])
    expect(await screen.findByText(/doc.pdf: Tipo de arquivo não permitido/)).toBeInTheDocument()
    expect(screen.getByText(/big.jpg: A imagem é muito grande/)).toBeInTheDocument()
    expect(state()).toEqual([])
  })
  it('troca a principal, reordena e remove (principal passa para a próxima)', async () => {
    const user = userEvent.setup()
    const mk = (id: string, main: boolean): ImageItem => ({ key: id, id, storage_path: `p/${id}.webp`, previewUrl: `u/${id}`, alt: '', color_variant: '', is_main: main })
    render(<Harness initial={[mk('1', true), mk('2', false), mk('3', false)]} />)
    await user.click(screen.getAllByRole('button', { name: 'Principal' })[1]) // foto 2
    expect(state().map((s: { main: boolean }) => s.main)).toEqual([false, true, false])
    await user.click(screen.getByRole('button', { name: 'Mover foto 3 para trás' }))
    expect(state().map((s: { name: string }) => s.name)).toEqual(['1', '3', '2'])
    await user.click(screen.getByRole('button', { name: 'Remover foto 3' })) // remove a principal ("2")
    expect(state()).toEqual([{ main: true, name: '1' }, { main: false, name: '3' }])
  })
})
