import { hashSenha } from '../lib/central'

/** Gera o hash da senha da Central para a env (a senha em si nunca vai para a Vercel). Uso: npx tsx scripts/central-senha.ts 'senha' */
const senha = process.argv[2]
if (!senha) { console.error('uso: npx tsx scripts/central-senha.ts <senha>'); process.exit(1) }
console.log(hashSenha(senha))
