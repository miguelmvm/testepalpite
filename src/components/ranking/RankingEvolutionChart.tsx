import { useMemo, useRef, useLayoutEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRankingHistory } from "@/hooks/useRankingHistory";
import { Loader2, Maximize2, X } from "lucide-react";

// Dados mockados para fallback inicial
const MOCK_DATA = [
  { rodada: "R1", Miguel: 1, Nathan: 3, Carlos: 2, Ana: 5, Pedro: 4 },
  { rodada: "R2", Miguel: 2, Nathan: 1, Carlos: 3, Ana: 4, Pedro: 5 },
  { rodada: "R3", Miguel: 1, Nathan: 2, Carlos: 4, Ana: 3, Pedro: 5 },
  { rodada: "R4", Miguel: 3, Nathan: 1, Carlos: 2, Ana: 5, Pedro: 4 },
  { rodada: "R5", Miguel: 2, Nathan: 3, Carlos: 1, Ana: 4, Pedro: 5 },
];

interface RankingEvolutionChartProps {
  data?: Array<Record<string, string | number>>;
}

// OBJETIVO 2: Paleta de cores pastel/suave - visual limpo e tranquilo
const DISTINCT_COLORS = [
  '#FFB347', '#A0E7E5', '#B39CD0', '#F49AC2', '#CB99C9',
  '#C23B22', '#FDFD96', '#836953', '#779ECB', '#FF6961',
  '#B19CD9', '#FFD1DC', '#AEC6CF', '#F4C2C2', '#CFCFC4',
  '#B38B6D'
];

// Mapeamento de cores por usuário (consistente) - usa paleta distinta
const getColorForUser = (userName: string, allUsers: string[], userColorsMap?: Record<string, string>): string => {
  // Se temos mapa de cores real, usar
  if (userColorsMap && userColorsMap[userName]) {
    return userColorsMap[userName];
  }
  // Fallback: usar índice no array com DISTINCT_COLORS
  const index = allUsers.indexOf(userName);
  return index >= 0 ? DISTINCT_COLORS[index % DISTINCT_COLORS.length] : "#6B7280";
};

// Helper para extrair iniciais do nome (ex: "Miguel Mota" -> "MM")
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// OBJETIVO 1: Componente CustomChartDot - Avatar "Liquid Glass Pastel" com Badge de Posição
const CustomChartDot = (props: any) => {
  const { cx, cy, fill, stroke, payload, dataKey, users, focusedUser } = props;
  if (!cx || !cy) return null;

  const color = stroke || fill || '#888888';
  const userName = dataKey;
  const initials = getInitials(userName);
  const position = payload?.[dataKey]; // Extrai a posição do payload (valor do Y)
  
  // Calcular opacidade baseada no foco
  const isFocused = focusedUser === null || focusedUser === userName;
  const dotOpacity = focusedUser === null ? 1 : (isFocused ? 1 : 0.15);

  // Converter hex para rgb para aplicar transparência
  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
  };

  const rgbColor = hexToRgb(color);

  return (
    <g opacity={dotOpacity} style={{ transition: 'opacity 0.3s ease' }}>
      {/* Círculo com efeito "Liquid Glass" - vidro fosco colorido */}
      <circle
        cx={cx}
        cy={cy}
        r={18}
        fill={`rgba(${rgbColor}, 0.35)`}
        style={{
          backdropFilter: 'blur(8px)',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.15)) drop-shadow(inset 0 1px 0 rgba(255, 255, 255, 0.1))'
        }}
      />
      {/* Borda sutil e elegante */}
      <circle
        cx={cx}
        cy={cy}
        r={18}
        fill="none"
        stroke="rgba(255, 255, 255, 0.25)"
        strokeWidth={1.5}
      />
      {/* Realce interno para efeito vidro */}
      <circle
        cx={cx}
        cy={cy - 6}
        r={5}
        fill="rgba(255, 255, 255, 0.15)"
        opacity={0.6}
      />
      {/* Número da posição - topo da esfera, bem pequeno */}
      {position && (
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize="8"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity="0.85"
          style={{ textShadow: '0 0.5px 1px rgba(0, 0, 0, 0.3)' }}
        >
          {position}
        </text>
      )}
      
      {/* Inicial do usuário - centro da esfera */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="13"
        fontWeight="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)' }}
      >
        {initials}
      </text>
    </g>
  );
};

// Halo Effect para activeDot (apenas no hover) - Enhanced "Liquid Glass" com Badge
const HaloDot = (props: any) => {
  const { cx, cy, fill, stroke, dataKey, payload, focusedUser } = props;
  if (!cx || !cy) return null;

  const color = stroke || fill || '#888888';
  const initials = getInitials(dataKey);
  const position = payload?.[dataKey]; // Extrai a posição do payload
  
  // Calcular opacidade baseada no foco
  const isFocused = focusedUser === null || focusedUser === dataKey;
  const dotOpacity = focusedUser === null ? 1 : (isFocused ? 1 : 0.15);

  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
  };

  const rgbColor = hexToRgb(color);

  return (
    <g opacity={dotOpacity} style={{ transition: 'opacity 0.3s ease' }}>
      {/* Halo externo - aura suave */}
      <circle
        cx={cx}
        cy={cy}
        r={28}
        fill={`rgba(${rgbColor}, 0.15)`}
        style={{ backdropFilter: 'blur(12px)' }}
      />
      {/* Halo médio */}
      <circle
        cx={cx}
        cy={cy}
        r={24}
        fill="none"
        stroke={`rgba(${rgbColor}, 0.3)`}
        strokeWidth={1.5}
        opacity={0.8}
      />
      {/* Círculo principal com vidro mais opaco */}
      <circle
        cx={cx}
        cy={cy}
        r={18}
        fill={`rgba(${rgbColor}, 0.45)`}
        style={{
          backdropFilter: 'blur(10px)',
          filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25))'
        }}
      />
      {/* Borda mais visível no hover */}
      <circle
        cx={cx}
        cy={cy}
        r={18}
        fill="none"
        stroke="rgba(255, 255, 255, 0.35)"
        strokeWidth={2}
      />
      {/* Realce interno intensificado */}
      <circle
        cx={cx}
        cy={cy - 6}
        r={6}
        fill="rgba(255, 255, 255, 0.2)"
        opacity={0.8}
      />
      {/* Número da posição - topo da esfera, bem pequeno (versão hover, mais visível) */}
      {position && (
        <text
          x={cx}
          y={cy - 9}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize="9"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity="0.95"
          style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)' }}
        >
          {position}
        </text>
      )}
      
      {/* Inicial do usuário - centro da esfera (versão hover, mais visível) */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="14"
        fontWeight="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}
      >
        {initials}
      </text>
    </g>
  );
};

// Defs - sem filtros de glow para visual limpo e suave
const GlowDefs = () => (
  <defs />
);

export function RankingEvolutionChart({ data }: RankingEvolutionChartProps) {
  const { data: realData, isLoading, userColors } = useRankingHistory();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusedUser, setFocusedUser] = useState<string | null>(null);
  
  // Usar dados reais se disponíveis, caso contrário usar mock
  const chartData = data || realData || MOCK_DATA;

  // Handle focus toggle
  const handleFocus = (userId: string) => {
    setFocusedUser((prev) => (prev === userId ? null : userId));
  };

  // OBJETIVO 3: Calcular largura dinâmica baseada no número de rodadas
  // Mínimo 120px por rodada para garantir espaçamento horizontal adequado (maior respiro)
  const chartWidth = useMemo(() => {
    const minWidthPerRodada = 120;
    const calculatedWidth = Math.max(chartData.length * minWidthPerRodada, 800);
    return typeof window !== 'undefined' ? Math.max(window.innerWidth - 40, calculatedWidth) : calculatedWidth;
  }, [chartData.length]);

  // Extrair nomes dos usuários (todas as colunas exceto 'rodada' e 'numero')
  const usuarios = useMemo(() => {
    if (chartData.length === 0) return [];
    const firstRow = chartData[0];
    return Object.keys(firstRow).filter((key) => key !== "rodada" && key !== "numero");
  }, [chartData]);

  // Rolar para a direita (última rodada) quando o gráfico carregar
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      // Aguardar um frame para garantir que o layout foi calculado
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          container.scrollLeft = container.scrollWidth - container.clientWidth;
        }
      });
    }
  }, [chartData.length]);

  // Se está carregando dados reais
  if (isLoading && realData.length === 0) {
    return (
      <Card className="shadow-card border-primary/20 bg-background/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Evolução do Ranking
          </CardTitle>
          <CardDescription>Acompanhe como as posições mudaram ao longo das rodadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Se não houver dados suficientes, não renderizar
  if (chartData.length < 2) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>📈 Evolução do Ranking</CardTitle>
          <CardDescription>Acompanhe como as posições mudaram ao longo das rodadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            Dados insuficientes para renderizar o gráfico
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-card border-primary/20 bg-background/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="flex-1">
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Evolução do Ranking
          </CardTitle>
          <CardDescription>Acompanhe como as posições mudaram ao longo das rodadas</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsFullscreen(true)}
          className="ml-2"
          title="Ver em tela cheia"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="overflow-y-auto max-h-[calc(100vh-200px)]">
        <div className="w-full overflow-x-auto overflow-y-hidden pb-4" ref={scrollContainerRef}>
          <div style={{ width: chartWidth }} className="min-w-full">
            <div className="h-[600px] bg-gradient-to-br from-gray-900 to-black/80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 40, right: 30, left: 20, bottom: 10 }}
                >
                  {/* SVG Defs - sem filtros */}

                  {/* Grid ultra-minimalista - quase invisível */}
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#444444"
                    strokeOpacity={0.15}
                    vertical={false}
                  />

                  {/* Eixo X - Rodadas (minimalista) */}
                  <XAxis
                    dataKey="rodada"
                    stroke="#555555"
                    style={{ fontSize: "0.75rem", fontWeight: 400, fill: "#888888" }}
                    tickLine={{ stroke: "#444444", strokeOpacity: 0.3 }}
                  />

                  {/* Eixo Y - Posição (Invertido: 1 no TOPO, minimalista) */}
                  <YAxis
                    reversed={true}
                    stroke="#555555"
                    style={{ fontSize: "0.75rem", fontWeight: 400, fill: "#888888" }}
                    ticks={Array.from({ length: Math.max(...chartData.flatMap((row) =>
                      usuarios.map((user) => (typeof row[user] === "number" ? row[user] : 0))
                    )) }, (_, i) => i + 1)}
                    domain={[Math.max(...chartData.flatMap((row) =>
                      usuarios.map((user) => (typeof row[user] === "number" ? row[user] : 0))
                    )), 1]}
                    label={{
                      value: "Posição",
                      angle: -90,
                      position: "insideLeft",
                      offset: 10,
                      style: { fill: "#888888", fontSize: "0.75rem", fontWeight: 400 },
                    }}
                    tickLine={{ stroke: "#444444", strokeOpacity: 0.3 }}
                  />

                  {/* Legenda */}
                  <Legend
                    wrapperStyle={{ paddingTop: "20px" }}
                    iconType="line"
                    textAnchor="middle"
                  />

                  {/* Linhas para cada usuário - com interatividade de foco */}
                  {usuarios.map((usuario) => {
                    const color = getColorForUser(usuario, usuarios, userColors);
                    const isFocused = focusedUser === null || focusedUser === usuario;
                    const lineStrokeOpacity = focusedUser === null ? 0.65 : (isFocused ? 1 : 0.1);
                    const lineStrokeWidth = focusedUser === null ? 3.5 : (isFocused ? 5 : 2.5);
                    
                    return (
                      <Line
                        key={usuario}
                        type="monotone"
                        dataKey={usuario}
                        stroke={color}
                        strokeWidth={lineStrokeWidth}
                        strokeOpacity={lineStrokeOpacity}
                        dot={<CustomChartDot stroke={color} fill={color} focusedUser={focusedUser} />}
                        activeDot={<HaloDot fill={color} stroke={color} focusedUser={focusedUser} />}
                        isAnimationActive={true}
                        name={usuario}
                        onClick={() => handleFocus(usuario)}
                        style={{ cursor: 'pointer', transition: 'stroke-width 0.3s ease, stroke-opacity 0.3s ease' }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Legenda de cores - Com espaçamento generoso e interatividade */}
        <div className="mt-8 pb-12">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Legenda de Usuários
          </p>
          <div className="flex flex-wrap gap-3">
            {usuarios.map((usuario) => {
              const color = getColorForUser(usuario, usuarios, userColors);
              const isFocused = focusedUser === usuario;
              return (
                <div
                  key={usuario}
                  onClick={() => handleFocus(usuario)}
                  className={`flex items-center gap-2 rounded-lg p-2 whitespace-nowrap cursor-pointer transition-all duration-300 ${
                    isFocused
                      ? 'bg-white/20 ring-2 ring-offset-2 ring-white/40'
                      : 'bg-muted/40 hover:bg-muted/60'
                  }`}
                >
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className={`text-sm font-medium ${isFocused ? 'font-bold' : ''}`}>{usuario}</span>
                </div>
              );
            })}
          </div>
          <div className="h-6" />
        </div>
      </CardContent>
    </Card>

    {/* Modal Fullscreen - Otimizado para Mobile Landscape */}
    {isFullscreen && (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-950 overflow-y-auto" style={{ height: '100dvh', width: '100dvw' }}>
        {/* Header do Modal - Compacto em landscape, protegido da safe area */}
        <div className="flex items-center justify-between border-b border-primary/10 bg-gray-900/80 px-3 sm:px-6 py-2 sm:py-3 backdrop-blur-sm flex-none sticky top-0 z-10" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold truncate">📈 Evolução do Ranking</h2>
            <p className="text-xs text-muted-foreground hidden sm:block">Arraste para o lado para visualizar melhor</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(false)}
            className="ml-2 flex-shrink-0"
            title="Fechar"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>

        {/* Conteúdo do Modal - Gráfico responsivo com scroll (REI da tela) */}
        <div className="w-full px-1 sm:px-3 py-1 sm:py-2 bg-gradient-to-br from-gray-900 to-black/80">
          {/* Scroll Container - permite scroll horizontal do gráfico com altura garantida */}
          <div className="overflow-x-auto overflow-y-hidden w-full min-h-[600px]" ref={scrollContainerRef}>
            <div style={{ width: chartWidth, height: '600px', display: 'flex', flexDirection: 'column' }} className="flex flex-col">
              <div style={{ flex: 1, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 40, right: 15, left: 35, bottom: 8 }}
                  >
                    {/* Sem filtros de glow */}

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#444444"
                      strokeOpacity={0.15}
                      vertical={false}
                    />

                    <XAxis
                      dataKey="rodada"
                      stroke="#555555"
                      style={{ fontSize: "0.7rem", fontWeight: 400, fill: "#888888" }}
                      tickLine={{ stroke: "#444444", strokeOpacity: 0.3 }}
                    />

                    <YAxis
                      reversed={true}
                      stroke="#555555"
                      style={{ fontSize: "0.7rem", fontWeight: 400, fill: "#888888" }}
                      ticks={Array.from({ length: Math.max(...chartData.flatMap((row) =>
                        usuarios.map((user) => (typeof row[user] === "number" ? row[user] : 0))
                      )) }, (_, i) => i + 1)}
                      domain={[Math.max(...chartData.flatMap((row) =>
                        usuarios.map((user) => (typeof row[user] === "number" ? row[user] : 0))
                      )), 1]}
                      width={32}
                      label={{
                        value: "Pos.",
                        angle: -90,
                        position: "insideLeft",
                        offset: 10,
                        style: { fill: "#888888", fontSize: "0.65rem", fontWeight: 400 },
                      }}
                      tickLine={{ stroke: "#444444", strokeOpacity: 0.3 }}
                    />

                    <Legend
                      wrapperStyle={{ display: "none" }}
                      iconType="line"
                      textAnchor="middle"
                    />

                    {usuarios.map((usuario) => {
                      const color = getColorForUser(usuario, usuarios, userColors);
                      const isFocused = focusedUser === null || focusedUser === usuario;
                      const lineStrokeOpacity = focusedUser === null ? 0.65 : (isFocused ? 1 : 0.1);
                      const lineStrokeWidth = focusedUser === null ? 3.5 : (isFocused ? 5 : 2.5);
                      
                      return (
                        <Line
                          key={usuario}
                          type="monotone"
                          dataKey={usuario}
                          stroke={color}
                          strokeWidth={lineStrokeWidth}
                          strokeOpacity={lineStrokeOpacity}
                          dot={<CustomChartDot stroke={color} fill={color} focusedUser={focusedUser} />}
                          activeDot={<HaloDot fill={color} stroke={color} focusedUser={focusedUser} />}
                          isAnimationActive={true}
                          name={usuario}
                          onClick={() => handleFocus(usuario)}
                          style={{ cursor: 'pointer', transition: 'stroke-width 0.3s ease, stroke-opacity 0.3s ease' }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Legenda compacta no footer - com interatividade */}
          <div className="border-t border-primary/10 bg-gray-900/50 backdrop-blur-sm mt-2 pt-2 px-2 sm:px-3 pb-20" style={{ paddingBottom: 'max(5rem, calc(0.5rem + env(safe-area-inset-bottom)))' }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Jogadores</p>
            <div className="flex flex-wrap gap-2">
              {usuarios.map((usuario) => {
                const color = getColorForUser(usuario, usuarios, userColors);
                const isFocused = focusedUser === usuario;
                return (
                  <div
                    key={usuario}
                    onClick={() => handleFocus(usuario)}
                    className={`flex items-center gap-1.5 rounded px-2 py-1 flex-shrink-0 cursor-pointer transition-all duration-300 ${
                      isFocused
                        ? 'bg-white/20 ring-1 ring-white/40'
                        : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-medium text-foreground whitespace-nowrap">{usuario}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
