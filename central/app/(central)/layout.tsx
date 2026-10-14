import { redirect } from 'next/navigation'
import Shell from '@/components/Shell'
import { perfilAtual } from '@/lib/servidor'

export const dynamic = 'force-dynamic'

/** O perfil sai do cookie no servidor: a tela já nasce no perfil certo (sem o flash do CENTRAL §8.1). */
export default async function CentralLayout({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual()
  if (!perfil) redirect('/login')
  return <Shell perfil={perfil}>{children}</Shell>
}
