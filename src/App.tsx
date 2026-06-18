import { useState, useEffect } from "react";
import { 
  Sun, 
  Moon, 
  TrendingUp, 
  MapPin, 
  Users, 
  Brain, 
  Sparkles, 
  AlertTriangle, 
  Search, 
  Database, 
  FileText, 
  RefreshCw, 
  Clock, 
  ArrowRight, 
  Activity,
  Award,
  ShieldCheck,
  ChevronRight,
  TrendingDown,
  ThumbsUp
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  Legend
} from "recharts";

// TypeScript interfaces matching our Backend data payload
interface DashboardData {
  recordCount: number;
  solicitantes: Record<string, { count: number; pct: number }>;
  bairros: Array<{ pos: number; nome: string; valor: number }>;
  enderecos: Array<{ pos: number; local: string; valor: number }>;
  efetivos: Array<{ rank: number; nome: string; cargo: string; escala: string; valor: number }>;
  periodos: Record<string, { total: number; fixo: number; moto: number }>;
  diasSemana: Array<{ label: string; count: number }>;
  mensal: Array<{ label: string; count: number }>;
  preventivoVsCorretivo: { preventivo: number; corretivo: number };
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"visao-geral" | "geografia" | "efetivo" | "planejamento-ia">("visao-geral");
  const [isDark, setIsDark] = useState(true);

  // Filter States
  const [bairroFilter, setBairroFilter] = useState("");
  const [enderecoFilter, setEnderecoFilter] = useState("");
  const [efetivoFilter, setEfetivoFilter] = useState("");

  // Selection state for Efetivo tab
  const [selectedAgentIndex, setSelectedAgentIndex] = useState<number | null>(null);
  const [agentAiLoading, setAgentAiLoading] = useState(false);
  const [agentAiResult, setAgentAiResult] = useState<string | null>(null);

  // Simulation & Custom Query States
  const [selectedScenario, setSelectedScenario] = useState("chuva_100mm_ibura");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");

  // Fetch metrics from Express server
  const loadStats = async (reload = false) => {
    if (reload) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/data?reload=${reload}`);
      if (!res.ok) throw new Error("Não foi possível carregar dados estruturados.");
      const payload: DashboardData = await res.json();
      setData(payload);
      // Select the first agent as default
      if (payload.efetivos && payload.efetivos.length > 0) {
        setSelectedAgentIndex(0);
      }
    } catch (err: any) {
      setError(err.message || "Erro de conexão com o painel.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
    // Set default theme to dark by adding class to body
    setIsDark(true);
    document.documentElement.classList.add("dark");
  }, []);

  // Theme Toggler
  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Helper parser for markdown response from Gemini to styled safe HTML
  const formatMarkdown = (text: string): string => {
    let html = text;
    // Section Title
    html = html.replace(/### (.*?)\n/g, '<h4 class="font-display font-bold text-xs text-brand-500 dark:text-sky-400 mt-4 mb-1.5 flex items-center space-x-1"><span>✦</span> <span>$1</span></h4>');
    html = html.replace(/## (.*?)\n/g, '<h3 class="font-display font-bold text-sm text-slate-800 dark:text-slate-100 mt-5 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2">$1</h3>');
    html = html.replace(/# (.*?)\n/g, '<h2 class="font-display font-extrabold text-base text-slate-900 dark:text-slate-50 mt-6 pb-2 mb-3 border-b border-slate-200 dark:border-slate-700">$1</h2>');

    // Bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">$1</strong>');
    
    // Unordered item list formatting
    html = html.replace(/^\s*[\-\*]\s+(.*?)$/gm, '<li class="ml-4 list-disc text-slate-600 dark:text-slate-300 text-xs mb-1">$1</li>');

    // Wrap paragraphs
    const blocks = html.split("\n");
    const output = blocks.map(block => {
      const b = block.trim();
      if (b.startsWith("<li") || b.startsWith("<h")) return block;
      if (!b) return "";
      return `<p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">${block}</p>`;
    }).join("");

    return output;
  };

  // Trigger professional evaluation of specific orientation agent
  const generateAgentRemarks = async (agentName: string, rank: number, valor: number, cargo: string, escala: string) => {
    setAgentAiLoading(true);
    setAgentAiResult(null);

    const systemPrompt = `Você é o Diretor Operacional de Recursos Humanos e Engenheiro de Tráfego CTTU Recife. Redija um parecer de feedback formal, técnico e motivador para o orientador selecionado de trânsito em campo (máximo 140 palavras).`;
    const userQuery = `Gere uma avaliação de desempenho institucional de 2026 para o orientador de trânsito ${agentName}, ocupando a função de ${cargo}, escala de Turno ${escala}. Ele concluiu as auditorias internas com ${valor} contatos e atendimentos registrados, posicionando-se no ranking geral como o Top #${rank} do efetivo do município de Recife. Aponte sugestões de engajamento para aprimorar o escoamento rápido na Ladeira de Cohab para 2027.`;

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userQuery })
      });
      if (!res.ok) throw new Error("Instabilidade temporária de IA.");
      const payload = await res.json();
      setAgentAiResult(payload.result);
    } catch {
      setAgentAiResult("Não foi possível conectar com o Gemini no momento. Verifique a chave de API em Secrets.");
    } finally {
      setAgentAiLoading(false);
    }
  };

  // Trigger Crisis simulator run
  const runSimulation = async (scenarioKey: string) => {
    setIsAiLoading(true);
    setAiReport(null);

    let query = "";
    if (scenarioKey === "chuva_100mm_ibura") {
      query = "Simule impacto tático de tempestade de 100mm com inundações profundas no Ibura. Proponha relocação analítica de efetivos, definindo prioridade de atuação física (motos x fixos) para combater a saturação de carros na Ladeira da Cohab.";
    } else if (scenarioKey === "acidente_dois_rios") {
      query = "Simule bloqueio por colisão violenta múltipla na Av Dois Rios (Ladeira da Cohab) no horário do pico da tarde. Destaque quais caminhos e cruzamentos do entorno devem receber equipes para desvios prioritários de linhas de ônibus.";
    } else if (scenarioKey === "bloqueio_cais_apolo") {
      query = "Simule obstrução total do Cais do Apoio para evento festivo no Bairro do Recife. Detalhe plano de contingência para evitar colapso no acesso sul da Ponte do Limoeiro e coordenação visual com painéis digitais móveis de trânsito.";
    } else {
      query = "Planeje operações para combater o gargalo estrutural na Av Conselheiro Aguiar (Boa Viagem) em fim de tarde de sexta-feira. Como agentes motorizados devem atuar móvel para suprimir estacionamentos irregulares de aplicativos de transporte.";
    }

    const systemPrompt = `Você é o Superintendente do CET (Centro de Engenharia de Tráfego) e Operações da CTTU Recife. 
Abaixo está o resumo estatístico operacional de Recife em 2026:
- Total de Atendimentos: ${data?.recordCount || 5471}
- Distribuição de Serviços: ${data?.solicitantes["SERVIÇOS URBANOS"]?.count || 1845} urbano, ${data?.solicitantes["MOBILIDADE"]?.count || 1632} mobilidade, ${data?.solicitantes["CULTURA E LAZER"]?.count || 1681} sociocultural
- Caráter Preventivo dominante: ${data?.preventivoVsCorretivo.preventivo || 91.6}% preventivo, ${data?.preventivoVsCorretivo.corretivo || 8.4}% corretivo

Analise o cenário solicitado construindo uma diretiva de emergência com soluções táticas específicas, número estimado de contingentes indicados, desvios e orientações para o controle urbano. Use tópicos objetivos.`;

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userQuery: query })
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setAiReport(payload.result);
    } catch {
      setAiReport("Falha ao simular crise operacional. Verifique o status da chave no painel do AI Studio.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Fast action triggers for dynamic diagnostics
  const runQuickDiagnostic = async (type: "eficiencia" | "turnos" | "pontos-criticos") => {
    setIsAiLoading(true);
    setAiReport(null);

    let systemPrompt = `Você é o Assessor Técnico Especial de Mobilidade da Prefeitura de Recife.`;
    let userQuery = "";

    if (type === "eficiencia") {
      userQuery = `Gere uma auditoria analítica dos dados gerais operacionais de Recife em 2026. Aponte os padrões dominantes do caráter preventivo de ${data?.preventivoVsCorretivo.preventivo}% comparado aos gargalos e proponha 3 ações estratégicas institucionais imediatas de investimento para 2027.`;
    } else if (type === "turnos") {
      userQuery = `Analise a alocação de equipes por turnos da CTTU. Observando que no Turno da Manhã operamos com ${data?.periodos.MANHÃ.total} registros e no Turno da Tarde com ${data?.periodos.TARDE.total} registros, enquanto o fluxo da noite é menor com ${data?.periodos.NOITE.total} registros. Qual a relação de eficácia entre agentes em motocicletas x fixos nos picos e como equilibrar?`;
    } else {
      userQuery = `Temos recorde absoluto de ocorrências e de retenção de trânsito em ${data?.enderecos[0]?.local || "Ladeira da Cohab"}. Crie um diagnóstico de infraestrutura e engenharia passiva de tráfego sugerindo intervenções físicas de urbanismo tático no cruzamento.`;
    }

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userQuery })
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setAiReport(payload.result);
    } catch {
      setAiReport("Erro ao compilar diagnóstico preditivo. Certifique-se de configurar GEMINI_API_KEY.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Custom QA submission
  const submitCustomPrompt = async () => {
    if (!customPrompt.trim()) return;
    setIsAiLoading(true);
    setAiReport(null);

    const systemPrompt = `Você é o Consultor Técnico de Mobilidade Urbana e Engenharia de Tráfego da CTTU Recife. Use os dados de 2026 fornecidos para as devidas fundamentações. Guarde em mente: Total atendimentos ${data?.recordCount}, Bairro Líder ${data?.bairros[0]?.nome}, Cruzamento recordista ${data?.enderecos[0]?.local}.`;
    
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userQuery: customPrompt })
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setAiReport(payload.result);
      setCustomPrompt("");
    } catch {
      setAiReport("Erro de comunicação com o assistente inteligente.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Filtering calculations on client-side for dynamic data grids
  const filteredBairros = data?.bairros.filter(b => 
    b.nome.toLowerCase().includes(bairroFilter.toLowerCase())
  ) || [];

  const filteredEnderecos = data?.enderecos.filter(e => 
    e.local.toLowerCase().includes(enderecoFilter.toLowerCase())
  ) || [];

  const filteredEfetivos = data?.efetivos.filter(a => 
    a.nome.toLowerCase().includes(efetivoFilter.toLowerCase())
  ) || [];

  const selectedAgent = selectedAgentIndex !== null && data ? data.efetivos[selectedAgentIndex] : null;

  // Render Loader screen for initialization
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500 mb-4"></div>
        <p className="font-display font-bold text-sm tracking-wide text-slate-600 dark:text-slate-400">
          Sincronizando estatísticas da Prefeitura Municipal do Recife...
        </p>
        <p className="text-xs text-slate-400 mt-1">Carregando dados consolidados de tráfego 2026</p>
      </div>
    );
  }

  // Render network error fallback panel
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-950 p-6 text-center text-slate-800 dark:text-slate-100">
        <div className="bg-red-500/10 text-red-500 p-4 rounded-full mb-4">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <h3 className="text-lg font-bold font-display">Falha de Comunicação</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6">
          Não conseguimos estruturar os relatórios das planilhas municipais da CTTU no momento.
        </p>
        <button 
          onClick={() => loadStats(true)} 
          className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Tentar Sincronizar Novamente</span>
        </button>
      </div>
    );
  }

  // Formatting chart data mapping 5471 rows
  const solicitantesChartData = Object.entries(data.solicitantes).map(([key, val]) => {
    const info = val as { count: number; pct: number };
    return {
      name: key.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
      atendimentos: info.count,
      porcentagem: info.pct
    };
  });

  const turnosChartData = [
    { label: "Manhã", Fixo: data.periodos.MANHÃ.fixo, Motorizado: data.periodos.MANHÃ.moto },
    { label: "Tarde", Fixo: data.periodos.TARDE.fixo, Motorizado: data.periodos.TARDE.moto },
    { label: "Noite", Fixo: data.periodos.NOITE.fixo, Motorizado: data.periodos.NOITE.moto }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300">
      
      {/* Dynamic Navigation Header Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo and State indicator */}
          <div className="flex items-center space-x-3" id="brand-logo">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md shadow-indigo-500/20 dark:bg-indigo-600/10 dark:text-indigo-400 dark:border dark:border-indigo-500/30">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xs font-bold tracking-widest text-slate-900 dark:text-white uppercase font-display">CTTU RECIFE <span className="text-indigo-600 dark:text-indigo-400">v2.6</span></h1>
                <span className="text-[9px] px-2 py-0.5 rounded-md font-semibold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/25 animate-pulse">
                  Insight Engine Online
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Orientadores de Trânsito & Mobilidade 2026</p>
            </div>
          </div>

          {/* Quick controls */}
          <div className="flex items-center space-x-4">
            <span className="hidden md:inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800">
              <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-indigo-400/80" />
              01 Jan - 31 Dez 2026
            </span>

            {/* Sync trigger button */}
            <button 
              onClick={() => loadStats(true)} 
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all border border-slate-200/50 dark:border-slate-800 disabled:opacity-50 hover:border-indigo-500/30 dark:hover:border-indigo-550/30"
              title="Forçar recarga da planilha"
              id="refresh-data-btn"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-indigo-500" : ""}`} />
            </button>
            
            {/* Dark Mode toggle Button */}
            <button 
              onClick={toggleTheme} 
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200/50 dark:border-slate-800 hover:border-indigo-500/30 dark:hover:border-indigo-550/30"
              title="Mudar visual"
              id="theme-toggler"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Banner executive summary */}
        <div className="mb-6 p-6 bg-slate-900 text-white rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full filter blur-3xl -mr-20 -mt-20"></div>
          <div className="relative z-10 md:flex md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight font-display text-white">Monitoramento Executivo da Mobilidade</h2>
              <p className="text-slate-400 mt-1 max-w-xl text-xs leading-relaxed">
                Auditoria de produtividade de campo e atuação dos orientadores de trânsito em Recife. Insira novas ocorrências diretamente no Google Sheets para sincronização automática.
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-baseline space-x-2 bg-slate-950/65 px-4 py-2.5 rounded-xl border border-slate-800">
              <span className="text-3xl font-extrabold tracking-tight font-display text-indigo-400">
                {data?.recordCount.toLocaleString()}
              </span>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Ações Totais</span>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="border-b border-slate-200 dark:border-slate-800 mb-6">
          <nav className="flex flex-wrap gap-1 sm:space-x-8" aria-label="Navegação em abas">
            <button 
              onClick={() => setTab("visao-geral")}
              className={`pb-4 px-2 text-xs font-semibold tracking-wide transition-all border-b-2 flex items-center space-x-2 ${
                tab === "visao-geral" 
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" 
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-800"
              }`}
              id="tab-btn-overview"
            >
              <Activity className="w-4 h-4" />
              <span>Visão Geral</span>
            </button>
            <button 
              onClick={() => setTab("geografia")}
              className={`pb-4 px-2 text-xs font-semibold tracking-wide transition-all border-b-2 flex items-center space-x-2 ${
                tab === "geografia" 
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" 
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-800"
              }`}
              id="tab-btn-geography"
            >
              <MapPin className="w-4 h-4" />
              <span>Análise Geográfica</span>
            </button>
            <button 
              onClick={() => setTab("efetivo")}
              className={`pb-4 px-2 text-xs font-semibold tracking-wide transition-all border-b-2 flex items-center space-x-2 ${
                tab === "efetivo" 
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" 
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-800"
              }`}
              id="tab-btn-agents"
            >
              <Users className="w-4 h-4" />
              <span>Efetivo de Orientadores</span>
            </button>
            <button 
              onClick={() => setTab("planejamento-ia")}
              className={`pb-4 px-2 text-xs font-semibold tracking-wide transition-all border-b-2 flex items-center space-x-2 ${
                tab === "planejamento-ia" 
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-450 font-bold" 
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-800"
              }`}
              id="tab-btn-ai-planning"
            >
              <Brain className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <span className="flex items-center">
                Planejamento com IA
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-500/10 text-[8px] text-indigo-600 dark:text-indigo-450 font-extrabold border border-indigo-500/20">GEMINI</span>
              </span>
            </button>
          </nav>
        </div>

        {/* =======================================================
            TAB COMPONENT 1: VISÃO GERAL
        ======================================================= */}
        {tab === "visao-geral" && (
          <div className="space-y-6 animate-fade-in" id="view-overview">
            
            {/* Summary Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Serviços Urbanos */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-between hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-all shadow-sm" id="card-servicos">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Serviços Urbanos</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/25">
                    {data.solicitantes["SERVIÇOS URBANOS"]?.count.toLocaleString() || "1.845"}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white font-display">
                    {data.solicitantes["SERVIÇOS URBANOS"]?.pct || "33.4"}<span className="text-indigo-500 dark:text-indigo-400">%</span>
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Sinalização, pintura e conservação da viaria</p>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-950 h-1 rounded-full mt-4 overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${data.solicitantes["SERVIÇOS URBANOS"]?.pct || 33.4}%` }}></div>
                </div>
              </div>

              {/* Card 2: Cultura e Lazer */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-between hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-all shadow-sm" id="card-cultura">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Sociocultural</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/25 dark:text-indigo-400 border border-indigo-500/25">
                    {data.solicitantes["CULTURA E LAZER"]?.count.toLocaleString() || "1.681"}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white font-display">
                    {data.solicitantes["CULTURA E LAZER"]?.pct || "30.4"}<span className="text-indigo-500 dark:text-indigo-400">%</span>
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Eventos esportivos e culturais</p>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-950 h-1 rounded-full mt-4 overflow-hidden">
                  <div className="bg-indigo-500 h-full" style={{ width: `${data.solicitantes["CULTURA E LAZER"]?.pct || 30.4}%` }}></div>
                </div>
              </div>

              {/* Card 3: Mobilidade */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-between hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-all shadow-sm" id="card-mobilidade">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Mobilidade</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/25 dark:text-indigo-400 border border-indigo-500/25">
                    {data.solicitantes["MOBILIDADE"]?.count.toLocaleString() || "1.632"}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white font-display">
                    {data.solicitantes["MOBILIDADE"]?.pct || "29.5"}<span className="text-indigo-500 dark:text-indigo-400">%</span>
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Desvios, picos e monitoramento de fluxo</p>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-950 h-1 rounded-full mt-4 overflow-hidden">
                  <div className="bg-indigo-400 h-full" style={{ width: `${data.solicitantes["MOBILIDADE"]?.pct || 29.5}%` }}></div>
                </div>
              </div>

              {/* Card 4: Espaços Públicos */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-between hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-all shadow-sm" id="card-espacos">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Espaços Públicos</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/25">
                    {data.solicitantes["ESPAÇOS PÚBLICOS"]?.count.toLocaleString() || "312"}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white font-display">
                    {data.solicitantes["ESPAÇOS PÚBLICOS"]?.pct || "5.6"}<span className="text-indigo-500 dark:text-indigo-400">%</span>
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Parques, praças e mercados públicos</p>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-950 h-1 rounded-full mt-4 overflow-hidden">
                  <div className="bg-amber-500 h-full" style={{ width: `${data.solicitantes["ESPAÇOS PÚBLICOS"]?.pct || 5.6}%` }}></div>
                </div>
              </div>

            </div>

            {/* Core Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Chart 1: Volumetric Line Chart of Weeks */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm" id="chart-week-container">
                <div className="md:flex md:items-center md:justify-between mb-4">
                  <div>
                    <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">Registros Semanais de Atendimento</h3>
                    <p className="text-[10px] text-slate-400">Distribuição quantitativa das equipes por dia da semana</p>
                  </div>
                  <div className="mt-2 md:mt-0 px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-[10px] font-semibold border border-indigo-500/20">
                    Pico de campo: Segunda-Feira
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.diasSemana} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#1e293b" : "#f1f5f9"} />
                      <XAxis dataKey="label" stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} tickLine={false} />
                      <YAxis stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? "#0f172a" : "#ffffff", 
                          borderColor: isDark ? "#1e293b" : "#e2e8f0" ,
                          color: isDark ? "#f8fafc" : "#0f172a",
                          fontSize: 10,
                          borderRadius: 12
                        }} 
                      />
                      <Area type="monotone" dataKey="count" name="Registros" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Doughnut / Bar Distribution of Categories */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm" id="chart-categories-container">
                <div>
                  <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">Atuação por Grupo de Demanda</h3>
                  <p className="text-[10px] text-slate-400">Classificação estatística das solicitações</p>
                </div>
                
                <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={solicitantesChartData} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? "#1e293b" : "#f1f5f9"} />
                      <XAxis type="number" stroke={isDark ? "#475569" : "#94a3b8"} fontSize={9} tickLine={false} />
                      <YAxis dataKey="name" type="category" stroke={isDark ? "#475569" : "#94a3b8"} fontSize={9} tickLine={false} width={80} />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: isDark ? "#0f172a" : "#ffffff", 
                          borderColor: isDark ? "#1e293b" : "#e2e8f0" ,
                          color: isDark ? "#f8fafc" : "#0f172a",
                          fontSize: 10,
                          borderRadius: 12
                        }}
                      />
                      <Bar dataKey="atendimentos" name="Eventos" radius={[0, 4, 4, 0]}>
                        {solicitantesChartData.map((entry, index) => {
                          const colors = ["#10b981", "#6366f1", "#0ea5e9", "#f59e0b", "#94a3b8"];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Qualitative analysis indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Preventive Character indicators */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-between shadow-sm" id="ind-preventivo">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Caráter da Operação</span>
                  <h4 className="text-sm font-bold mt-1 text-slate-900 dark:text-white">Alto Teor Médico-Preventivo</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    As operações estão estruturadas prioritariamente na prevenção e monitoração tática ostensiva antes da ocorrência estrutural.
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-semibold font-display">
                    <span className="text-emerald-500">Preventiva ({data.preventivoVsCorretivo.preventivo}%)</span>
                    <span className="text-rose-500">Corretiva ({data.preventivoVsCorretivo.corretivo}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-555 h-full" style={{ width: `${data.preventivoVsCorretivo.preventivo}%`, backgroundColor: '#10b981' }}></div>
                    <div className="bg-rose-555 h-full" style={{ width: `${data.preventivoVsCorretivo.corretivo}%`, backgroundColor: '#f43f5e' }}></div>
                  </div>
                </div>
              </div>

              {/* Geographic anchor indicator */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-5 rounded-xl flex items-center space-x-4 hover:border-indigo-500/30 transition-all shadow-sm" id="ind-leader-bairro">
                <div className="p-4 bg-indigo-500/10 text-indigo-550 dark:text-indigo-400 rounded-lg border border-indigo-500/20">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Bairro Recordista</span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide mt-1">
                    Bairro do {data.bairros[0]?.nome || "RECIFE"}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    {data.bairros[0]?.valor || 990} registros compilados no Bairro Histórico sob coordenação ativa.
                  </p>
                </div>
              </div>

              {/* Coordinator metrics indicator */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-5 rounded-xl flex items-center space-x-4 hover:border-indigo-500/30 transition-all shadow-sm" id="ind-coordinated">
                <div className="p-4 bg-indigo-500/10 text-indigo-550 dark:text-indigo-400 rounded-lg border border-indigo-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Foco Do Planejamento</span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">Urbanismo e Eventos</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Serviços Urbanos e Eventos Sociais representam <strong className="text-indigo-600 dark:text-indigo-400 font-bold">63,8%</strong> do tempo total de empenho operacional do efetivo.
                  </p>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* =======================================================
            TAB COMPONENT 2: ANÁLISE GEOGRÁFICA
        ======================================================= */}
        {tab === "geografia" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in" id="view-geography">
            
            {/* Column A: Bairros list with search */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm" id="geo-bairros-card">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <div>
                    <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">Bairros Monitorados</h3>
                    <p className="text-[10px] text-slate-400">Classificação demográfica por volume de ocorrências</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Filtrar bairro..."
                      value={bairroFilter}
                      onChange={(e) => setBairroFilter(e.target.value)}
                      className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-100 w-full sm:w-40"
                    />
                  </div>
                </div>

                {/* Scroller Area */}
                <div className="overflow-y-auto max-h-96 pr-1 mt-4 space-y-1">
                  {filteredBairros.length > 0 ? (
                    filteredBairros.map((b) => (
                      <div 
                        key={b.nome}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950/60 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800/50"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 w-5">#{b.pos}</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{b.nome}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{b.valor}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold border border-indigo-500/20">
                            {((b.valor / data.recordCount) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 py-6 text-center">Nenhum bairro localizado com este filtro.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Column B: Endereços / Cruzamentos with search */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm" id="geo-points-card">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <div>
                    <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">Pontos Críticos Registrados</h3>
                    <p className="text-[10px] text-slate-400">Cruzamentos e logradouros que exigem contenção imediata</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Filtrar endereço..."
                      value={enderecoFilter}
                      onChange={(e) => setEnderecoFilter(e.target.value)}
                      className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-100 w-full sm:w-40"
                    />
                  </div>
                </div>

                {/* Scroller Area */}
                <div className="overflow-y-auto max-h-96 pr-1 mt-4 space-y-1">
                  {filteredEnderecos.length > 0 ? (
                    filteredEnderecos.map((e) => (
                      <div 
                        key={e.local}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950/60 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800/50"
                      >
                        <div className="flex items-center space-x-3 truncate max-w-[80%]">
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 w-5">#{e.pos}</span>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate" title={e.local}>
                            {e.local}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 min-w-10 text-center">
                          {e.valor}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 py-6 text-center">Nenhum cruzamento mapeado correspondente.</p>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* =======================================================
            TAB COMPONENT 3: PRODUTIVIDADE DO EFETIVO
        ======================================================= */}
        {tab === "efetivo" && (
          <div className="space-y-6 animate-fade-in" id="view-agents">
            
            {/* Upper Split: Turno allocation stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Efetivo mode Distribution (Moto vs Fixo) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl flex flex-col justify-between shadow-sm">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Modalidade de Escolta</span>
                  <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white mt-1">Efetivo Operacional</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Divisão tática entre equipes móveis com motoviaturas e equipes de presença fixa em cruzamento.
                  </p>
                </div>

                <div className="flex items-center justify-around border-t border-slate-100 dark:border-slate-800/80 mt-6 pt-5">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block uppercase font-display">Orientadores Fixos</span>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">4.530</p>
                    <span className="text-[9px] font-semibold bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 mt-1.5 inline-block">
                      82.1%
                    </span>
                  </div>
                  <div className="h-10 border-l border-slate-200 dark:border-slate-800"></div>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block uppercase font-display">Batedores de Moto</span>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">990</p>
                    <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 mt-1.5 inline-block">
                      17.9%
                    </span>
                  </div>
                </div>
              </div>

              {/* Turno balance bar chart details */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl flex flex-col justify-between shadow-sm">
                <div>
                  <h3 className="font-display font-semibold text-sm text-slate-950 dark:text-white">Alocação de Orientadores por Turno</h3>
                  <p className="text-[11px] text-slate-400">Distribuição quantitativa de turnos para combater picos</p>
                </div>

                <div className="h-32 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={turnosChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#1e293b" : "#f1f5f9"} />
                      <XAxis dataKey="label" stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} tickLine={false} />
                      <YAxis stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? "#0f172a" : "#ffffff", 
                          borderColor: isDark ? "#1e293b" : "#e2e8f0" ,
                          color: isDark ? "#f8fafc" : "#0f172a",
                          fontSize: 10,
                          borderRadius: 12
                        }}  
                      />
                      <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                      <Bar dataKey="Fixo" stackId="a" fill="#6366f1" name="Presença Fixa" />
                      <Bar dataKey="Motorizado" stackId="a" fill="#10b981" name="Batedores de Moto" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Split Grid: Bottom Left Leaderboard & Bottom Right Performance Assessment Card */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Leaderboard Table (2/3 size) */}
              <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm" id="leaderboard-container">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <div>
                    <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">Atuação Individual em Campo</h3>
                    <p className="text-[10px] text-slate-400">Selecione um orientador para abrir a ficha de RH operacional</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Buscar orientador..."
                      value={efetivoFilter}
                      onChange={(e) => setEfetivoFilter(e.target.value)}
                      className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-100 w-full sm:w-48"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    <thead>
                      <tr className="text-left text-slate-450 dark:text-slate-450 font-bold font-display uppercase text-[10px] tracking-wider">
                        <th className="pb-3 pr-2">Classificação</th>
                        <th className="pb-3 px-2">Orientador</th>
                        <th className="pb-3 px-2">Função</th>
                        <th className="pb-3 px-2 text-center">Escala</th>
                        <th className="pb-3 pl-2 text-right">Ocorrências</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                      {filteredEfetivos.length > 0 ? (
                        filteredEfetivos.map((a, i) => {
                          const isSelected = selectedAgent?.nome === a.nome;
                          const actualIndexInSource = data.efetivos.findIndex(org => org.nome === a.nome);
                          
                          return (
                            <tr 
                              key={a.nome}
                              onClick={() => {
                                setSelectedAgentIndex(actualIndexInSource);
                                setAgentAiResult(null); // Clear previous AI text to permit next query
                              }}
                              className={`cursor-pointer transition-colors ${
                                isSelected 
                                  ? "bg-indigo-500/10 dark:bg-indigo-500/10 hover:bg-indigo-500/15" 
                                  : "hover:bg-slate-50 dark:hover:bg-slate-950/40"
                              }`}
                            >
                              <td className="py-3 pr-2 font-semibold">
                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${
                                  a.rank === 1 ? "bg-amber-500 text-white font-bold" :
                                  a.rank === 2 ? "bg-slate-350 text-slate-800 dark:text-slate-200 font-bold" :
                                  a.rank === 3 ? "bg-amber-700 text-white font-bold" :
                                  "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                }`}>
                                  {a.rank}
                                </span>
                              </td>
                              <td className="py-3 px-2 font-semibold text-slate-850 dark:text-slate-100">{a.nome}</td>
                              <td className="py-3 px-2 text-slate-500 text-[11px]">{a.cargo}</td>
                              <td className="py-3 px-2 text-center">
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-medium border border-slate-200/40 dark:border-slate-800/50">
                                  {a.escala}
                                </span>
                              </td>
                              <td className="py-3 pl-2 text-right font-bold text-indigo-600 dark:text-indigo-400">{a.valor}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">Nenhum orientador localizado neste filtro.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RH Agent Card (1/3 size) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl flex flex-col justify-between h-fit min-h-[400px] shadow-sm">
                {selectedAgent ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="h-10 w-10 text-xs text-indigo-600 bg-indigo-500/10 flex items-center justify-center rounded-xl font-bold font-display uppercase border border-indigo-500/20 dark:text-indigo-400 dark:bg-indigo-600/10">
                        {selectedAgent.nome.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{selectedAgent.nome}</h4>
                        <p className="text-[10px] text-slate-400">{selectedAgent.cargo} • Recife</p>
                      </div>
                    </div>

                    {/* Metrics detail Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                        <span className="text-[9px] text-slate-450 dark:text-slate-400 font-display font-semibold uppercase">Contatos</span>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{selectedAgent.valor}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
                        <span className="text-[9px] text-slate-450 dark:text-slate-400 font-display font-semibold uppercase">Desempenho</span>
                        <span className="text-emerald-500 font-bold text-xs flex items-center">
                          <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                          +{((selectedAgent.valor / (5471 / 15)) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-450 dark:text-slate-450">Classificação CTTU:</span>
                        <strong className="text-indigo-600 dark:text-indigo-400 font-bold uppercase">Top #{selectedAgent.rank} Geral</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-450 dark:text-slate-450">Escala de Horário:</span>
                        <strong className="text-slate-750 dark:text-slate-350">{selectedAgent.escala}</strong>
                      </div>
                    </div>

                    {/* AI remarks output */}
                    {agentAiResult && (
                      <div className="bg-indigo-50/50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-indigo-100/50 dark:border-slate-800 text-[11px] leading-relaxed animate-fade-in space-y-1 shadow-inner">
                        <p className="text-indigo-600 dark:text-indigo-400 font-semibold font-display uppercase text-[9px] flex items-center">
                          <Sparkles className="w-3.5 h-3.5 mr-1 animate-pulse" />
                          Parecer de IA (Gemini)
                        </p>
                        <div dangerouslySetInnerHTML={{ __html: formatMarkdown(agentAiResult) }} />
                      </div>
                    )}

                    <button 
                      onClick={() => generateAgentRemarks(selectedAgent.nome, selectedAgent.rank, selectedAgent.valor, selectedAgent.cargo, selectedAgent.escala)}
                      disabled={agentAiLoading}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center space-x-1.5"
                    >
                      {agentAiLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b border-white"></div>
                          <span>Computando Relatório...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Parecer de Eficiência IA</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-6 text-slate-400">
                    <Users className="w-8 h-8 opacity-30 mb-2" />
                    <p className="text-xs">Selecione um orientador para abrir sua ficha operacional profissional.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* =======================================================
            TAB COMPONENT 4: PLANEJAMENTO COM IA
        ======================================================= */}
        {tab === "planejamento-ia" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="view-ai-planning">
            
            {/* Left Column: IA quick configurations */}
            <div className="space-y-4">
              
              {/* Crisis Emergency simulator */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm" id="crisis-simulator-card">
                <div className="flex items-center space-x-2.5 mb-3">
                  <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-505 border border-rose-500/20">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <h3 className="font-display font-semibold text-xs tracking-wide text-slate-900 dark:text-white">Simulador de Eventos de Crises</h3>
                </div>
                <p className="text-[10px] text-slate-550 dark:text-slate-400 leading-relaxed mb-4">
                  Selecione uma crise ambiental ou obstáculo em tempo real para o Gemini recalcular as equipes necessárias.
                </p>

                <div className="space-y-3">
                  <select 
                    value={selectedScenario}
                    onChange={(e) => setSelectedScenario(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-705 dark:text-slate-200"
                  >
                    <option value="chuva_100mm_ibura">Temporal de 100mm (Alagamentos no Ibura)</option>
                    <option value="acidente_dois_rios">Colisão Múltipla (Av Dois Rios / Cohab)</option>
                    <option value="bloqueio_cais_apolo">Interdição total para Corrida (Cais do Apolo)</option>
                    <option value="pico_sexta_boa_viagem">Pico Retenção Sexta-Feira (Conselheiro Aguiar)</option>
                  </select>

                  <button 
                    onClick={() => runSimulation(selectedScenario)}
                    disabled={isAiLoading}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center space-x-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gerar Plano de Contingência</span>
                  </button>
                </div>
              </div>

              {/* Quick Diagnostic builders */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm" id="diagnostics-card">
                <div className="flex items-center space-x-2.5 mb-3">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-550 border border-indigo-500/20">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="font-display font-semibold text-xs tracking-wide text-slate-900 dark:text-white">Diagnósticos Preditivos</h3>
                </div>
                <p className="text-[10px] text-slate-550 dark:text-slate-400 leading-relaxed mb-4">
                  Cruze os logs consolidados de Recife de 2026 para obter análises institucionais profundas.
                </p>

                <div className="space-y-2">
                  <button 
                    onClick={() => runQuickDiagnostic("eficiencia")}
                    disabled={isAiLoading}
                    className="w-full text-left p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-950/60 transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between"
                  >
                    <span>Auditoria Anual de Eficiência</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button 
                    onClick={() => runQuickDiagnostic("turnos")}
                    disabled={isAiLoading}
                    className="w-full text-left p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-950/60 transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between"
                  >
                    <span>Distribuição entre Turnos do Efetivo</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button 
                    onClick={() => runQuickDiagnostic("pontos-criticos")}
                    disabled={isAiLoading}
                    className="w-full text-left p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-950/60 transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between"
                  >
                    <span>Remodelagem Urbana da Ladeira da Cohab</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Ask custom planning question */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm" id="custom-ask-card">
                <div className="flex items-center space-x-2.5 mb-3">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-550">
                    <Brain className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="font-display font-semibold text-xs tracking-wide text-slate-800 dark:text-slate-100">Consultar Tráfego de Recife</h3>
                </div>
                
                <div className="space-y-2 mt-3">
                  <textarea 
                    rows={3}
                    placeholder="Ex: Como podemos melhorar os desvios de batedores no Bairro do Recife aos domingos?"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 w-full focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-705 dark:text-slate-200"
                  />
                  <button 
                    onClick={submitCustomPrompt}
                    disabled={isAiLoading || !customPrompt.trim()}
                    className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-550 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-indigo-600/10"
                  >
                    <span>Perguntar ao Gemini ✨</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Right Column: AI Output panel (2/3 width) */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-6 rounded-3xl flex flex-col min-h-[460px]" id="ai-response-panel">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
                <div>
                  <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">Diretrizes de Campo da IA</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Recomendações técnicas geradas em tempo real sob fundamentação dos dados do Recife</p>
                </div>
                {isAiLoading && (
                  <span className="flex h-3.5 w-3.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-500"></span>
                  </span>
                )}
              </div>

              {/* Dynamic scroll text container */}
              <div className="flex-grow overflow-y-auto max-h-[500px] pr-2 scrollbar">
                {isAiLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mb-3"></div>
                    <p className="text-xs text-slate-400 font-sans">Gemini executando cálculos de controle de tráfego...</p>
                  </div>
                ) : aiReport ? (
                  <div className="animate-fade-in space-y-2">
                    <div className="flex items-center space-x-1.5 text-indigo-500 dark:text-sky-440 font-display font-semibold uppercase text-[10px] tracking-widest pb-1 border-b border-slate-50 dark:border-slate-800/80 w-fit">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Parecer do Assistente de IA</span>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: formatMarkdown(aiReport) }} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-20 text-slate-400 max-w-sm mx-auto">
                    <div className="p-4 bg-slate-150/40 dark:bg-slate-800/40 rounded-full mb-3 text-slate-350 dark:text-slate-600">
                      <Activity className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs">Aguardando Diretriz Operacional</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Escolha uma simulação emergencial de crise, consulte diagnósticos de turnos, ou pergunte diretamente ao conselheiro inteligente.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Structured Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-12 py-5 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>© 2026 Autarquia de Trânsito e Transporte Urbano do Recife (CTTU)</span>
          <div className="flex items-center space-x-3">
            <span>Uso Executivo</span>
            <span className="h-3 w-px bg-slate-200 dark:bg-slate-800"></span>
            <span>Painel de Informação & Planejamento Preditivo com IA</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
