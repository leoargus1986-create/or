import React, { useState, useMemo } from "react";
import { 
  Search, 
  MapPin, 
  Phone, 
  Clock, 
  Compass, 
  ExternalLink, 
  Navigation, 
  Filter, 
  Users,
  Layers,
  Sparkles,
  Info
} from "lucide-react";
import { EFETIVO_FIXO_DATA, EfetivoFixoPosto } from "../data/efetivoFixo";

export default function EfetivoFixoMap() {
  const [data, setData] = useState<EfetivoFixoPosto[]>(EFETIVO_FIXO_DATA);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAvenue, setSelectedAvenue] = useState<string>("ALL");
  const [selectedShift, setSelectedShift] = useState<string>("ALL");
  const [selectedPost, setSelectedPost] = useState<EfetivoFixoPosto | null>(EFETIVO_FIXO_DATA[0]);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/efetivo-fixo");
        if (response.ok) {
          const jsonData = await response.json();
          if (Array.isArray(jsonData) && jsonData.length > 0) {
            setData(jsonData);
            // Auto-select first item if current selection is not in new data
            setSelectedPost(prev => {
              if (!prev) return jsonData[0];
              const stillExists = jsonData.find(p => p.nome === prev.nome);
              return stillExists || jsonData[0];
            });
          }
        }
      } catch (error) {
        console.error("Error fetching efetivo data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Group posts by unique position key
  const postsByLocation = useMemo(() => {
    const map = new Map<string, EfetivoFixoPosto[]>();
    data.forEach(p => {
      let key = "";
      if (p.lat !== null && p.lng !== null) {
        key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
      } else if (p.localApoio && p.localApoio !== "À DISPOSIÇÃO / ITINERANTE") {
        key = `${p.localApoio.trim().toUpperCase()}||${p.especifico.trim().toUpperCase()}`;
      }
      if (key) {
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(p);
      }
    });
    return map;
  }, [data]);

  const getPartnersForPost = (p: EfetivoFixoPosto) => {
    let key = "";
    if (p.lat !== null && p.lng !== null) {
      key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
    } else if (p.localApoio && p.localApoio !== "À DISPOSIÇÃO / ITINERANTE") {
      key = `${p.localApoio.trim().toUpperCase()}||${p.especifico.trim().toUpperCase()}`;
    }
    if (!key) return [];
    return (postsByLocation.get(key) || []).filter(other => other.nome !== p.nome);
  };

  const selectedPartners = useMemo(() => {
    if (!selectedPost) return [];
    return getPartnersForPost(selectedPost);
  }, [selectedPost, postsByLocation]);

  // Extract unique avenues for filter dropdown
  const uniqueAvenues = useMemo(() => {
    const avenues = new Set<string>();
    data.forEach(p => {
      if (p.localApoio && p.localApoio !== "À DISPOSIÇÃO / ITINERANTE") {
        avenues.add(p.localApoio);
      }
    });
    return ["ALL", ...Array.from(avenues).sort()];
  }, [data]);

  // Filtered dataset
  const filteredPosts = useMemo(() => {
    return data.filter(p => {
      const matchesSearch = 
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.especifico.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.localApoio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.contato.includes(searchTerm);
      
      const matchesAvenue = 
        selectedAvenue === "ALL" || 
        p.localApoio === selectedAvenue;
      
      const matchesShift = 
        selectedShift === "ALL" || 
        (selectedShift === "MANHA" && p.horario.includes("7 as 13h")) ||
        (selectedShift === "TARDE" && p.horario.includes("19h30"));

      return matchesSearch && matchesAvenue && matchesShift;
    });
  }, [searchTerm, selectedAvenue, selectedShift]);

  // Statistics for the current view
  const stats = useMemo(() => {
    const total = filteredPosts.length;
    const withCoords = filteredPosts.filter(p => p.lat !== null).length;
    const morningShift = filteredPosts.filter(p => p.horario.includes("7 as 13h")).length;
    const afternoonShift = filteredPosts.filter(p => p.horario.includes("19h30") || p.horario.includes("13:30")).length;

    // Set of physical coordinates / location names
    const uniquePositionsSet = new Set<string>();
    filteredPosts.forEach(p => {
      let key = "";
      if (p.lat !== null && p.lng !== null) {
        key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
      } else if (p.localApoio && p.localApoio !== "À DISPOSIÇÃO / ITINERANTE") {
        key = `${p.localApoio.trim().toUpperCase()}||${p.especifico.trim().toUpperCase()}`;
      }
      if (key) {
        uniquePositionsSet.add(key);
      }
    });
    const uniquePositions = uniquePositionsSet.size;

    // Count double posts in current view
    const filteredPositionsCounts = new Map<string, number>();
    filteredPosts.forEach(p => {
      let key = "";
      if (p.lat !== null && p.lng !== null) {
        key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
      } else if (p.localApoio && p.localApoio !== "À DISPOSIÇÃO / ITINERANTE") {
        key = `${p.localApoio.trim().toUpperCase()}||${p.especifico.trim().toUpperCase()}`;
      }
      if (key) {
        filteredPositionsCounts.set(key, (filteredPositionsCounts.get(key) || 0) + 1);
      }
    });

    let doublePosts = 0;
    filteredPositionsCounts.forEach((count) => {
      if (count > 1) {
        doublePosts++;
      }
    });

    return { total, withCoords, morningShift, afternoonShift, uniquePositions, doublePosts };
  }, [filteredPosts]);

  const handleCopyCoords = (lat: number, lng: number) => {
    navigator.clipboard.writeText(`${lat}, ${lng}`);
    // Optional feedback could be added here
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950/40 rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800/80 space-y-6 shadow-sm">
      
      {/* Header and overview of fixed deploy */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-450 uppercase tracking-widest font-display">Relação Nominal e Cartografia</span>
          </div>
          <h2 className="text-xl font-display font-semibold text-slate-900 dark:text-white mt-1">Campo de Atuação do Efetivo Fixo</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Escala geral, horários, contatos e georreferenciamento dos Orientadores de Trânsito em Postos Fixos.
          </p>
        </div>

        {/* Stats strip */}
        <div className="flex items-center space-x-4 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-850 p-3 rounded-2xl shadow-sm text-xs">
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 block font-medium">Total Agentes</span>
            <span className="font-black text-slate-850 dark:text-white text-base">{stats.total}</span>
          </div>
          <div className="h-8 border-l border-slate-100 dark:border-slate-800"></div>
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 block font-medium">Pontos Únicos</span>
            <span className="font-black text-indigo-600 dark:text-indigo-400 text-base">{stats.uniquePositions}</span>
          </div>
          <div className="h-8 border-l border-slate-100 dark:border-slate-800"></div>
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 block font-medium">Pontos em Dupla</span>
            <span className="font-black text-amber-600 dark:text-amber-450 text-base">{stats.doublePosts}</span>
          </div>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
        
        {/* Search input */}
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, logradouro, contato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 text-xs py-2.5 pl-9 pr-4 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:text-slate-100"
          />
        </div>

        {/* Avenue dropdown */}
        <div className="relative">
          <Filter className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <select
            value={selectedAvenue}
            onChange={(e) => setSelectedAvenue(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 text-xs py-2.5 pl-9 pr-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:text-slate-100 appearance-none cursor-pointer uppercase font-semibold text-slate-600 dark:text-slate-300"
          >
            <option value="ALL">Todas as Vias</option>
            {uniqueAvenues.filter(a => a !== "ALL").map(av => (
              <option key={av} value={av}>{av}</option>
            ))}
          </select>
        </div>

        {/* Shift selector */}
        <div className="flex bg-slate-50 dark:bg-slate-950/85 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
          {[
            { id: "ALL", label: "Geral" },
            { id: "MANHA", label: "7h-13h" },
            { id: "TARDE", label: "13h-20h" }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedShift(opt.id)}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                selectedShift === opt.id
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Layout: Roster List vs Map Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Roster List Panel (7 cols) */}
        <div className="lg:col-span-7 bg-white/80 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex flex-col max-h-[520px] hover:shadow-md transition-shadow duration-300" id="roster-list-panel">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-display">Relação de Agentes em Campo</span>
              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-500/15 animate-fade-in">
                {filteredPosts.length}
              </span>
            </div>
            {searchTerm || selectedAvenue !== "ALL" || selectedShift !== "ALL" ? (
              <button 
                onClick={() => {
                  setSearchTerm("");
                  setSelectedAvenue("ALL");
                  setSelectedShift("ALL");
                }}
                className="text-[10px] font-extrabold text-rose-500 hover:text-rose-600 hover:underline transition-colors"
              >
                Limpar Filtros
              </button>
            ) : null}
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100/60 dark:divide-slate-800/30 pr-1.5 flex-grow custom-scrollbar mt-3 space-y-1.5">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((p, index) => {
                const isSelected = selectedPost?.nome === p.nome;
                return (
                  <div
                    key={`${p.nome}-${index}`}
                    onClick={() => setSelectedPost(p)}
                    className={`p-3.5 rounded-xl transition-all duration-300 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 border relative overflow-hidden ${
                      isSelected 
                        ? "bg-gradient-to-r from-indigo-500/12 to-indigo-500/2 border-indigo-500/30 shadow-sm translate-x-1" 
                        : "bg-transparent border-transparent hover:border-slate-100 dark:hover:border-slate-800/60 hover:bg-slate-50/60 dark:hover:bg-slate-950/30 hover:translate-x-0.5"
                    }`}
                  >
                    {/* Selected Left Anchor Highlight */}
                    {isSelected && (
                      <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 rounded-r"></span>
                    )}

                    <div className="space-y-1.5 flex-grow min-w-0 pr-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold transition-colors uppercase tracking-wide ${
                          isSelected 
                            ? "text-indigo-600 dark:text-indigo-400 font-extrabold" 
                            : "text-slate-800 dark:text-slate-100 group-hover:text-indigo-500 dark:group-hover:text-indigo-400"
                        }`}>
                          {p.nome}
                        </span>
                        <span className={`text-[8px] px-2 py-0.5 rounded-md font-black tracking-wide border ${
                          p.horario.includes("13:30") 
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-450" 
                            : "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-450"
                        }`}>
                          {p.etapa}
                        </span>
                      </div>
                      
                      {/* Local de Apoio - COMPLETELY VISIBLE AND FULL */}
                      <div className="flex items-start text-[11px] text-slate-550 dark:text-slate-400 gap-1.5">
                        <MapPin className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 transition-colors ${isSelected ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-400"}`} />
                        <span className="break-words font-medium leading-relaxed">
                          <strong className="text-slate-700 dark:text-slate-200 font-bold uppercase">{p.localApoio}</strong>
                          {p.especifico && (
                            <span className="text-slate-500 dark:text-slate-400"> × {p.especifico}</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Contato and Horário */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/40 flex-shrink-0">
                      <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 font-mono flex items-center space-x-1.5 bg-slate-55 dark:bg-slate-950/60 px-2 py-1 rounded-lg border border-slate-100/80 dark:border-slate-850">
                        <Phone className="w-3 h-3 text-indigo-500/60" />
                        <span>{p.contato}</span>
                      </div>
                      <div className="text-[10px] text-slate-450 dark:text-slate-500 flex items-center space-x-1 pl-1 sm:pl-0">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold">{p.horario}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center text-slate-450">
                <Users className="w-10 h-10 mx-auto opacity-15 mb-2.5 animate-pulse" />
                <p className="text-xs font-bold text-slate-750 dark:text-slate-350">Nenhum posto fixo localizado.</p>
                <p className="text-[10px] text-slate-550 mt-1">Tente alterar os filtros de vias ou turnos acima.</p>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Map & Geographic Anchor Panel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          {/* Detailed Info Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col space-y-4">
            
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-[8px] text-indigo-500 dark:text-indigo-400 font-extrabold uppercase tracking-wider block">Ficha do Posto Fixo</span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white mt-0.5 uppercase tracking-wide">
                {selectedPost ? selectedPost.nome : "Selecione um Agente"}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold mt-1">
                {selectedPost?.cargo || "Orientador I"}
              </p>
            </div>

            {selectedPost ? (
              <div className="space-y-3 text-xs">
                
                {/* Deployment details */}
                <div className="space-y-2">
                  <div className="bg-slate-55 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">ENDEREÇO</span>
                      <p className="font-extrabold text-slate-800 dark:text-slate-100 uppercase mt-1 leading-tight tracking-tight">
                        {selectedPost.localApoio}
                      </p>
                    </div>
                    {selectedPost.especifico && (
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">COMPLEMENTO</span>
                        <p className="font-semibold text-indigo-600 dark:text-indigo-400 uppercase mt-1 leading-tight">
                          {selectedPost.especifico}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shift, contact & stage */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight block">Horário Operacional</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-1 text-[11px]">{selectedPost.horario}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight block">Etapa e Turno</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-1 text-[11px] uppercase">{selectedPost.etapa}</span>
                  </div>
                </div>

                {/* Contact strip */}
                <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Telefone de Contato</span>
                  <a 
                    href={`tel:${selectedPost.contato}`} 
                    className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1"
                  >
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{selectedPost.contato}</span>
                  </a>
                </div>

                {/* Coordinates & Map launcher */}
                {selectedPost.lat ? (
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-bold uppercase">Coordenadas Geográficas</span>
                      <button 
                        onClick={() => handleCopyCoords(selectedPost.lat!, selectedPost.lng!)}
                        className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline border border-indigo-500/10 px-2 py-0.5 rounded bg-indigo-500/5 active:scale-95 transition-transform"
                      >
                        Copiar Lat/Lng
                      </button>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 font-mono text-[11px] text-slate-650 dark:text-slate-355 flex justify-between items-center">
                      <div className="space-y-0.5">
                        <div className="flex space-x-1.5"><span className="text-slate-400 font-bold">LAT:</span><span className="text-slate-800 dark:text-slate-200">{selectedPost.lat.toFixed(6)}</span></div>
                        <div className="flex space-x-1.5"><span className="text-slate-400 font-bold">LNG:</span><span className="text-slate-800 dark:text-slate-200">{selectedPost.lng.toFixed(6)}</span></div>
                      </div>
                      <Compass className="w-6 h-6 text-indigo-500/40 animate-spin-slow" />
                    </div>

                    {/* Google Maps External Link */}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedPost.lat},${selectedPost.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white dark:bg-slate-800 dark:hover:bg-slate-700 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 border border-slate-700 dark:border-slate-750"
                    >
                      <Navigation className="w-3.5 h-3.5 text-sky-400" />
                      <span>Abrir no Google Maps</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400/80 p-3.5 rounded-xl text-[11px] leading-relaxed flex items-start space-x-2">
                    <Info className="w-4 h-4 flex-shrink-0 text-amber-500 mt-0.5" />
                    <span>
                      Este orientador está classificado como <strong>itinerante</strong> ou à disposição da central de controle. Sem georreferenciamento de cruzamento fixo.
                    </span>
                  </div>
                )}

              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <MapPin className="w-10 h-10 mx-auto opacity-10 mb-2 animate-bounce" />
                <p className="text-xs font-semibold">Consulte os dados geográficos</p>
                <p className="text-[10px] text-slate-500">Selecione um agente na lista para visualizar.</p>
              </div>
            )}
          </div>

          {/* Mini Interactive SVG Map Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                <Layers className="w-3.5 h-3.5 text-indigo-500 mr-1.5" />
                Vetor de Posicionamento Recife
              </span>
              <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full uppercase">
                Simulação Ativa
              </span>
            </div>

            {/* Simulated Geographic Canvas */}
            <div className="h-28 bg-slate-50 dark:bg-slate-950 rounded-xl relative border border-slate-100 dark:border-slate-800 overflow-hidden flex items-center justify-center">
              
              {/* Coordinates scale overlay */}
              <div className="absolute top-1.5 left-2 text-[8px] text-slate-400 font-mono">
                Agamenon Magalhães Axis: 8.056°S / 34.898°W
              </div>

              {/* Graphic background - simple stylized grid */}
              <svg className="absolute inset-0 w-full h-full opacity-[0.06] dark:opacity-[0.12]" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Stylized main avenues lines */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-indigo-500/10 dark:bg-indigo-400/20"></div>
              <div className="absolute left-1/3 top-0 bottom-0 w-0.5 bg-indigo-500/10 dark:bg-indigo-400/20"></div>

              {/* Dynamic Point Overlay */}
              {selectedPost && selectedPost.lat ? (
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative">
                    <span className="absolute -inset-1 rounded-full bg-indigo-500/30 animate-ping"></span>
                    <MapPin className="w-6 h-6 text-indigo-500 relative z-10" />
                  </div>
                  <span className="text-[8px] font-black text-slate-850 dark:text-slate-150 uppercase bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-1.5 py-0.5 rounded shadow mt-1 flex items-center space-x-1 whitespace-nowrap">
                    <span>{selectedPost.especifico || selectedPost.localApoio}</span>
                  </span>
                </div>
              ) : (
                <div className="text-center space-y-1 z-10">
                  <Compass className="w-6 h-6 text-slate-400 dark:text-slate-600 mx-auto animate-spin-slow" />
                  <p className="text-[9px] font-bold text-slate-500">Aguardando coordenadas de cruzamento fixo</p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
