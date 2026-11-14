// Fonti iniziali monitorate. Solo API pubbliche documentate e feed RSS/Atom pubblicati dagli editori.
// Modificabili dall'amministratore (Admin → Fonti). Una fonte che smette di funzionare viene
// segnalata nello stato dell'ultima esecuzione, non rimossa automaticamente.
export const SOURCES = [
  // --- API per la ricerca di risorse formative ---
  { name: 'GitHub – repository formativi', kind: 'github', trust_tier: 'comunita', purpose: 'risorse',
    config: { queries: ['prompt engineering guide', 'awesome chatgpt prompts', 'claude cookbook', 'gemini api cookbook', 'generative ai for beginners', 'llm course', 'stable diffusion prompt guide'] } },
  { name: 'arXiv – cs.CL / cs.AI', kind: 'arxiv', trust_tier: 'istituzionale', purpose: 'entrambi',
    config: { queries: ['prompt engineering', 'large language model evaluation', 'retrieval augmented generation', 'llm hallucination'] } },
  { name: 'Hacker News – discussioni AI', kind: 'hackernews', trust_tier: 'comunita', purpose: 'entrambi',
    config: { queries: ['ChatGPT', 'Claude', 'Gemini', 'LLM tutorial', 'prompt engineering'], minPoints: 50 } },
  { name: 'YouTube – videolezioni', kind: 'youtube', trust_tier: 'comunita', purpose: 'risorse', enabled: 0,
    config: { queries: ['corso ChatGPT italiano', 'Claude AI tutorial', 'Gemini tutorial', 'prompt engineering course', 'Midjourney tutorial'], note: 'Richiede YOUTUBE_API_KEY' } },
  // --- Feed ufficiali (novità) ---
  { name: 'OpenAI News', kind: 'rss', trust_tier: 'ufficiale', purpose: 'novita', tool_slugs: ['chatgpt'], config: { url: 'https://openai.com/news/rss.xml' } },
  { name: 'Google – blog AI', kind: 'rss', trust_tier: 'ufficiale', purpose: 'novita', tool_slugs: ['gemini', 'notebooklm'], config: { url: 'https://blog.google/technology/ai/rss/' } },
  { name: 'Google DeepMind – blog', kind: 'rss', trust_tier: 'ufficiale', purpose: 'novita', tool_slugs: ['gemini'], config: { url: 'https://deepmind.google/blog/rss.xml' } },
  { name: 'Hugging Face – blog', kind: 'rss', trust_tier: 'ufficiale', purpose: 'entrambi', tool_slugs: ['hugging-face'], config: { url: 'https://huggingface.co/blog/feed.xml' } },
  { name: 'GitHub Blog – AI & ML', kind: 'rss', trust_tier: 'ufficiale', purpose: 'novita', tool_slugs: ['github-copilot'], config: { url: 'https://github.blog/ai-and-ml/feed/' } },
  { name: 'Microsoft – AI Blog', kind: 'rss', trust_tier: 'ufficiale', purpose: 'novita', tool_slugs: ['copilot'], config: { url: 'https://blogs.microsoft.com/ai/feed/' } },
  { name: 'MIT News – Artificial intelligence', kind: 'rss', trust_tier: 'istituzionale', purpose: 'novita', config: { url: 'https://news.mit.edu/rss/topic/artificial-intelligence2' } },
];
