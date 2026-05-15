import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FaGithub } from 'react-icons/fa'

const repos: { repo: string; label: { [locale: string]: string } }[] = [
  {
    repo: 'fgo-farming-solver',
    label: { ja: 'フロントエンド', en: 'Front end' },
  },
  { repo: 'fgo-farming-solver-api', label: { ja: 'API', en: 'API' } },
  { repo: 'fgodrop', label: { ja: 'スクレイピング', en: 'Scraping' } },
]

export const GithubMenu = ({ 'aria-label': ariaLabel = 'Github' }: { 'aria-label'?: string }) => {
  const locale = 'ja' as string
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={ariaLabel} />}>
        <FaGithub size={24} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {repos.map(({ repo, label }) => (
          <DropdownMenuItem
            key={repo}
            render={
              <a
                href={`https://github.com/faruryo/${repo}`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            {label[locale ?? 'ja']}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
