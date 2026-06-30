import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  Calendar,
  ArrowRight,  
  Activity,
  Award,
  ShieldCheck,
  ChevronRight,
  TrendingDown,
  ThumbsUp,
  Download,
  Navigation,
  XCircle
} from "lucide-react";
import { exportToPDF } from "./utils/pdfExport";
import EfetivoFixoMap from "./components/EfetivoFixoMap";
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
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

// TypeScript interfaces matching our Backend data payload
interface DashboardData {
  recordCount: number;
  solicitantes: Record<string, { count: number; pct: number }>;
  bairros: Array<{ pos: number; nome: string; valor: number }>;
  enderecos: Array<{ pos: number; local: string; valor: number; bairro?: string }>;
  efetivos: Array<{ rank: number; nome: string; cargo: string; escala: string; valor: number; foto?: string }>;
  periodos: Record<string, { total: number; fixo: number; moto: number }>;
  diasSemana: Array<{ label: string; count: number }>;
  mensal: Array<{ label: string; count: number }>;
  preventivoVsCorretivo: { preventivo: number; corretivo: number };
}

const getAgentPhoto = (nome: string, dynamicPhotoUrl?: string) => {
  const nameLower = nome.toLowerCase();

  // Hardcoded overrides for specific users provided by user
  if (nameLower.includes("abimael lucas")) {
    return "https://lh3.googleusercontent.com/d/1W4J7pW_48mxBxcHG7UokPXvG-QTr2bdd";
  }
  if (nameLower.includes("adailton albertino")) {
    return "https://lh3.googleusercontent.com/d/184l4pbaacBPDQc46itYkfow8ZSP3xFtx";
  }

  if (dynamicPhotoUrl && dynamicPhotoUrl.trim() !== "" && dynamicPhotoUrl.startsWith("http")) {
    // Handle Google Drive links
    if (dynamicPhotoUrl.includes('drive.google.com')) {
      const fileId = dynamicPhotoUrl.match(/[-\w]{25,}/);
      if (fileId) return `https://lh3.googleusercontent.com/d/${fileId[0]}`;
    }
    return dynamicPhotoUrl;
  }
  if (nameLower.includes("josé c") || nameLower.includes("jose c")) return "https://i.pravatar.cc/150?img=11";
  if (nameLower.includes("ubirajara")) return "https://i.pravatar.cc/150?img=12";
  if (nameLower.includes("elias")) return "https://i.pravatar.cc/150?img=13";
  if (nameLower.includes("erikles") || nameLower.includes("adriano")) return "https://i.pravatar.cc/150?img=14";
  if (nameLower.includes("jakson") || nameLower.includes("jackson") || nameLower.includes("arruda")) return "https://i.pravatar.cc/150?img=15";
  if (nameLower.includes("marcos")) return "https://i.pravatar.cc/150?img=16";
  if (nameLower.includes("pedro")) return "https://i.pravatar.cc/150?img=68";
  
  // Dynamically assign based on name char codes if none match
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  const imgId = Math.abs(hash % 70) + 1;
  return `https://i.pravatar.cc/150?img=${imgId}`;
};

// Custom tooltip for turnos/periodos analysis
const CustomTurnTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const colors = ["#0ea5e9", "#6366f1", "#8b5cf6"];
    let color = "#6366f1";
    let desc = "";
    if (data.label === "Manhã") {
      color = "#0ea5e9";
      desc = "Pico matutino de trânsito e fluxo de serviços";
    } else if (data.label === "Tarde") {
      color = "#6366f1";
      desc = "Pico vespertino e movimentação comercial/escolar";
    } else if (data.label === "Noite") {
      color = "#8b5cf6";
      desc = "Rondas preventivas e suporte a eventos noturnos";
    }

    return (
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl backdrop-blur-md max-w-[220px]">
        <div className="flex items-center space-x-2 mb-1.5">
          <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: color }}></span>
          <span className="text-[11px] font-bold text-white font-display uppercase tracking-wider">{data.label}</span>
        </div>
        <p className="text-xs text-slate-300 font-medium mb-1">
          Atendimentos: <span className="text-white font-bold">{data.total?.toLocaleString() || 0}</span>
        </p>
        <p className="text-[10px] text-slate-400 leading-relaxed font-sans">{desc}</p>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"visao-geral" | "geografia" | "efetivo" | "escala-efetivo-fixo" | "planejamento-ia">("visao-geral");
  const [isDark, setIsDark] = useState(true);

  // Filter States
  const [bairroFilter, setBairroFilter] = useState("");
  const [enderecoFilter, setEnderecoFilter] = useState("");
  const [selectedBairro, setSelectedBairro] = useState<string | null>(null);
  const [selectedDiaSemana, setSelectedDiaSemana] = useState<string | null>(null);
  const [selectedSolicitante, setSelectedSolicitante] = useState<string | null>(null);
  const [selectedPeriodo, setSelectedPeriodo] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [selectedCaracter, setSelectedCaracter] = useState<string | null>(null);
  const [efetivoFilter, setEfetivoFilter] = useState("");
  const [geoViewMode, setGeoViewMode] = useState<"mapa" | "pontos">("mapa");
  const [isExploded, setIsExploded] = useState(false);
  const [hoveredMapBairro, setHoveredMapBairro] = useState<string | null>(null);

  // Date Range Filter States
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-06-30");

  // Selection state for Efetivo tab
  const [selectedAgentIndex, setSelectedAgentIndex] = useState<number | null>(null);
  const [agentAiLoading, setAgentAiLoading] = useState(false);
  const [agentAiResult, setAgentAiResult] = useState<string | null>(null);

  // Simulation & Custom Query States
  const [selectedScenario, setSelectedScenario] = useState("carnaval_recife");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");

  // Fetch metrics from Express server
  const loadStats = async (
    reload = false, 
    start = startDate, 
    end = endDate,
    diaSemana = selectedDiaSemana,
    solicitante = selectedSolicitante,
    bairro = selectedBairro,
    periodo = selectedPeriodo,
    mode = selectedMode,
    caracter = selectedCaracter
  ) => {
    if (reload) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      let url = `/api/data?reload=${reload}&startDate=${start}&endDate=${end}`;
      if (diaSemana) {
        url += `&diaSemana=${encodeURIComponent(diaSemana)}`;
      }
      if (solicitante) {
        url += `&solicitante=${encodeURIComponent(solicitante)}`;
      }
      if (bairro) {
        url += `&bairro=${encodeURIComponent(bairro)}`;
      }
      if (periodo) {
        url += `&periodo=${encodeURIComponent(periodo)}`;
      }
      if (mode) {
        url += `&mode=${encodeURIComponent(mode)}`;
      }
      if (caracter) {
        url += `&caracter=${encodeURIComponent(caracter)}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Não foi possível carregar dados estruturados.");
      const payload: DashboardData = await res.json();
      setData(payload);
      // Automatically select Pedro Silva or the top ranking agent to showcase the card on load
      if (payload.efetivos && payload.efetivos.length > 0) {
        const defaultIndex = payload.efetivos.findIndex(
          emp => emp.nome.toUpperCase().includes("PEDRO SILVA") || emp.rank === 1
        );
        setSelectedAgentIndex(defaultIndex !== -1 ? defaultIndex : 0);
      } else {
        setSelectedAgentIndex(null);
      }
    } catch (err: any) {
      setError(err.message || "Erro de conexão com o painel.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleSelectBairro = (bairro: string | null) => {
    setSelectedBairro(bairro);
    loadStats(false, startDate, endDate, selectedDiaSemana, selectedSolicitante, bairro, selectedPeriodo, selectedMode);
  };

  const handleSelectDiaSemana = (dia: string | null) => {
    setSelectedDiaSemana(dia);
    loadStats(false, startDate, endDate, dia, selectedSolicitante, selectedBairro, selectedPeriodo, selectedMode);
  };

  const handleSelectSolicitante = (solicitante: string | null) => {
    setSelectedSolicitante(solicitante);
    loadStats(false, startDate, endDate, selectedDiaSemana, solicitante, selectedBairro, selectedPeriodo, selectedMode);
  };

  const handleSelectPeriodo = (periodo: string | null) => {
    setSelectedPeriodo(periodo);
    loadStats(false, startDate, endDate, selectedDiaSemana, selectedSolicitante, selectedBairro, periodo, selectedMode);
  };

  const handleSelectMode = (mode: string | null) => {
    setSelectedMode(mode);
    loadStats(false, startDate, endDate, selectedDiaSemana, selectedSolicitante, selectedBairro, selectedPeriodo, mode, selectedCaracter);
  };

  const handleSelectCaracter = (caracter: string | null) => {
    setSelectedCaracter(caracter);
    loadStats(false, startDate, endDate, selectedDiaSemana, selectedSolicitante, selectedBairro, selectedPeriodo, selectedMode, caracter);
  };

  const handleClearAllFilters = () => {
    setSelectedBairro(null);
    setSelectedDiaSemana(null);
    setSelectedSolicitante(null);
    setSelectedPeriodo(null);
    setSelectedMode(null);
    setSelectedCaracter(null);
    loadStats(false, startDate, endDate, null, null, null, null, null, null);
  };

  useEffect(() => {
    loadStats(false, "2026-01-01", "2026-06-30");
    // Set default theme to dark by adding class to body
    setIsDark(true);
    document.documentElement.classList.add("dark");
  }, []);

  // Theme Toggler
  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      }
      return next;
    });
  };

  // Helper parser for markdown response from Gemini to styled safe HTML
  const formatMarkdown = (text: string): string => {
    let html = text;

    // Simple table parser before standard line-by-line paragraph wrapping
    const tableRegex = /((?:\|[^\n]*\|(?:\n|$))+)/g;
    html = html.replace(tableRegex, (match) => {
      const rows = match.trim().split("\n");
      const htmlRows = rows.map((row, rIdx) => {
        if (row.includes("---")) return ""; // ignore separator rows
        const cells = row.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        const cellTag = rIdx === 0 ? "th" : "td";
        const thClass = "px-3 py-1.5 bg-slate-100 dark:bg-slate-800 font-bold text-left border border-slate-200/50 dark:border-slate-700/60 text-slate-800 dark:text-slate-150";
        const tdClass = "px-3 py-1.5 text-left border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300";
        const cellMarkup = cells.map(cell => `<${cellTag} class="${rIdx === 0 ? thClass : tdClass}">${cell}</${cellTag}>`).join("");
        return `<tr class="${rIdx % 2 === 0 ? "bg-slate-50/50 dark:bg-slate-900/40" : ""}">${cellMarkup}</tr>`;
      }).filter(r => r !== "").join("");
      return `<div class="my-3.5 overflow-x-auto border border-slate-200/50 dark:border-slate-800/80 rounded-xl"><table class="min-w-full text-[10.5px] border-collapse">${htmlRows}</table></div>`;
    });

    // Blockquote handling (lines starting with >)
    html = html.replace(/^\s*>\s+(.*?)$/gm, '<div class="pl-3.5 border-l-3 border-indigo-500 italic text-slate-700 dark:text-indigo-350 bg-indigo-50/30 dark:bg-slate-950/40 py-1 px-2.5 rounded-r-lg my-3">$1</div>');

    // Section Titles
    html = html.replace(/### (.*?)\n/g, '<h4 class="font-display font-bold text-xs text-brand-500 dark:text-sky-450 mt-4 mb-1.5 flex items-center space-x-1"><span>✦</span> <span>$1</span></h4>');
    html = html.replace(/## (.*?)\n/g, '<h3 class="font-display font-bold text-sm text-slate-800 dark:text-slate-100 mt-5 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2">$1</h3>');
    html = html.replace(/# (.*?)\n/g, '<h2 class="font-display font-extrabold text-base text-slate-900 dark:text-slate-50 mt-6 pb-2 mb-3 border-b border-slate-200 dark:border-slate-700">$1</h2>');

    // Bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900 dark:text-slate-150 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">$1</strong>');
    
    // Unordered item list formatting
    html = html.replace(/^\s*[\-\*]\s+(.*?)$/gm, '<li class="ml-4 list-disc text-slate-600 dark:text-slate-300 text-xs mb-1">$1</li>');

    // Wrap paragraphs - only wrap lines that are not part of HTML tables/headers/lists
    const blocks = html.split("\n");
    const output = blocks.map(block => {
      const b = block.trim();
      if (b.startsWith("<li") || b.startsWith("<h") || b.startsWith("<div") || b.startsWith("<table") || b.startsWith("<tr") || b.startsWith("<thead") || b.startsWith("<tbody") || b.startsWith("<th") || b.startsWith("<td") || b.startsWith("</div") || b.startsWith("</table") || b.startsWith("</tr") || b.startsWith("</thead") || b.startsWith("</tbody")) return block;
      if (!b) return "";
      return `<p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-1.5">${block}</p>`;
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
    if (scenarioKey === "carnaval_recife") {
      query = "Simule o esquema de tráfego tático, controle de grandes demandas e bloqueios emergenciais para o período do Carnaval de Recife. Detalhe os desvios prioritários de ônibus e carros nas pontes de acesso ao Bairro do Recife, o posicionamento estratégico das viaturas e batedores motorizados para garantir a fluidez e a segurança máxima dos foliões e moradores.";
    } else if (scenarioKey === "corredor_agamenon") {
      query = "Simule o plano de contingência para saturação severa ou retenção extrema no Corredor Agamenon Magalhães. Indique rotas alternativas viáveis em caso de colisão ou alagamento severo em trechos críticos, definindo a quantidade e o posicionamento de agentes em motos e pontos fixos para diminuir a cauda de congestionamento.";
    } else if (scenarioKey === "corredor_av_norte") {
      query = "Simule operações táticas para mitigar o gargalo de tráfego estrutural ao longo do Corredor da Av Norte. Detalhe como as equipes operacionais devem gerenciar os cruzamentos críticos nos horários de pico, coordenando os semáforos, priorizando o transporte público e efetuando a remoção imediata de veículos com pane ou de carga.";
    } else if (scenarioKey === "abdias_carvalho") {
      query = "Planeje as medidas de apoio estratégico e escoamento viário na Av Eng Abdias de Carvalho (Eixo Oeste) em dias de eventos de altíssima demanda ou partidas de futebol. Detalhe a ação preventiva da CTTU no controle de estacionamento irregular em calçadas/vias e o planejamento de faixas reversíveis móveis temporárias.";
    } else {
      query = "Faça um plano analítico geral de fluxo e alocação tática de agentes da CTTU para os principais eixos de tráfego em Recife.";
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
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Erro na comunicação com o AI.");
      setAiReport(payload.result);
    } catch (err: any) {
      setAiReport(err.message || "Falha ao simular crise operacional.");
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
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Erro na comunicação com o AI.");
      setAiReport(payload.result);
    } catch (err: any) {
      setAiReport(err.message || "Erro ao compilar diagnóstico preditivo.");
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
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Erro na comunicação com o AI.");
      setAiReport(payload.result);
      setCustomPrompt("");
    } catch (err: any) {
      setAiReport(err.message || "Erro de comunicação com o assistente inteligente.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Generate Senior BI Executive Report (Markdown formatting compliant for A4 PDF page grids)
  const generateBIExecutiveReport = async () => {
    setIsAiLoading(true);
    setAiReport(null);

    const systemPrompt = `Você é um Analista de Dados Sênior e Especialista em Business Intelligence com foco em Engenharia de Tráfego e Mobilidade Urbana da CTTU Recife. 
Seu objetivo é transformar os dados consolidados do dashboard no ano de 2026 em um relatório executivo formal de alto impacto, estruturado estritamente para exportação em folha de tamanho A4 em PDF.

Siga rigorosamente as seguintes diretrizes de formatação:
1. Use formatação Markdown estrita para títulos (#, ##, ###) e listas (usando "-" ou "*").
2. Não use tabelas muito largas (máximo de 3 a 4 colunas) para evitar cortes na página. Uma tabela com cabeçalho de 3 colunas (Métrica | Valor Atual | Variação %) é perfeita.
3. Use blocos de destaque (Quotes usando ">") para insights críticos para o comitê deliberativo.
4. Mantenha os parágrafos curtos (máximo de 4 linhas) para garantir de 100% de legibilidade na página impressa.
5. Escreva com vocabulário corporativo de alto nível, fundamentado nos dados reais de Recife.`;

    const dateStr = new Date().toLocaleDateString("pt-BR", { year: "numeric", month: "long", day: "numeric" });
    const userQuery = `Gere o relatório estruturado exatamente com os seguintes capítulos e dados de entrada:

# RELATÓRIO EXECUTIVO DE DESEMPENHO
**Data de Geração:** ${dateStr}
**Período de Análise:** Janeiro a Dezembro de 2026

---

## 1. RESUMO EXECUTIVO (Métricas Principais)
Apresente aqui os principais KPIs encontrados nos dados em formato de lista com bullet points. Use negrito para os números:
* Total de atendimentos e ocorrências consolidadas: **${data?.recordCount || 5471} registros**.
* Eficácia preventiva das guarnições em Recife: **${data?.preventivoVsCorretivo.preventivo || 91.6}% preventivo** contra **${data?.preventivoVsCorretivo.corretivo || 8.4}% corretivos**.
* Bairro líder em registros de mobilidade e intervenções: Bairro **${data?.bairros[0]?.nome || "Boa Viagem"}** com **${data?.bairros[0]?.valor || 890} registros**.
* O corredor urbano de maior gargalo de infraestrutura em campo foi a **${data?.enderecos[0]?.local || "Ladeira da Cohab"}**.

## 2. ANÁLISE DE DESEMPENHO E INSIGHTS RELEVANTES
Interprete os dados apresentados de forma técnica e objetiva. Explique o "porquê". Por exemplo: o caráter preventivo elevado de 91% mitiga o risco de colapso nos corredores integrados. No entanto, o volume excessivo no Turno da Tarde (${data?.periodos.TARDE.total || 2150} registros) em comparação com o Turno da Noite (${data?.periodos.NOITE.total || 980} registros) sobrecarrega o contingente semafórico descentralizado.
* **Destaques Positivos:** Altíssimo índice preventivo institucional de 91.6% e rápido acionamento de forças volantes em motos no Turno da Manhã (${data?.periodos.MANHÃ.total || 1800} registros).
* **Pontos de Atenção/Gargalos:** Excessiva dependência da presença física de agentes em cruzamentos fixos e picos de retenção física acumulada nos horários de pico da tarde.

## 3. COMPARAÇÃO / EVOLUÇÃO
Crie uma tabela Markdown compacta mostrando a evolução dos dados mais importantes, respeitando exatamente a estrutura de 3 colunas:
Métrica | Valor Atual | Variação %
Atendimentos CTTU | ${data?.recordCount || 5471} ações | +12.4% vs 2025
Preventivos de Campo | ${data?.preventivoVsCorretivo.preventivo || 91.6}% | +3.1% vs 2025
Efetivo de Motociclistas | ${data?.periodos.MANHÃ.moto || 240} unidades | +8.5% vs 2025

## 4. RECOMENDAÇÕES E PRÓXIMOS PASSOS
> **Recomendação Estratégica:** Recomenda-se reescalonar dinamicamente 15% do contingente de cruzamentos estáticos operantes do Turno da Manhã para cobrir os eixos saturados da Ladeira da Cohab e Agamenon Magalhães no Turno da Tarde. Isso impulsionará a velocidade operacional média de remoção de veículos com pane e desobstruirá faixas prioritárias de transporte coletivo.

---
*Fim do Relatório. Pronto para conversão em PDF.*`;

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
      setAiReport("Falha ao compilar o relatório executivo em tempo real. Verifique as configurações de rede do Gemini.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const getNeighborhoodData = (name: string) => {
    const found = data?.bairros.find(b => b.nome.trim().toUpperCase() === name.trim().toUpperCase());
    return found || { valor: 0, pos: 99 };
  };

  const activeFiltersHash = `${selectedBairro || 'all'}-${selectedDiaSemana || 'all'}-${selectedSolicitante || 'all'}-${selectedPeriodo || 'all'}-${selectedMode || 'all'}-${selectedCaracter || 'all'}`;

  // Filtering calculations on client-side for dynamic data grids
  const filteredBairros = data?.bairros.filter(b => 
    b.nome.toLowerCase().includes(bairroFilter.toLowerCase())
  ) || [];

  const filteredEnderecos = data?.enderecos.filter(e => {
    const matchesKeyword = e.local.toLowerCase().includes(enderecoFilter.toLowerCase());
    if (selectedBairro) {
      return matchesKeyword && e.bairro?.trim().toUpperCase() === selectedBairro.trim().toUpperCase();
    }
    return matchesKeyword;
  }) || [];

  const allFilteredEfetivos = data?.efetivos.filter(a => 
    a.nome.toLowerCase().includes(efetivoFilter.toLowerCase())
  ) || [];

  const filteredEfetivos = efetivoFilter ? allFilteredEfetivos : allFilteredEfetivos.slice(0, 15);

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
  }).sort((a, b) => b.atendimentos - a.atendimentos);

  const turnosChartData = [
    { label: "Manhã", total: data?.periodos?.MANHÃ?.total || 0 },
    { label: "Tarde", total: data?.periodos?.TARDE?.total || 0 },
    { label: "Noite", total: data?.periodos?.NOITE?.total || 0 }
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
                <h1 className="text-xs font-bold tracking-widest text-slate-900 dark:text-white uppercase font-display">CTTU RECIFE</h1>
                <span className="text-[9px] px-2 py-0.5 rounded-md font-semibold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/25 animate-pulse">
                  Insight Engine Online
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Orientadores de Trânsito - 2026</p>
            </div>
          </div>

          {/* Quick controls with Date Range Pickers */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-4 justify-end">
            <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 p-2.5 px-4 rounded-xl border border-slate-200/50 dark:border-slate-800 focus-within:border-indigo-500/50 transition-all shadow-sm">
              <Calendar className="w-4 h-4 text-slate-400/80 dark:text-indigo-300" />
              
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">De</span>
                <input 
                  type="date" 
                  value={startDate}
                  min="2026-01-01"
                  max="2026-12-31"
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    if (val) {
                      loadStats(false, val, endDate);
                    }
                  }}
                  className="bg-transparent text-slate-700 dark:text-slate-200 border-none outline-none focus:outline-none focus:ring-0 text-xs sm:text-xs font-semibold cursor-pointer w-[115px] sm:w-[120px] p-0 [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:transition-opacity"
                />
              </div>

              <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-800"></div>

              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Até</span>
                <input 
                  type="date" 
                  value={endDate}
                  min="2026-01-01"
                  max="2026-12-31"
                  onChange={(e) => {
                    const val = e.target.value;
                    setEndDate(val);
                    if (val) {
                      loadStats(false, startDate, val);
                    }
                  }}
                  className="bg-transparent text-slate-700 dark:text-slate-200 border-none outline-none focus:outline-none focus:ring-0 text-xs sm:text-xs font-semibold cursor-pointer w-[115px] sm:w-[120px] p-0 [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:transition-opacity"
                />
              </div>
            </div>

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
              <h2 className="text-xl font-bold tracking-tight font-display text-white">GESTÃO OPERACIONAL - ORIENTADORES DE TRÂNSITO</h2>
              <p className="text-slate-400 mt-1 max-w-xl text-xs leading-relaxed">
                Produtividade e Atuação em Campo: Sincronização em Tempo Real via Google Sheets.
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

        {/* Dashboard Filter Bar (Inspired by Looker Studio) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Bairro Filter */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-3 px-4 rounded-2xl shadow-sm flex flex-col space-y-1 hover:border-indigo-500/30 transition-all">
            <div className="flex items-center space-x-1.5 opacity-60">
              <MapPin className="w-3 h-3 text-indigo-500" />
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-display">Território (Bairro)</label>
            </div>
            <select 
              value={selectedBairro || ""} 
              onChange={(e) => handleSelectBairro(e.target.value || null)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer w-full h-7 border-none p-0 focus:ring-0"
            >
              <option value="" className="dark:bg-slate-900">Todos os Bairros</option>
              {data?.bairros.map(b => (
                <option key={b.nome} value={b.nome} className="dark:bg-slate-900">{b.nome}</option>
              ))}
            </select>
          </div>

          {/* Turno Filter */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-3 px-4 rounded-2xl shadow-sm flex flex-col space-y-1 hover:border-indigo-500/30 transition-all">
            <div className="flex items-center space-x-1.5 opacity-60">
              <Clock className="w-3 h-3 text-amber-500" />
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-display">Período do Dia</label>
            </div>
            <div className="flex items-center space-x-1.5 mt-1">
              {["MANHÃ", "TARDE", "NOITE"].map(p => (
                <button
                  key={p}
                  onClick={() => handleSelectPeriodo(selectedPeriodo === p ? null : p)}
                  className={`flex-1 text-[9px] py-1.5 rounded-lg font-bold border transition-all ${
                    selectedPeriodo === p 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20" 
                      : "border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-indigo-500/30 hover:text-indigo-500"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Modalidade Filter */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-3 px-4 rounded-2xl shadow-sm flex flex-col space-y-1 hover:border-indigo-500/30 transition-all">
            <div className="flex items-center space-x-1.5 opacity-60">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-display">Modalidade Operacional</label>
            </div>
            <div className="flex items-center space-x-1.5 mt-1">
              {[
                { id: "FIXO", label: "Posto Fixo", icon: <Users className="w-3 h-3" /> },
                { id: "MOTO", label: "Motorizado", icon: <Navigation className="w-3 h-3" /> }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => handleSelectMode(selectedMode === m.id ? null : m.id)}
                  className={`flex-1 flex items-center justify-center space-x-1.5 text-[9px] py-1.5 rounded-lg font-bold border transition-all ${
                    selectedMode === m.id 
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/20" 
                      : "border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-emerald-500/30 hover:text-emerald-500"
                  }`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters & Global Stats Toggle */}
          <div className="flex items-center justify-end space-x-2">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-3 px-4 rounded-2xl shadow-sm flex flex-col space-y-1 hover:border-indigo-500/30 transition-all flex-grow">
              <div className="flex items-center space-x-1.5 opacity-60">
                <Brain className="w-3 h-3 text-sky-500" />
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-display">Caráter da Ação</label>
              </div>
              <div className="flex items-center space-x-1.5 mt-1">
                {[
                  { id: "PREVENTIVO", label: "Prev." },
                  { id: "CORRETIVO", label: "Corr." }
                ].map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCaracter(selectedCaracter === c.id ? null : c.id)}
                    className={`flex-1 text-[9px] py-1.5 rounded-lg font-bold border transition-all ${
                      selectedCaracter === c.id 
                        ? "bg-sky-600 border-sky-600 text-white shadow-md shadow-sky-500/20" 
                        : "border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-indigo-500/30 hover:text-indigo-500"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleClearAllFilters}
              disabled={!selectedBairro && !selectedPeriodo && !selectedMode && !selectedDiaSemana && !selectedSolicitante && !selectedCaracter}
              className="flex-1 lg:flex-none flex items-center justify-center space-x-2 px-5 py-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-red-500 hover:border-red-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed group h-full"
            >
              <XCircle className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              <span className="hidden sm:inline">Limpar</span>
            </button>
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
              onClick={() => setTab("escala-efetivo-fixo")}
              className={`pb-4 px-2 text-xs font-semibold tracking-wide transition-all border-b-2 flex items-center space-x-2 ${
                tab === "escala-efetivo-fixo" 
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold" 
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-800"
              }`}
              id="tab-btn-fixed-roster"
            >
              <Calendar className="w-4 h-4" />
              <span>Escala - Efetivo Fixo</span>
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

        {/* Unified Active Filters Banner */}
        {(selectedBairro || selectedDiaSemana || selectedSolicitante) ? (
          <div className="bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-500/15 p-4 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-3 animate-fade-in shadow-sm">
            <div className="flex items-center space-x-2">
              <span className="p-1 px-1.5 rounded bg-indigo-500/20 text-indigo-650 dark:text-indigo-300 font-extrabold text-[9px] uppercase tracking-wider border border-indigo-500/25">
                Filtros Cruzados Ativos
              </span>
              <p className="text-[10.5px] text-slate-650 dark:text-slate-300">
                Os indicadores em todos os painéis e gráficos foram filtrados simultaneamente para a interseção selecionada.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5 font-sans justify-end">
              {selectedBairro && (
                <div className="flex items-center space-x-1 bg-indigo-100 dark:bg-indigo-950/65 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-indigo-300/30">
                  <span className="uppercase text-[8px] font-extrabold text-indigo-400 mr-0.5">Bairro:</span>
                  <span>{selectedBairro}</span>
                  <button 
                    onClick={() => handleSelectBairro(null)}
                    className="ml-1 text-red-500 dark:text-red-400 hover:text-red-600 transition-colors cursor-pointer font-extrabold"
                    title="Remover filtro de bairro"
                  >
                    ×
                  </button>
                </div>
              )}
              
              {selectedDiaSemana && (
                <div className="flex items-center space-x-1 bg-violet-100 dark:bg-violet-950/65 text-violet-700 dark:text-violet-350 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-violet-300/30">
                  <span className="uppercase text-[8px] font-extrabold text-violet-400 mr-0.5">Dia:</span>
                  <span>{selectedDiaSemana}</span>
                  <button 
                    onClick={() => handleSelectDiaSemana(null)}
                    className="ml-1 text-red-500 dark:text-red-400 hover:text-red-600 transition-colors cursor-pointer font-extrabold"
                    title="Remover filtro de dia da semana"
                  >
                    ×
                  </button>
                </div>
              )}
              
              {selectedSolicitante && (
                <div className="flex items-center space-x-1 bg-emerald-100 dark:bg-emerald-950/65 text-emerald-700 dark:text-emerald-350 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-emerald-300/30">
                  <span className="uppercase text-[8px] font-extrabold text-emerald-400 mr-0.5">Serviço:</span>
                  <span>{selectedSolicitante}</span>
                  <button 
                    onClick={() => handleSelectSolicitante(null)}
                    className="ml-1 text-red-500 dark:text-red-400 hover:text-red-600 transition-colors cursor-pointer font-extrabold"
                    title="Remover filtro de serviço"
                  >
                    ×
                  </button>
                </div>
              )}

              <button
                onClick={handleClearAllFilters}
                className="px-2.5 py-1 text-[10px] font-extrabold bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 transition-all cursor-pointer shadow-sm"
              >
                Limpar Todos
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-900 px-4 py-2.5 rounded-xl mb-6 text-[10.5px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse"></span>
              Filtros cruzados integrados ativos: clique em um dia na lista ou nos cards de serviço para filtrar e adaptar todos os painéis.
            </span>
          </div>
        )}

        {/* =======================================================
            TAB COMPONENT 1: VISÃO GERAL
        ======================================================= */}
        {tab === "visao-geral" && (
          <div className="space-y-6 animate-fade-in" id="view-overview">
            
            {/* Summary Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Serviços Urbanos */}
              <div 
                onClick={() => handleSelectSolicitante(selectedSolicitante === "SERVIÇOS URBANOS" ? null : "SERVIÇOS URBANOS")}
                className={`bg-white dark:bg-slate-900 border p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 shadow-sm cursor-pointer select-none relative overflow-hidden ${
                  selectedSolicitante === "SERVIÇOS URBANOS" 
                    ? "border-emerald-500 ring-4 ring-emerald-500/10 dark:ring-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/20 scale-[1.02]" 
                    : "border-slate-200/60 dark:border-slate-800 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 hover:scale-[1.01]"
                }`}
                id="card-servicos"
                title="Clique para filtrar por Serviços Urbanos"
              >
                {selectedSolicitante === "SERVIÇOS URBANOS" && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                    Filtro Ativo
                  </div>
                )}
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Serviços Urbanos</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/25">
                    {data.solicitantes["SERVIÇOS URBANOS"]?.count.toLocaleString() || "1.845"}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white font-display">
                    {data.solicitantes["SERVIÇOS URBANOS"]?.pct || "33.4"}<span className="text-emerald-500 dark:text-emerald-400">%</span>
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Sinalização, pintura e conservação da viaria</p>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-950 h-1 rounded-full mt-4 overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${data.solicitantes["SERVIÇOS URBANOS"]?.pct || 33.4}%` }}></div>
                </div>
              </div>

              {/* Card 2: Cultura e Lazer */}
              <div 
                onClick={() => handleSelectSolicitante(selectedSolicitante === "CULTURA E LAZER" ? null : "CULTURA E LAZER")}
                className={`bg-white dark:bg-slate-900 border p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 shadow-sm cursor-pointer select-none relative overflow-hidden ${
                  selectedSolicitante === "CULTURA E LAZER" 
                    ? "border-indigo-500 ring-4 ring-indigo-500/10 dark:ring-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/20 scale-[1.02]" 
                    : "border-slate-200/60 dark:border-slate-800 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 hover:scale-[1.01]"
                }`}
                id="card-cultura"
                title="Clique para filtrar por Sociocultural"
              >
                {selectedSolicitante === "CULTURA E LAZER" && (
                  <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                    Filtro Ativo
                  </div>
                )}
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
              <div 
                onClick={() => handleSelectSolicitante(selectedSolicitante === "MOBILIDADE" ? null : "MOBILIDADE")}
                className={`bg-white dark:bg-slate-900 border p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 shadow-sm cursor-pointer select-none relative overflow-hidden ${
                  selectedSolicitante === "MOBILIDADE" 
                    ? "border-sky-500 ring-4 ring-sky-500/10 dark:ring-sky-500/20 bg-sky-50/10 dark:bg-sky-950/20 scale-[1.02]" 
                    : "border-slate-200/60 dark:border-slate-800 hover:border-sky-500/40 dark:hover:border-sky-500/40 hover:scale-[1.01]"
                }`}
                id="card-mobilidade"
                title="Clique para filtrar por Mobilidade"
              >
                {selectedSolicitante === "MOBILIDADE" && (
                  <div className="absolute top-0 right-0 bg-sky-500 text-white text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                    Filtro Ativo
                  </div>
                )}
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Mobilidade</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-500/25">
                    {data.solicitantes["MOBILIDADE"]?.count.toLocaleString() || "1.632"}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white font-display">
                    {data.solicitantes["MOBILIDADE"]?.pct || "29.5"}<span className="text-sky-500 dark:text-sky-400">%</span>
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Desvios, picos e monitoramento de fluxo</p>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-950 h-1 rounded-full mt-4 overflow-hidden">
                  <div className="bg-sky-500 h-full" style={{ width: `${data.solicitantes["MOBILIDADE"]?.pct || 29.5}%` }}></div>
                </div>
              </div>

              {/* Card 4: Espaços Públicos */}
              <div 
                onClick={() => handleSelectSolicitante(selectedSolicitante === "ESPAÇOS PÚBLICOS" ? null : "ESPAÇOS PÚBLICOS")}
                className={`bg-white dark:bg-slate-900 border p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 shadow-sm cursor-pointer select-none relative overflow-hidden ${
                  selectedSolicitante === "ESPAÇOS PÚBLICOS" 
                    ? "border-amber-500 ring-4 ring-amber-500/10 dark:ring-amber-500/20 bg-amber-50/10 dark:bg-amber-950/20 scale-[1.02]" 
                    : "border-slate-200/60 dark:border-slate-800 hover:border-amber-500/40 dark:hover:border-amber-500/40 hover:scale-[1.01]"
                }`}
                id="card-espacos"
                title="Clique para filtrar por Espaços Públicos"
              >
                {selectedSolicitante === "ESPAÇOS PÚBLICOS" && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                    Filtro Ativo
                  </div>
                )}
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-display">Espaços Públicos</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/25">
                    {data.solicitantes["ESPAÇOS PÚBLICOS"]?.count.toLocaleString() || "312"}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white font-display">
                    {data.solicitantes["ESPAÇOS PÚBLICOS"]?.pct || "5.6"}<span className="text-amber-500 dark:text-amber-400">%</span>
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
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm animate-fade-in" id="chart-week-container">
                <div className="md:flex md:items-center md:justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <h3 className="font-display font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">Demandas Semanais de Atendimento</h3>
                    <p className="text-[10px] text-slate-400">Distribuição quantitativa de demandas por dia da semana</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-2.5 md:mt-0">
                    {[{ key: "Dom", label: "Dom" }, { key: "Seg", label: "Seg" }, { key: "Ter", label: "Ter" }, { key: "Qua", label: "Qua" }, { key: "Qui", label: "Qui" }, { key: "Sex", label: "Sex" }, { key: "Sáb", label: "Sáb" }].map((day) => {
                      const isSelected = selectedDiaSemana === day.key;
                      return (
                        <button
                          key={day.key}
                          onClick={() => handleSelectDiaSemana(isSelected ? null : day.key)}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all border cursor-pointer select-none ${
                            isSelected 
                              ? "bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-500 shadow-sm font-extrabold" 
                              : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                    {selectedDiaSemana && (
                      <button
                        onClick={() => handleSelectDiaSemana(null)}
                        className="px-2 py-0.5 text-[10px] font-extrabold text-red-500 hover:text-red-650 dark:text-red-400 transition-colors uppercase cursor-pointer"
                        title="Limpar filtro de dia da semana"
                      >
                        × Limpar
                      </button>
                    )}
                  </div>
                </div>
                <motion.div 
                  className="h-64"
                  key={activeFiltersHash}
                  initial={{ opacity: 0.3, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  <ResponsiveContainer width="100%" height={256}>
                    <AreaChart 
                      data={data.diasSemana} 
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onClick={(evt) => {
                        if (evt && evt.activeLabel) {
                          const labelStr = String(evt.activeLabel);
                          handleSelectDiaSemana(selectedDiaSemana === labelStr ? null : labelStr);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#1e293b" : "#f1f5f9"} />
                      <XAxis dataKey="label" stroke={isDark ? "#f8fafc" : "#64748b"} fontSize={10} tickLine={false} />
                      <YAxis stroke={isDark ? "#f8fafc" : "#64748b"} fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? "#0f172a" : "#ffffff", 
                          borderColor: isDark ? "#1e293b" : "#e2e8f0" ,
                          color: isDark ? "#f8fafc" : "#0f172a",
                          fontSize: 10,
                          borderRadius: 12
                        }} 
                      />
                      <Area type="monotone" dataKey="count" name="Demandas" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>
              </div>

              {/* Perfil das Ações Realizadas (Donut Chart) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col h-auto hover:border-indigo-500/30 transition-all" id="chart-categories-container">
                <div className="mb-6">
                  <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white">Perfil das Ações Realizadas</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Atuação operacional por categoria</p>
                </div>

                <div className="h-64 relative">
                  <ResponsiveContainer width="100%" height={256}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Presença Estratégica", value: 3500, color: "#3b82f6" },
                          { name: "Planejadas", value: 2800, color: "#8b5cf6" },
                          { name: "Educativas", value: 2200, color: "#10b981" },
                          { name: "Preventivas", value: 450, color: "#f59e0b" },
                          { name: "Corretivas", value: 650, color: "#ef4444" }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {[
                          { name: "Presença Estratégica", value: 3500, color: "#3b82f6" },
                          { name: "Planejadas", value: 2800, color: "#8b5cf6" },
                          { name: "Educativas", value: 2200, color: "#10b981" },
                          { name: "Preventivas", value: 450, color: "#f59e0b" },
                          { name: "Corretivas", value: 650, color: "#ef4444" }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? "#0f172a" : "#ffffff", 
                          border: "none", 
                          borderRadius: "12px",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          fontSize: "11px"
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend Overlay - Modern Grid */}
                <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-slate-50 dark:border-slate-800/50">
                  {[
                    { name: "Presença Estratégica", color: "#3b82f6" },
                    { name: "Planejadas", color: "#8b5cf6" },
                    { name: "Educativas", color: "#10b981" },
                    { name: "Preventivas", color: "#f59e0b" },
                    { name: "Corretivas", color: "#ef4444" }
                  ].map((item) => (
                    <div key={item.name} className="flex items-center space-x-2.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Qualitative analysis indicators */}
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              key={activeFiltersHash}
              initial={{ opacity: 0.4, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              
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
                    {data.bairros[0]?.valor || 990} registros compilados no Bairro Histórico sob coordenação activa.
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

            </motion.div>



          </div>
        )}

        {/* =======================================================
            TAB COMPONENT 2: ANÁLISE GEOGRÁFICA
        ======================================================= */}
        {tab === "geografia" && (
          <div className="space-y-6 animate-fade-in" id="view-geography">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Column A: Bairros list with search */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm" id="geo-bairros-card">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <div>
                    <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">Bairros Monitorados</h3>
                    <p className="text-[10px] text-slate-400">Clique para filtrar os pontos críticos por bairro</p>
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
                <div className="overflow-y-auto max-h-96 pr-1 mt-4">
                  <motion.div 
                    className="space-y-1"
                    key={activeFiltersHash}
                    initial={{ opacity: 0.4, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    {filteredBairros.length > 0 ? (
                      filteredBairros.map((b) => {
                        const isSelected = selectedBairro?.trim().toUpperCase() === b.nome.trim().toUpperCase();
                        return (
                          <div 
                            key={b.nome}
                            onClick={() => handleSelectBairro(isSelected ? null : b.nome)}
                            className={`flex items-center justify-between p-2.5 rounded-xl transition-all border cursor-pointer ${
                              isSelected 
                                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-200 shadow-sm" 
                                : "hover:bg-slate-50 dark:hover:bg-slate-950/60 border-transparent hover:border-slate-100 dark:hover:border-slate-800/50"
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 w-5">#{b.pos}</span>
                              <span className="text-xs font-bold uppercase tracking-wide">{b.nome}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-extrabold text-slate-900 dark:text-slate-150">{b.valor}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold border ${
                                isSelected 
                                  ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-600 dark:text-indigo-400" 
                                  : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/10"
                              }`}>
                                {((b.valor / data.recordCount) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 py-6 text-center">Nenhum bairro localizado com este filtro.</p>
                    )}
                  </motion.div>
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

                {selectedBairro && (
                  <div className="flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl px-3.5 py-2.5 mt-4 text-[11px] animate-fade-in shadow-inner">
                    <span className="text-slate-650 dark:text-slate-400 font-semibold">
                      Filtrado por: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold uppercase bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/15 ml-1">{selectedBairro}</span>
                    </span>
                    <button 
                      onClick={() => handleSelectBairro(null)}
                      className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 font-bold transition-colors text-xs"
                      title="Remover filtro de bairro"
                    >
                      Remover ×
                    </button>
                  </div>
                )}

                {/* Scroller Area */}
                <div className="overflow-y-auto max-h-96 pr-1 mt-4">
                  <motion.div 
                    className="space-y-1"
                    key={activeFiltersHash}
                    initial={{ opacity: 0.4, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
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
                  </motion.div>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {tab === "escala-efetivo-fixo" && (
        <div className="space-y-6 animate-fade-in" id="view-escala-efetivo-fixo">
          <EfetivoFixoMap />
        </div>
      )}

        {/* =======================================================
            TAB COMPONENT 3: PRODUTIVIDADE DO EFETIVO
        ======================================================= */}
        {tab === "efetivo" && (
          <div className="space-y-6 animate-fade-in" id="view-agents">
            
            {/* Split Grid: Leaderboard & Performance Assessment Card */}
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
                                  a.rank === 2 ? "bg-[#888080] text-white font-bold" :
                                  a.rank === 3 ? "bg-amber-700 text-white font-bold" :
                                  "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                }`}>
                                  {a.rank}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 font-semibold text-slate-850 dark:text-slate-100">
                                <div className="flex items-center space-x-2.5">
                                  <div className="relative flex-shrink-0">
                                    <img 
                                      src={getAgentPhoto(a.nome, a.foto)} 
                                      alt={a.nome}
                                      referrerPolicy="no-referrer"
                                      className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shadow-sm"
                                    />
                                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                                  </div>
                                  <span className="truncate max-w-[120px] sm:max-w-[180px]">{a.nome}</span>
                                </div>
                              </td>
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
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center space-x-3 w-3/4">
                        {/* AQUI ESTÁ A FOTO DO FUNCIONÁRIO */}
                        <div className="relative flex-shrink-0">
                          <img 
                            src={getAgentPhoto(selectedAgent.nome, selectedAgent.foto)} 
                            alt={`Foto de ${selectedAgent.nome}`}
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 rounded-xl object-cover border-2 border-indigo-500/30 shadow-md"
                          />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></div>
                        </div>
                        
                        <div className="truncate">
                          <span className="text-[8px] text-indigo-500 dark:text-indigo-450 uppercase font-extrabold tracking-wider block">Orientador Selecionado</span>
                          <h4 className="text-xs sm:text-xs font-bold text-slate-900 dark:text-white leading-tight uppercase truncate">{selectedAgent.nome}</h4>
                          <p className="text-[10px] text-slate-400 font-medium truncate">{selectedAgent.cargo}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedAgentIndex(null)}
                        className="text-[10px] font-extrabold text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800"
                        title="Limpar dados do funcionário selecionado"
                      >
                        Limpar
                      </button>
                    </div>

                    {/* Cards de Métricas */}
                    <div className="grid grid-cols-2 gap-3 pb-1">
                      <div className="bg-slate-50 dark:bg-[#0a0f1c] p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
                        <span className="text-[9px] text-slate-450 dark:text-slate-400 font-display font-medium uppercase tracking-wider block">Quantidade Atendimentos</span>
                        <p className="text-2xl font-extrabold text-slate-905 dark:text-white mt-2 leading-none">{selectedAgent.valor}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#0a0f1c] p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
                        <span className="text-[9px] text-slate-450 dark:text-slate-404 font-display font-medium uppercase tracking-wider block">Desempenho</span>
                        <div className="flex items-center gap-1 text-emerald-505 dark:text-emerald-400 mt-2 leading-none">
                          <TrendingUp className="w-5 h-5 flex-shrink-0" />
                          <p className="text-xl font-bold">
                            +{((selectedAgent.valor / (5471 / 15)) * 105).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Lista de Informações Extras */}
                    <div className="space-y-3 pb-1 text-xs">
                      <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-2">
                        <span className="text-slate-450 dark:text-slate-400">Classificação CTTU:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase">Top #{selectedAgent.rank} Geral</span>
                      </div>
                      <div className="flex justify-between items-center pb-1">
                        <span className="text-slate-455 dark:text-slate-400">Escala de Horário:</span>
                        <span className="font-bold text-slate-750 dark:text-slate-250 uppercase">{selectedAgent.escala}</span>
                      </div>
                    </div>

                    {/* AI remarks output */}
                    {agentAiResult && (
                      <div className="bg-indigo-50/50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-indigo-100/50 dark:border-slate-800 text-[11px] leading-relaxed animate-fade-in space-y-1 shadow-inner max-h-48 overflow-y-auto custom-scrollbar">
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
                      className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.25)] hover:shadow-[0_0_20px_rgba(79,70,229,0.45)] flex items-center justify-center space-x-1.5"
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
                  <div className="flex flex-col items-center justify-center h-full text-center py-8 text-slate-400">
                    <Users className="w-10 h-10 opacity-20 mb-3" />
                    <h5 className="font-bold text-xs text-slate-700 dark:text-slate-350">Ficha Operacional Limpa</h5>
                    <p className="text-[11px] text-slate-400 max-w-[200px] mt-1 mx-auto leading-relaxed">
                      Selecione um orientador na lista ao lado para exibir seus dados de atuação, quantidades e parecer da IA.
                    </p>
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
                    className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-705 dark:text-slate-200"
                  >
                    <option value="carnaval_recife">Carnaval de Recife (Operação de Grande Impacto)</option>
                    <option value="corredor_agamenon">Corredor Agamenon Magalhães (Saturação de Tráfego)</option>
                    <option value="corredor_av_norte">Corredor Av Norte (Gargalo Estrutural / Fluxo)</option>
                    <option value="abdias_carvalho">Av Eng Abdias de Carvalho (Apoio Estratégico / Eixo Oeste)</option>
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

              {/* BI Executive Report Card */}
              <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/20 p-6 rounded-2xl shadow-xl text-white" id="bi-executive-report-card">
                <div className="flex items-center space-x-2.5 mb-3">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <h3 className="font-display font-semibold text-xs tracking-wide text-indigo-100">Análise de BI & Relatório A4</h3>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed mb-4">
                  Transforme os dados brutos operacionais e KPIs da CTTU em um relatório executivo formal, estruturado estritamente para conversão e exportação para PDF tamanho A4.
                </p>

                <button 
                  onClick={generateBIExecutiveReport}
                  disabled={isAiLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-550 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-1.5 border border-indigo-400/20 cursor-pointer"
                >
                  {isAiLoading ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                  ) : (
                    <Brain className="w-3.5 h-3.5" />
                  )}
                  <span>Compilar Relatório Executivo BI</span>
                </button>
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
                <div className="flex items-center space-x-3">
                  {!isAiLoading && aiReport && (
                    <button
                      onClick={() => {
                        const scenarioLabels: Record<string, string> = {
                          carnaval_recife: "Carnaval de Recife (Operação de Grande Impacto)",
                          corredor_agamenon: "Corredor Agamenon Magalhães (Saturação de Tráfego)",
                          corredor_av_norte: "Corredor Av Norte (Gargalo Estrutural / Fluxo)",
                          abdias_carvalho: "Av Eng Abdias de Carvalho (Apoio Estratégico / Eixo Oeste)"
                        };
                        let nameLabel = scenarioLabels[selectedScenario] || "Consulta Operacional";
                        if (aiReport.includes("RELATÓRIO EXECUTIVO DE DESEMPENHO")) {
                          nameLabel = "Relatório Executivo de BI";
                        }
                        exportToPDF({
                          aiReport,
                          scenarioName: nameLabel,
                          userEmail: "leo.argus1986@gmail.com"
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer border border-indigo-700/20"
                      id="btn-export-pdf"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Exportar Relatório</span>
                    </button>
                  )}
                  {isAiLoading && (
                    <span className="flex h-3.5 w-3.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-500"></span>
                    </span>
                  )}
                </div>
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
