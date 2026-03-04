export interface PromoterRecord {
  name: string
  aliases: string[]
  abn: string
  address: string
}

export const PROMOTER_DIRECTORY: PromoterRecord[] = [
  { name: 'Repco Australia Pty Ltd', aliases: ['repco', 'repco australia', 'repco limited'], abn: '97 097 993 283', address: '22 Enterprise Drive, Rowville VIC 3178' },
  { name: 'Rheem Australia Pty Limited', aliases: ['rheem', 'rheem australia'], abn: '72 000 277 607', address: '1 Alan Street, Rydalmere NSW 2116' },
  { name: 'Woolworths Group Limited', aliases: ['woolworths', 'woolies', 'woolworths group'], abn: '88 000 014 675', address: '1 Woolworths Way, Bella Vista NSW 2153' },
  { name: 'Coles Group Limited', aliases: ['coles', 'coles group', 'coles supermarkets'], abn: '11 004 089 936', address: '800 Toorak Road, Hawthorn East VIC 3123' },
  { name: 'Bunnings Group Limited', aliases: ['bunnings', 'bunnings warehouse', 'bunnings group'], abn: '26 008 672 179', address: '19 Lord Street, Bentley WA 6102' },
  { name: 'JB Hi-Fi Limited', aliases: ['jb hi-fi', 'jb hifi', 'jbhifi', 'jb'], abn: '80 093 220 136', address: '60 City Road, Southbank VIC 3006' },
  { name: 'Harvey Norman Holdings Limited', aliases: ['harvey norman', 'harvey normans'], abn: '54 003 237 545', address: 'A1 Richmond Road, Homebush West NSW 2140' },
  { name: 'Officeworks Superstores Pty Ltd', aliases: ['officeworks', 'office works'], abn: '36 004 763 526', address: '800 Toorak Road, Hawthorn East VIC 3123' },
  { name: 'Kmart Australia Limited', aliases: ['kmart', 'k-mart', 'kmart australia'], abn: '73 004 700 485', address: '690 Springvale Road, Mulgrave VIC 3170' },
  { name: 'Target Australia Pty Ltd', aliases: ['target', 'target australia'], abn: '75 004 250 944', address: '690 Springvale Road, Mulgrave VIC 3170' },
  { name: 'Big W Discount Department Stores', aliases: ['big w', 'bigw'], abn: '88 000 014 675', address: '1 Woolworths Way, Bella Vista NSW 2153' },
  { name: 'Myer Holdings Limited', aliases: ['myer', 'myer stores'], abn: '14 119 085 602', address: '800 Collins Street, Docklands VIC 3008' },
  { name: 'David Jones Pty Limited', aliases: ['david jones', 'dj\'s', 'djs'], abn: '75 000 518 558', address: '86-108 Castlereagh Street, Sydney NSW 2000' },
  { name: 'Chemist Warehouse Group', aliases: ['chemist warehouse', 'chemistwarehouse'], abn: '56 099 485 035', address: '30 Mauricio Street, Sunshine VIC 3020' },
  { name: 'Priceline Pharmacy', aliases: ['priceline', 'priceline pharmacy'], abn: '51 000 006 708', address: '800 Toorak Road, Hawthorn East VIC 3123' },
  { name: 'Supercheap Auto Pty Ltd', aliases: ['supercheap', 'supercheap auto', 'super cheap auto'], abn: '82 009 062 046', address: '747 Lytton Road, Murarrie QLD 4172' },
  { name: 'Autobarn', aliases: ['autobarn', 'auto barn'], abn: '44 006 709 894', address: '747 Lytton Road, Murarrie QLD 4172' },
  { name: 'BCF (Boating Camping Fishing)', aliases: ['bcf', 'boating camping fishing'], abn: '82 009 062 046', address: '747 Lytton Road, Murarrie QLD 4172' },
  { name: 'Rebel Sport Limited', aliases: ['rebel', 'rebel sport'], abn: '82 009 062 046', address: '747 Lytton Road, Murarrie QLD 4172' },
  { name: 'Coca-Cola Europacific Partners', aliases: ['coca-cola', 'coca cola', 'coke', 'ccep'], abn: '81 629 561 319', address: '40 Mount Street, North Sydney NSW 2060' },
  { name: 'Lion Pty Ltd', aliases: ['lion', 'lion nathan', 'lion co'], abn: '51 077 897 440', address: '68 York Street, Sydney NSW 2000' },
  { name: 'Carlton & United Breweries', aliases: ['cub', 'carlton united', 'carlton & united', 'foster\'s'], abn: '87 007 871 979', address: '77 Southbank Boulevard, Southbank VIC 3006' },
  { name: 'Endeavour Group Limited', aliases: ['endeavour', 'endeavour group', 'bws', 'dan murphy\'s', 'dan murphys'], abn: '77 159 767 843', address: '26 Waterloo Street, Surry Hills NSW 2010' },
  { name: 'Metcash Limited', aliases: ['metcash', 'iga', 'supa iga'], abn: '32 112 073 480', address: '1 Thomas Holt Drive, Macquarie Park NSW 2113' },
  { name: 'Toll Holdings Pty Ltd', aliases: ['toll', 'toll holdings', 'toll group'], abn: '55 006 592 089', address: '380 St Kilda Road, Melbourne VIC 3004' },
]

export function findPromoter(query: string): PromoterRecord | null {
  const q = query.toLowerCase().trim()
  if (q.length < 2) return null
  return PROMOTER_DIRECTORY.find(p =>
    p.name.toLowerCase().includes(q) ||
    p.aliases.some(a => a.includes(q) || q.includes(a))
  ) ?? null
}

export function searchPromoters(query: string): PromoterRecord[] {
  const q = query.toLowerCase().trim()
  if (q.length < 2) return []
  return PROMOTER_DIRECTORY.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.aliases.some(a => a.includes(q) || q.includes(a))
  ).slice(0, 5)
}
