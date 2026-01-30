import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Palpite, Rodada, Profile } from '@/types/firebase';

interface RankingByRodada {
  rodada: string;
  numero: number;
  [key: string]: string | number; // user_id/nickname: posição
}

interface UseRankingHistoryResult {
  data: RankingByRodada[];
  isLoading: boolean;
  error: Error | null;
  userColors: Record<string, string>; // userId -> cor
}

// Paleta de cores pastel/suave - visual limpo e agradável
const DISTINCT_COLORS = [
  '#FFB347', '#A0E7E5', '#B39CD0', '#F49AC2', '#CB99C9',
  '#C23B22', '#FDFD96', '#836953', '#779ECB', '#FF6961',
  '#B19CD9', '#FFD1DC', '#AEC6CF', '#F4C2C2', '#CFCFC4',
  '#B38B6D'
];

// Gerar cor consistente baseada no userId
const generateColorForUser = (userId: string): string => {
  // Usar hash simples do userId para gerar índice consistente
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % DISTINCT_COLORS.length;
  return DISTINCT_COLORS[index];
};

export const useRankingHistory = (): UseRankingHistoryResult => {
  const { data: chartData, isLoading, error } = useQuery({
    queryKey: ['ranking-history-chart'],
    queryFn: async (): Promise<{
      data: RankingByRodada[];
      colorMap: Record<string, string>;
    }> => {
      try {
        // 1. Buscar todas as rodadas finalizadas
        const rodasRef = collection(db, 'rodadas');
        const rodasQuery = query(rodasRef, orderBy('numero', 'asc'));
        const rodasSnapshot = await getDocs(rodasQuery);

        const rodadas = rodasSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            numero: data.numero,
            status: data.status,
          };
        });

        // 2. Buscar todos os palpites
        const palpitesRef = collection(db, 'palpites');
        const palpitesSnapshot = await getDocs(palpitesRef);

        const palpites: Array<{
          usuario_id: string;
          rodada_id: string;
          pontos_obtidos: number;
        }> = [];

        palpitesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          palpites.push({
            usuario_id: data.usuario_id,
            rodada_id: data.rodada_id,
            pontos_obtidos: data.pontos_obtidos || 0,
          });
        });

        // 3. Buscar todos os usuários e nicknames
        const profilesRef = collection(db, 'profiles');
        const profilesSnapshot = await getDocs(profilesRef);

        const userMap: Record<string, string> = {};
        const colorMap: Record<string, string> = {};

        profilesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          userMap[doc.id] = data.nickname || `User-${doc.id.slice(0, 5)}`;
          colorMap[doc.id] = generateColorForUser(doc.id);
        });

        // 4. Construir histórico rodada por rodada
        const chartData: RankingByRodada[] = [];

        rodadas.forEach(rodada => {
          // Calcular pontuação acumulada até essa rodada
          const userScores: Record<string, number> = {};

          palpites.forEach(palpite => {
            // Encontrar o índice da rodada atual
            const currentRodadaIndex = rodadas.findIndex(r => r.id === rodada.id);

            // Encontrar o índice da rodada do palpite
            const palpiteRodadaIndex = rodadas.findIndex(r => r.id === palpite.rodada_id);

            // Só contar palpites de rodadas anteriores ou iguais (acumulado)
            if (palpiteRodadaIndex <= currentRodadaIndex) {
              if (!userScores[palpite.usuario_id]) {
                userScores[palpite.usuario_id] = 0;
              }
              userScores[palpite.usuario_id] += palpite.pontos_obtidos;
            }
          });

          // Ordenar usuários por score (maior para menor = melhor ranking)
          const sortedUsers = Object.entries(userScores).sort(
            ([, scoreA], [, scoreB]) => scoreB - scoreA
          );

          // Criar objeto da rodada com posições
          const rodadaData: RankingByRodada = {
            rodada: `R${rodada.numero}`,
            numero: rodada.numero,
          };

          // Atribuir posição para cada usuário
          sortedUsers.forEach(([userId], position) => {
            const nickname = userMap[userId] || `User-${userId.slice(0, 5)}`;
            rodadaData[nickname] = position + 1; // Posição começa em 1
          });

          chartData.push(rodadaData);
        });

        return { data: chartData, colorMap };
      } catch (err) {
        console.error('Erro ao buscar histórico de ranking:', err);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  const userColors = useMemo(() => {
    return chartData?.colorMap || {};
  }, [chartData?.colorMap]);

  const memoizedData = useMemo(() => {
    return chartData?.data || [];
  }, [chartData?.data]);

  return {
    data: memoizedData,
    isLoading,
    error: error as Error | null,
    userColors,
  };
};
